const fs = require('fs');
const path = require('path');

const API_URL = process.env.PAPERCLIP_API_URL;
const API_KEY = process.env.PAPERCLIP_API_KEY;
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID;
const AGENT_ID = process.env.PAPERCLIP_AGENT_ID;
const RUN_ID = process.env.PAPERCLIP_RUN_ID;

if (!API_URL || !API_KEY || !COMPANY_ID || !AGENT_ID || !RUN_ID) {
  console.error('Missing required PAPERCLIP_* env vars.');
  process.exit(1);
}

const outDir = path.join('.tmp', `ceo-heartbeat-${RUN_ID}`);
fs.mkdirSync(outDir, { recursive: true });
let seq = 0;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function normalizeName(raw) {
  if (!raw) return '';
  let s = String(raw).trim();
  if (s.startsWith('[') && s.endsWith(']')) s = s.slice(1, -1).trim();
  return s;
}

function extractArray(json, preferredKeys = []) {
  if (Array.isArray(json)) return json;
  for (const k of preferredKeys) {
    if (Array.isArray(json?.[k])) return json[k];
  }
  if (Array.isArray(json?.items)) return json.items;
  if (Array.isArray(json?.data)) return json.data;
  if (Array.isArray(json?.results)) return json.results;
  return [];
}

function getNextPageToken(json) {
  return (
    json?.nextCursor ??
    json?.cursor?.next ??
    json?.pagination?.nextCursor ??
    json?.meta?.nextCursor ??
    null
  );
}

function getPageProgress(json) {
  const page = json?.page ?? json?.pagination?.page ?? json?.meta?.page ?? null;
  const totalPages =
    json?.totalPages ?? json?.pagination?.totalPages ?? json?.meta?.totalPages ?? null;
  if (typeof page === 'number' && typeof totalPages === 'number' && page < totalPages) {
    return { page, totalPages };
  }
  return null;
}

function isRetriableStatus(status) {
  return status === 429 || status >= 500;
}

async function request(method, endpoint, opts = {}) {
  const {
    body,
    mutating = false,
    requestClass = `${method} ${endpoint}`,
    preferredKeys = [],
  } = opts;

  let lastErr = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const headers = {
        Authorization: `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
      };
      if (mutating) headers['X-Paperclip-Run-Id'] = RUN_ID;

      const res = await fetch(`${API_URL}${endpoint}`, {
        method,
        headers,
        body: body !== undefined ? JSON.stringify(body) : undefined,
      });
      const text = await res.text();

      const file = path.join(
        outDir,
        `${String(++seq).padStart(4, '0')}-${method}-${endpoint
          .replace(/[^a-zA-Z0-9]+/g, '_')
          .slice(0, 90)}.json`
      );
      fs.writeFileSync(file, text);

      if (!text || text.trim().length === 0) {
        throw new Error(`Empty response body for ${method} ${endpoint}`);
      }

      let json;
      try {
        json = JSON.parse(text);
      } catch (e) {
        throw new Error(`JSON parse failure for ${method} ${endpoint}: ${e.message}`);
      }

      if (!res.ok) {
        const err = new Error(`HTTP ${res.status} for ${method} ${endpoint}`);
        err.status = res.status;
        err.json = json;
        throw err;
      }

      return { json, list: extractArray(json, preferredKeys) };
    } catch (err) {
      lastErr = err;
      const status = err?.status;
      const retriable = status ? isRetriableStatus(status) : true;
      if (attempt === 1 && retriable) {
        await sleep(700);
        continue;
      }
      break;
    }
  }
  throw new Error(`Request failed (${requestClass}): ${lastErr?.message || String(lastErr)}`);
}

async function fetchAll(endpoint, preferredKeys = []) {
  const all = [];
  let cursor = null;
  let page = 1;

  for (let guard = 0; guard < 200; guard++) {
    const join = endpoint.includes('?') ? '&' : '?';
    let paged = endpoint;
    if (cursor) paged += `${join}cursor=${encodeURIComponent(cursor)}`;
    else if (guard > 0) paged += `${join}page=${page}`;

    const { json, list } = await request('GET', paged, {
      preferredKeys,
      requestClass: `paginate ${endpoint}`,
    });
    all.push(...list);

    const next = getNextPageToken(json);
    if (next) {
      cursor = next;
      continue;
    }
    const progress = getPageProgress(json);
    if (progress) {
      page = progress.page + 1;
      continue;
    }
    break;
  }

  return all;
}

function extractDirectivesFromText(text, createdAt, id, source) {
  const directives = [];
  if (!text) return directives;
  const re = /^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    directives.push({
      targetRaw: m[1],
      createdAt: createdAt || null,
      id: id != null ? String(id) : '',
      source,
    });
  }
  return directives;
}

function containsCheckout409(comments) {
  return comments.some((c) => {
    const body = c?.body || '';
    return body.split(/\r?\n/).some((line) => line === 'Checkout release requested: 409');
  });
}

function sortByCreatedAtId(a, b) {
  const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
  const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
  if (ta !== tb) return ta - tb;
  return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
}

(async () => {
  const summary = {
    scanned: 0,
    reassigned: 0,
    alreadyCorrect: 0,
    invalidDirective: 0,
    noDirective: 0,
    skipped409: 0,
    recoveryCloned: 0,
    recoveryFailed: 0,
    inbox: [],
  };

  const { json: me } = await request('GET', '/api/agents/me', {
    requestClass: 'identity',
  });

  const agents = await fetchAll(`/api/companies/${COMPANY_ID}/agents`, ['agents']);
  const activeAgents = agents.filter((a) => !a.archivedAt && !a.deletedAt);
  const byName = new Map(activeAgents.map((a) => [normalizeName(a.name), a]));
  const byId = new Map(activeAgents.map((a) => [a.id, a]));

  const projects = await fetchAll(`/api/companies/${COMPANY_ID}/projects`, ['projects']);
  const project = projects.find((p) => {
    const name = (p.name || '').toLowerCase();
    const primary = p.primaryWorkspace || {};
    const workspaces = Array.isArray(p.workspaces) ? p.workspaces : [];
    const wsStrings = [
      primary.cwd,
      primary.repoUrl,
      ...workspaces.flatMap((w) => [w?.name, w?.cwd, w?.repoUrl]),
    ]
      .filter(Boolean)
      .map((s) => String(s).toLowerCase());
    return name.includes('story writing app') || wsStrings.some((s) => s.includes('story-writing-app'));
  });

  if (!project) throw new Error('Could not find story-writing-app project');

  const statuses = 'backlog,todo,in_progress,in_review,blocked';
  const issues = await fetchAll(
    `/api/companies/${COMPANY_ID}/issues?projectId=${project.id}&status=${encodeURIComponent(statuses)}`,
    ['issues']
  );

  const stuckIssues = [];

  for (const issue of issues) {
    summary.scanned += 1;

    let comments = [];
    try {
      comments = await fetchAll(`/api/issues/${issue.id}/comments`, ['comments']);
    } catch (e) {
      continue;
    }

    const stuck409 = containsCheckout409(comments);
    if (stuck409) {
      summary.skipped409 += 1;
      stuckIssues.push({ issue, comments });
      continue;
    }

    const directives = [];
    directives.push(
      ...extractDirectivesFromText(issue.description || '', issue.createdAt, `${issue.id}:desc`, 'description')
    );
    for (const c of comments) {
      directives.push(...extractDirectivesFromText(c.body || '', c.createdAt, c.id, 'comment'));
    }

    if (directives.length === 0) {
      summary.noDirective += 1;
      continue;
    }

    directives.sort(sortByCreatedAtId);
    const validated = directives
      .map((d) => {
        const cleaned = normalizeName(d.targetRaw);
        const targetAgent = byName.get(cleaned);
        return targetAgent ? { ...d, targetAgent } : null;
      })
      .filter(Boolean);

    if (validated.length === 0) {
      summary.invalidDirective += 1;
      continue;
    }

    const chosen = validated[validated.length - 1];
    if (issue.assigneeAgentId === chosen.targetAgent.id) {
      summary.alreadyCorrect += 1;
      continue;
    }

    await request('PATCH', `/api/issues/${issue.id}`, {
      mutating: true,
      body: { assigneeAgentId: chosen.targetAgent.id },
      requestClass: 'assign issue',
    });
    await request('POST', `/api/issues/${issue.id}/comments`, {
      mutating: true,
      body: { body: `Assigned to ${chosen.targetAgent.name}.` },
      requestClass: 'assignment comment',
    });
    summary.reassigned += 1;
  }

  for (const entry of stuckIssues) {
    const issue = entry.issue;
    const comments = [...entry.comments].sort(sortByCreatedAtId);
    try {
      await request('POST', `/api/issues/${issue.id}/comments`, {
        mutating: true,
        body: {
          body:
            'Board: please release checkout for this issue (assignee got 409). See docs/PAPERCLIP_SETUP.md § Release a stuck checkout.',
        },
        requestClass: '409 board comment',
      });

      await request('PATCH', `/api/issues/${issue.id}`, {
        mutating: true,
        body: { status: 'cancelled', assigneeAgentId: null },
        requestClass: 'cancel stuck issue',
      });

      const transcript = comments
        .map((c) => {
          const agentName = c.authorAgentId ? byId.get(c.authorAgentId)?.name : null;
          const label = agentName || '[User]';
          return `[${label}]:\n${c.body || ''}`;
        })
        .join('\n\n');

      const newDescription = `${issue.description || ''}\n\n---\nRecovery transcript from ${issue.identifier || issue.id}:\n\n${transcript}`;

      const directives = [];
      directives.push(
        ...extractDirectivesFromText(issue.description || '', issue.createdAt, `${issue.id}:desc`, 'description')
      );
      for (const c of comments) {
        directives.push(...extractDirectivesFromText(c.body || '', c.createdAt, c.id, 'comment'));
      }
      directives.sort(sortByCreatedAtId);
      const valid = directives
        .map((d) => {
          const agent = byName.get(normalizeName(d.targetRaw));
          return agent ? { ...d, agent } : null;
        })
        .filter(Boolean);
      const last = valid.length ? valid[valid.length - 1].agent : null;

      const createBody = {
        title: issue.title,
        description: newDescription,
        projectId: issue.projectId,
        goalId: issue.goalId || null,
        parentId: issue.parentId || null,
        status: 'todo',
      };
      if (last) createBody.assigneeAgentId = last.id;

      const { json: created } = await request('POST', `/api/companies/${COMPANY_ID}/issues`, {
        mutating: true,
        body: createBody,
        requestClass: 'create recovery issue',
      });

      await request('POST', `/api/issues/${issue.id}/comments`, {
        mutating: true,
        body: { body: `Superseded by ${created.identifier || created.id}.` },
        requestClass: 'supersede old',
      });
      await request('POST', `/api/issues/${created.id}/comments`, {
        mutating: true,
        body: {
          body: `Recovery ticket; previous ${issue.identifier || issue.id} stuck (checkout 409) and cancelled.`,
        },
        requestClass: 'new recovery note',
      });
      summary.recoveryCloned += 1;
    } catch (e) {
      summary.recoveryFailed += 1;
    }
  }

  const inbox = await fetchAll(
    `/api/companies/${COMPANY_ID}/issues?assigneeAgentId=${AGENT_ID}&status=todo,in_progress,blocked`,
    ['issues']
  );
  summary.inbox = inbox.map((i) => ({
    id: i.id,
    identifier: i.identifier,
    title: i.title,
    status: i.status,
    priority: i.priority,
  }));

  const result = {
    wakeReason: process.env.PAPERCLIP_WAKE_REASON || null,
    companyId: COMPANY_ID,
    me: { id: me.id, name: me.name, role: me.role },
    project: { id: project.id, name: project.name },
    totalIssuesConsidered: issues.length,
    summary,
  };

  const summaryPath = path.join(outDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(result, null, 2));
  console.log(summaryPath);
  console.log(JSON.stringify(result, null, 2));
})();
