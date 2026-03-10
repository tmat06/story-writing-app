const fs = require('fs');
const path = require('path');

const apiUrl = process.env.PAPERCLIP_API_URL;
const apiKey = process.env.PAPERCLIP_API_KEY;
const companyId = process.env.PAPERCLIP_COMPANY_ID;
const runId = process.env.PAPERCLIP_RUN_ID;

if (!apiUrl || !apiKey || !companyId || !runId) {
  console.error('Missing required PAPERCLIP_* environment variables.');
  process.exit(1);
}

const outDir = path.join('agents', 'ceo', 'tmp', 'heartbeat');
fs.mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

async function fetchToFile({ name, url, method = 'GET', body = null, mutate = false, parseRetry = true }) {
  const file = path.join(outDir, `${sanitize(name)}.json`);

  const doFetch = async (attemptLabel) => {
    const headers = {
      Authorization: `Bearer ${apiKey}`,
      Accept: 'application/json',
    };
    if (body !== null) headers['Content-Type'] = 'application/json';
    if (mutate) headers['X-Paperclip-Run-Id'] = runId;

    let res;
    try {
      res = await fetch(url, {
        method,
        headers,
        body: body === null ? undefined : JSON.stringify(body),
      });
    } catch (err) {
      return { ok: false, retryable: true, reason: `transport error (${attemptLabel}): ${err.message}` };
    }

    const text = await res.text();
    fs.writeFileSync(file, text, 'utf8');

    if (!text || text.trim().length === 0) {
      return { ok: false, retryable: true, reason: `empty response body (${attemptLabel})` };
    }

    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      return {
        ok: false,
        retryable,
        reason: `HTTP ${res.status} (${attemptLabel}) for ${url}`,
        status: res.status,
      };
    }

    return { ok: true, text };
  };

  // Request retry: one backoff retry for 429/transport/5xx.
  let result = await doFetch('initial');
  if (!result.ok && result.retryable) {
    await sleep(800);
    result = await doFetch('retry');
  }
  if (!result.ok) {
    return { ok: false, error: result.reason, file };
  }

  const parseFromFile = () => {
    const saved = fs.readFileSync(file, 'utf8');
    if (!saved || saved.trim().length === 0) {
      throw new Error('saved file is empty');
    }
    return JSON.parse(saved);
  };

  try {
    const data = parseFromFile();
    return { ok: true, data, file };
  } catch (err) {
    if (!parseRetry) {
      return { ok: false, error: `parse failed (no retry): ${err.message}`, file };
    }

    // Parse/read failure contract: one strict sequential refetch and parse retry.
    await sleep(500);
    const strictRefetch = await doFetch('parse-refetch');
    if (!strictRefetch.ok) {
      return { ok: false, error: `parse failed then refetch failed: ${strictRefetch.reason}`, file };
    }

    try {
      const data = parseFromFile();
      return { ok: true, data, file };
    } catch (err2) {
      return { ok: false, error: `parse failed after refetch: ${err2.message}`, file };
    }
  }
}

function asItems(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

function getNextToken(data, headersLike = null) {
  if (!data || Array.isArray(data)) return null;
  if (typeof data.nextCursor === 'string' && data.nextCursor) return { type: 'cursor', value: data.nextCursor };
  if (data.pageInfo && typeof data.pageInfo.nextCursor === 'string' && data.pageInfo.nextCursor) {
    return { type: 'cursor', value: data.pageInfo.nextCursor };
  }
  if (data.pagination && typeof data.pagination.nextCursor === 'string' && data.pagination.nextCursor) {
    return { type: 'cursor', value: data.pagination.nextCursor };
  }
  if (typeof data.nextPage === 'number') return { type: 'page', value: data.nextPage };
  if (typeof data.page === 'number' && typeof data.totalPages === 'number' && data.page < data.totalPages) {
    return { type: 'page', value: data.page + 1 };
  }
  return null;
}

function stripBracketsAndTrim(s) {
  const t = (s || '').trim();
  const m = t.match(/^\[(.*)\]$/);
  return (m ? m[1] : t).trim();
}

function extractDirectives(text) {
  const directives = [];
  if (!text) return directives;
  const re = /^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$/gm;
  let match;
  while ((match = re.exec(text)) !== null) {
    directives.push(stripBracketsAndTrim(match[1]));
  }
  return directives;
}

(async () => {
  const summary = {
    projectId: null,
    projectName: null,
    scannedIssues: 0,
    reassigned: 0,
    alreadyCorrect: 0,
    noValidDirective: 0,
    invalidTargets: 0,
    skippedFailures: 0,
    paginationPages: 0,
    inbox: { in_progress: 0, todo: 0, blocked: 0 },
  };

  const meRes = await fetchToFile({
    name: 'agents_me',
    url: `${apiUrl}/api/agents/me`,
  });
  if (!meRes.ok) {
    console.error(`Failed to fetch /agents/me: ${meRes.error}`);
    process.exit(1);
  }
  const me = meRes.data;

  const projectsRes = await fetchToFile({
    name: 'projects_list',
    url: `${apiUrl}/api/companies/${companyId}/projects`,
  });
  if (!projectsRes.ok) {
    console.error(`Failed to fetch projects: ${projectsRes.error}`);
    process.exit(1);
  }
  const projects = asItems(projectsRes.data);

  const project = projects.find((p) => {
    const n = (p.name || '').toLowerCase();
    const k = (p.urlKey || '').toLowerCase();
    const ws = Array.isArray(p.workspaces) ? p.workspaces : [];
    const wsMatch = ws.some((w) => {
      const name = (w.name || '').toLowerCase();
      const repo = (w.repoUrl || '').toLowerCase();
      return name.includes('story-writing-app') || repo.includes('story-writing-app');
    });
    return n.includes('story writing app') || k.includes('story-writing-app') || wsMatch;
  });

  if (!project) {
    console.error('Could not identify Story Writing App project.');
    process.exit(1);
  }
  summary.projectId = project.id;
  summary.projectName = project.name;

  const agentsRes = await fetchToFile({
    name: 'agents_list',
    url: `${apiUrl}/api/companies/${companyId}/agents`,
  });
  if (!agentsRes.ok) {
    console.error(`Failed to fetch agents: ${agentsRes.error}`);
    process.exit(1);
  }
  const allAgents = asItems(agentsRes.data);
  const agentByName = new Map();
  for (const a of allAgents) {
    const name = stripBracketsAndTrim(a.name || '');
    if (!name) continue;
    agentByName.set(name, a);
  }

  const statuses = 'backlog,todo,in_progress,in_review,blocked';
  const baseIssuesUrl = new URL(`${apiUrl}/api/companies/${companyId}/issues`);
  baseIssuesUrl.searchParams.set('projectId', project.id);
  baseIssuesUrl.searchParams.set('status', statuses);
  baseIssuesUrl.searchParams.set('limit', '100');

  const allIssues = [];
  let page = 1;
  let cursor = null;
  for (;;) {
    const pageUrl = new URL(baseIssuesUrl.toString());
    if (cursor) {
      pageUrl.searchParams.set('cursor', cursor);
    } else {
      pageUrl.searchParams.set('page', String(page));
    }

    const issuesRes = await fetchToFile({
      name: `issues_page_${cursor ? `cursor_${cursor}` : `page_${page}`}`,
      url: pageUrl.toString(),
    });

    if (!issuesRes.ok) {
      console.error(`Failed to fetch issues page: ${issuesRes.error}`);
      process.exit(1);
    }

    summary.paginationPages += 1;
    const chunk = asItems(issuesRes.data);
    for (const issue of chunk) allIssues.push(issue);

    const next = getNextToken(issuesRes.data);
    if (!next) break;
    if (next.type === 'cursor') {
      cursor = next.value;
    } else if (next.type === 'page') {
      page = next.value;
      cursor = null;
    } else {
      break;
    }

    // Stop if API accidentally loops.
    if (summary.paginationPages > 200) {
      console.error('Pagination exceeded safety limit.');
      process.exit(1);
    }
  }

  summary.scannedIssues = allIssues.length;

  for (const issue of allIssues) {
    const directives = [];

    const descriptionMatches = extractDirectives(issue.description || '');
    for (const targetName of descriptionMatches) {
      directives.push({
        createdAt: issue.createdAt || '1970-01-01T00:00:00.000Z',
        id: `description:${issue.id}`,
        targetName,
        source: 'description',
      });
    }

    const commentsRes = await fetchToFile({
      name: `issue_${issue.identifier || issue.id}_comments`,
      url: `${apiUrl}/api/issues/${issue.id}/comments`,
    });

    if (!commentsRes.ok) {
      summary.skippedFailures += 1;
      continue;
    }

    const comments = asItems(commentsRes.data);
    for (const c of comments) {
      const matches = extractDirectives(c.body || '');
      for (const targetName of matches) {
        directives.push({
          createdAt: c.createdAt || '1970-01-01T00:00:00.000Z',
          id: String(c.id || ''),
          targetName,
          source: 'comment',
        });
      }
    }

    if (directives.length === 0) {
      summary.noValidDirective += 1;
      continue;
    }

    directives.sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
      return a.id.localeCompare(b.id);
    });

    const selected = directives[directives.length - 1];
    const target = agentByName.get(stripBracketsAndTrim(selected.targetName));

    if (!target) {
      summary.invalidTargets += 1;
      continue;
    }

    if (issue.assigneeAgentId === target.id) {
      summary.alreadyCorrect += 1;
      continue;
    }

    const patchRes = await fetchToFile({
      name: `issue_${issue.identifier || issue.id}_assign_patch`,
      url: `${apiUrl}/api/issues/${issue.id}`,
      method: 'PATCH',
      body: { assigneeAgentId: target.id, comment: `Assigned to ${target.name}.` },
      mutate: true,
    });

    if (!patchRes.ok) {
      summary.skippedFailures += 1;
      continue;
    }

    summary.reassigned += 1;
  }

  const inboxRes = await fetchToFile({
    name: 'ceo_inbox',
    url: `${apiUrl}/api/companies/${companyId}/issues?assigneeAgentId=${me.id}&status=todo,in_progress,blocked`,
  });

  if (inboxRes.ok) {
    const inboxIssues = asItems(inboxRes.data);
    for (const i of inboxIssues) {
      if (i.status === 'in_progress') summary.inbox.in_progress += 1;
      else if (i.status === 'todo') summary.inbox.todo += 1;
      else if (i.status === 'blocked') summary.inbox.blocked += 1;
    }
  }

  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})();
