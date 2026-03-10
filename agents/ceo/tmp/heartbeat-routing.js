const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const apiUrl = process.env.PAPERCLIP_API_URL;
const apiKey = process.env.PAPERCLIP_API_KEY;
const companyId = process.env.PAPERCLIP_COMPANY_ID;
const runId = process.env.PAPERCLIP_RUN_ID;

if (!apiUrl || !apiKey || !companyId || !runId) {
  console.error('Missing required PAPERCLIP_* environment variables.');
  process.exit(1);
}

const heartbeatTag = new Date().toISOString().replace(/[:.]/g, '-');
const outDir = path.join('agents', 'ceo', 'tmp', 'heartbeat', heartbeatTag);
fs.mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function sanitize(name) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function asItems(data) {
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.items)) return data.items;
  if (data && Array.isArray(data.data)) return data.data;
  if (data && Array.isArray(data.results)) return data.results;
  return [];
}

function getNextToken(data) {
  if (!data || Array.isArray(data)) return null;
  if (typeof data.nextCursor === 'string' && data.nextCursor) {
    return { type: 'cursor', value: data.nextCursor };
  }
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
  const t = String(s || '').trim();
  const m = t.match(/^\[(.*)\]$/);
  return (m ? m[1] : t).trim();
}

function extractDirectives(text) {
  const directives = [];
  if (!text) return directives;
  const re = /^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$/gm;
  let match;
  while ((match = re.exec(String(text))) !== null) {
    directives.push(stripBracketsAndTrim(match[1]));
  }
  return directives;
}

function hasCheckout409Line(text) {
  if (!text) return false;
  return /^Checkout release requested: 409$/m.test(String(text));
}

function runCurlStrict(url, method = 'GET', body = null, mutate = false) {
  const args = ['-sS', '-f', '-L', '-X', method, '-H', `Authorization: Bearer ${apiKey}`, '-H', 'Accept: application/json'];
  if (body !== null) {
    args.push('-H', 'Content-Type: application/json', '--data', JSON.stringify(body));
  }
  if (mutate) {
    args.push('-H', `X-Paperclip-Run-Id: ${runId}`);
  }
  args.push(url);
  return spawnSync('curl', args, { encoding: 'utf8' });
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
      return { ok: false, retryable, reason: `HTTP ${res.status} (${attemptLabel}) for ${url}`, status: res.status };
    }

    return { ok: true };
  };

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
    return { ok: true, data: parseFromFile(), file };
  } catch (err) {
    if (!parseRetry) {
      return { ok: false, error: `parse failed (no retry): ${err.message}`, file };
    }

    // Sequential strict curl refetch for parse/read failures.
    await sleep(500);
    const strict = runCurlStrict(url, method, body, mutate);
    if (strict.status !== 0) {
      return { ok: false, error: `parse failed then strict refetch failed: ${strict.stderr || strict.stdout || 'curl failed'}`, file };
    }
    fs.writeFileSync(file, strict.stdout, 'utf8');

    try {
      return { ok: true, data: parseFromFile(), file };
    } catch (err2) {
      return { ok: false, error: `parse failed after strict refetch: ${err2.message}`, file };
    }
  }
}

async function fetchAllPages({ baseName, url, pageLimit = 200 }) {
  const items = [];
  let pages = 0;
  let page = 1;
  let cursor = null;

  for (;;) {
    const pageUrl = new URL(url);
    if (cursor) {
      pageUrl.searchParams.set('cursor', cursor);
    } else {
      pageUrl.searchParams.set('page', String(page));
    }

    const res = await fetchToFile({
      name: `${baseName}_${cursor ? `cursor_${cursor}` : `page_${page}`}`,
      url: pageUrl.toString(),
    });

    if (!res.ok) {
      return { ok: false, error: res.error, pages, items };
    }

    pages += 1;
    const chunk = asItems(res.data);
    for (const i of chunk) items.push(i);

    const next = getNextToken(res.data);
    if (!next) break;

    if (next.type === 'cursor') {
      cursor = next.value;
    } else {
      page = next.value;
      cursor = null;
    }

    if (pages >= pageLimit) {
      return { ok: false, error: `pagination exceeded safety limit (${pageLimit})`, pages, items };
    }
  }

  return { ok: true, items, pages };
}

function buildIssueTranscriptDescription(originalDescription, comments, agentNamesById, issueIdentifier) {
  const safeOriginal = (originalDescription || '').trimEnd();
  const sorted = [...comments].sort((a, b) => {
    const at = String(a.createdAt || '1970-01-01T00:00:00.000Z');
    const bt = String(b.createdAt || '1970-01-01T00:00:00.000Z');
    if (at !== bt) return at.localeCompare(bt);
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  const transcript = sorted
    .map((c) => {
      const agentName = c.authorAgentId ? agentNamesById.get(c.authorAgentId) : null;
      const label = agentName ? `[${agentName}]` : '[User]';
      const body = String(c.body || '').trimEnd();
      return `${label}:\n${body}`;
    })
    .join('\n\n');

  const separator = '\n\n---\n\n';
  const recoveryHeader = `Recovery transcript from ${issueIdentifier || 'stuck issue'}:`;
  return `${safeOriginal}${separator}${recoveryHeader}\n\n${transcript}`;
}

function pickLatestDirective(issue, comments) {
  const directives = [];

  const descriptionMatches = extractDirectives(issue.description || '');
  for (const targetName of descriptionMatches) {
    directives.push({
      createdAt: issue.createdAt || '1970-01-01T00:00:00.000Z',
      id: `description:${issue.id}`,
      source: 'description',
      targetName,
    });
  }

  for (const c of comments) {
    const matches = extractDirectives(c.body || '');
    for (const targetName of matches) {
      directives.push({
        createdAt: c.createdAt || '1970-01-01T00:00:00.000Z',
        id: String(c.id || ''),
        source: 'comment',
        targetName,
      });
    }
  }

  if (directives.length === 0) return null;

  directives.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    return a.id.localeCompare(b.id);
  });

  return directives[directives.length - 1];
}

(async () => {
  const summary = {
    projectId: null,
    projectName: null,
    scannedIssues: 0,
    issuePages: 0,
    commentPages: 0,
    reassigned: 0,
    alreadyCorrect: 0,
    noValidDirective: 0,
    invalidTargets: 0,
    skippedFailures: 0,
    skipped409InAssign: 0,
    recoveryCandidates: 0,
    recoveredIssues: 0,
    recoveryFailures: 0,
    inbox: { in_progress: 0, todo: 0, blocked: 0 },
  };

  const meRes = await fetchToFile({ name: 'agents_me', url: `${apiUrl}/api/agents/me` });
  if (!meRes.ok) {
    console.error(`Failed to fetch /agents/me: ${meRes.error}`);
    process.exit(1);
  }
  const me = meRes.data;

  const projectsRes = await fetchToFile({ name: 'projects', url: `${apiUrl}/api/companies/${companyId}/projects` });
  if (!projectsRes.ok) {
    console.error(`Failed to fetch projects: ${projectsRes.error}`);
    process.exit(1);
  }
  const projects = asItems(projectsRes.data);
  const project = projects.find((p) => {
    const n = String(p.name || '').toLowerCase();
    const k = String(p.urlKey || '').toLowerCase();
    const ws = Array.isArray(p.workspaces) ? p.workspaces : [];
    const wsMatch = ws.some((w) => {
      const name = String(w.name || '').toLowerCase();
      const cwd = String(w.cwd || '').toLowerCase();
      const repo = String(w.repoUrl || '').toLowerCase();
      return name.includes('story-writing-app') || cwd.includes('story-writing-app') || repo.includes('story-writing-app');
    });
    return n.includes('story writing app') || n.includes('story-writing-app') || k.includes('story-writing-app') || wsMatch;
  });

  if (!project) {
    console.error('Could not identify story-writing-app project.');
    process.exit(1);
  }

  summary.projectId = project.id;
  summary.projectName = project.name;

  const agentsRes = await fetchAllPages({
    baseName: 'agents',
    url: `${apiUrl}/api/companies/${companyId}/agents?limit=100`,
  });
  if (!agentsRes.ok) {
    console.error(`Failed to fetch agents: ${agentsRes.error}`);
    process.exit(1);
  }

  const allAgents = agentsRes.items;
  const activeAgents = allAgents.filter((a) => {
    const status = String(a.status || '').toLowerCase();
    return status !== 'deleted' && status !== 'archived';
  });

  const agentByName = new Map();
  const agentNameById = new Map();
  for (const a of activeAgents) {
    const cleanName = stripBracketsAndTrim(a.name || '');
    if (cleanName) agentByName.set(cleanName, a);
    if (a.id) agentNameById.set(a.id, String(a.name || cleanName || a.id));
  }

  const issuesBase = new URL(`${apiUrl}/api/companies/${companyId}/issues`);
  issuesBase.searchParams.set('projectId', project.id);
  issuesBase.searchParams.set('status', 'backlog,todo,in_progress,in_review,blocked');
  issuesBase.searchParams.set('limit', '100');

  const issuesRes = await fetchAllPages({ baseName: 'issues', url: issuesBase.toString() });
  if (!issuesRes.ok) {
    console.error(`Failed to fetch issues: ${issuesRes.error}`);
    process.exit(1);
  }

  const allIssues = issuesRes.items;
  summary.scannedIssues = allIssues.length;
  summary.issuePages = issuesRes.pages;

  const issueContexts = [];

  for (const issue of allIssues) {
    const commentsBase = new URL(`${apiUrl}/api/issues/${issue.id}/comments`);
    commentsBase.searchParams.set('limit', '100');

    const commentsRes = await fetchAllPages({
      baseName: `comments_${issue.identifier || issue.id}`,
      url: commentsBase.toString(),
    });

    if (!commentsRes.ok) {
      summary.skippedFailures += 1;
      continue;
    }

    summary.commentPages += commentsRes.pages;
    const comments = commentsRes.items;

    const has409 = comments.some((c) => hasCheckout409Line(c.body || ''));
    const latestDirective = pickLatestDirective(issue, comments);

    issueContexts.push({ issue, comments, has409, latestDirective });
  }

  const recoveryQueue = issueContexts.filter((ctx) => ctx.has409);
  summary.recoveryCandidates = recoveryQueue.length;

  for (const ctx of issueContexts) {
    if (ctx.has409) {
      summary.skipped409InAssign += 1;
      continue;
    }

    if (!ctx.latestDirective) {
      summary.noValidDirective += 1;
      continue;
    }

    const targetName = stripBracketsAndTrim(ctx.latestDirective.targetName);
    const target = agentByName.get(targetName);

    if (!target) {
      summary.invalidTargets += 1;
      continue;
    }

    if (ctx.issue.assigneeAgentId === target.id) {
      summary.alreadyCorrect += 1;
      continue;
    }

    const patchRes = await fetchToFile({
      name: `patch_assign_${ctx.issue.identifier || ctx.issue.id}`,
      url: `${apiUrl}/api/issues/${ctx.issue.id}`,
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

  for (const ctx of recoveryQueue) {
    const issue = ctx.issue;
    const comments = ctx.comments;

    const latestDirective = ctx.latestDirective;
    const target = latestDirective ? agentByName.get(stripBracketsAndTrim(latestDirective.targetName)) : null;

    const boardComment = await fetchToFile({
      name: `release_followup_comment_${issue.identifier || issue.id}`,
      url: `${apiUrl}/api/issues/${issue.id}/comments`,
      method: 'POST',
      body: {
        body: 'Board: please release checkout for this issue (assignee got 409). See docs/PAPERCLIP_SETUP.md § Release a stuck checkout.',
      },
      mutate: true,
    });
    if (!boardComment.ok) {
      summary.recoveryFailures += 1;
      continue;
    }

    const cancelRes = await fetchToFile({
      name: `cancel_issue_${issue.identifier || issue.id}`,
      url: `${apiUrl}/api/issues/${issue.id}`,
      method: 'PATCH',
      body: { status: 'cancelled', assigneeAgentId: null },
      mutate: true,
    });
    if (!cancelRes.ok) {
      summary.recoveryFailures += 1;
      continue;
    }

    const newDescription = buildIssueTranscriptDescription(issue.description || '', comments, agentNameById, issue.identifier || issue.id);

    const createBody = {
      title: issue.title,
      description: newDescription,
      projectId: issue.projectId || project.id,
      goalId: issue.goalId || null,
      parentId: issue.parentId || null,
      status: 'todo',
      assigneeAgentId: target ? target.id : null,
    };

    const createRes = await fetchToFile({
      name: `recovery_create_${issue.identifier || issue.id}`,
      url: `${apiUrl}/api/companies/${companyId}/issues`,
      method: 'POST',
      body: createBody,
      mutate: true,
    });
    if (!createRes.ok) {
      summary.recoveryFailures += 1;
      continue;
    }

    const newIssue = createRes.data;

    await fetchToFile({
      name: `recovery_old_comment_${issue.identifier || issue.id}`,
      url: `${apiUrl}/api/issues/${issue.id}/comments`,
      method: 'POST',
      body: { body: `Superseded by ${newIssue.identifier || newIssue.id}.` },
      mutate: true,
      parseRetry: true,
    });

    await fetchToFile({
      name: `recovery_new_comment_${newIssue.identifier || newIssue.id}`,
      url: `${apiUrl}/api/issues/${newIssue.id}/comments`,
      method: 'POST',
      body: {
        body: `Recovery ticket; previous ${issue.identifier || issue.id} stuck (checkout 409) and cancelled.`,
      },
      mutate: true,
      parseRetry: true,
    });

    summary.recoveredIssues += 1;
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

  const summaryFile = path.join(outDir, 'summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ summary, outDir, summaryFile }, null, 2));
})();
