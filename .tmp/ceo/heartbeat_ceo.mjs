import fs from 'fs/promises';

const apiUrl = process.env.PAPERCLIP_API_URL;
const apiKey = process.env.PAPERCLIP_API_KEY;
const companyId = process.env.PAPERCLIP_COMPANY_ID;
const runId = process.env.PAPERCLIP_RUN_ID;
const meId = process.env.PAPERCLIP_AGENT_ID;

if (!apiUrl || !apiKey || !companyId || !runId || !meId) {
  throw new Error('Missing required PAPERCLIP_* env vars');
}

const outDir = '.tmp/ceo/runtime';
await fs.mkdir(outDir, { recursive: true });

function headers(mutating = false) {
  const h = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (mutating) h['X-Paperclip-Run-Id'] = runId;
  return h;
}

async function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

async function fetchJson(path, { method='GET', body, mutating=false, requestClass='generic', retry=true } = {}) {
  const url = `${apiUrl}${path}`;
  let res;
  try {
    res = await fetch(url, {
      method,
      headers: headers(mutating),
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (err) {
    if (retry) {
      await sleep(600);
      return fetchJson(path, { method, body, mutating, requestClass, retry:false });
    }
    throw err;
  }

  if ((res.status === 429 || res.status >= 500) && retry) {
    await sleep(800);
    return fetchJson(path, { method, body, mutating, requestClass, retry:false });
  }

  if (!res.ok) {
    const text = await res.text();
    const e = new Error(`${method} ${path} failed ${res.status}: ${text.slice(0, 400)}`);
    e.status = res.status;
    throw e;
  }

  const text = await res.text();
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const safePath = path.replace(/[^a-zA-Z0-9]+/g, '_').slice(0, 120);
  const file = `${outDir}/${stamp}_${method}_${safePath}.json`;
  await fs.writeFile(file, text || 'null');
  const stat = await fs.stat(file);
  if (stat.size === 0) {
    if (retry) {
      await sleep(500);
      return fetchJson(path, { method, body, mutating, requestClass, retry:false });
    }
    throw new Error(`Empty response body for ${method} ${path}`);
  }
  try {
    return JSON.parse(text || 'null');
  } catch (err) {
    if (retry) {
      await sleep(500);
      return fetchJson(path, { method, body, mutating, requestClass, retry:false });
    }
    throw err;
  }
}

function stripBracketAndTrim(s='') {
  return s.trim().replace(/^\[(.*)\]$/, '$1').trim();
}

function extractDirectives(text='', source='description', createdAt='1970-01-01T00:00:00.000Z', id='0') {
  const re = /^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$/gm;
  const out = [];
  for (const m of text.matchAll(re)) {
    out.push({
      targetRaw: m[1],
      target: stripBracketAndTrim(m[1]),
      createdAt,
      id: String(id),
      source,
    });
  }
  return out;
}

function sortByCreatedAtId(a, b) {
  if (a.createdAt < b.createdAt) return -1;
  if (a.createdAt > b.createdAt) return 1;
  return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
}

function hasCheckout409Line(text='') {
  return /(^|\n)Checkout release requested: 409($|\n)/m.test(text);
}

function asArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function nextPageToken(payload) {
  if (!payload || Array.isArray(payload)) return null;
  return payload.nextCursor ?? payload.nextPageToken ?? payload.next ?? null;
}

async function fetchAllIssues(projectId) {
  const statuses = 'backlog,todo,in_progress,in_review,blocked';
  const all = [];
  let page = 1;
  let cursor = null;
  while (true) {
    const qs = new URLSearchParams({ projectId, status: statuses, page: String(page), limit: '100' });
    if (cursor) qs.set('cursor', cursor);
    const payload = await fetchJson(`/api/companies/${companyId}/issues?${qs.toString()}`, { requestClass: 'issues_list' });
    const arr = asArray(payload);
    all.push(...arr);

    const npt = nextPageToken(payload);
    if (npt) {
      cursor = npt;
      page += 1;
      continue;
    }

    if (arr.length === 100) {
      page += 1;
      continue;
    }
    break;
  }
  return all;
}

const me = await fetchJson('/api/agents/me', { requestClass: 'identity' });
const agents = await fetchJson(`/api/companies/${companyId}/agents`, { requestClass: 'agents' });
const activeAgents = asArray(agents).filter(a => !a.archivedAt && a.status !== 'disabled');
const byName = new Map(activeAgents.map(a => [stripBracketAndTrim(a.name), a]));
const byId = new Map(activeAgents.map(a => [a.id, a]));

const projects = await fetchJson(`/api/companies/${companyId}/projects`, { requestClass: 'projects' });
const projectList = asArray(projects);
const project = projectList.find(p => (p.name || '').toLowerCase().includes('story writing app'))
  ?? projectList.find(p => (p.urlKey || '').includes('story-writing-app'))
  ?? projectList.find(p => String(p.workspace?.cwd || '').includes('/story-writing-app'));
if (!project) throw new Error('Story Writing App project not found');

const issues = await fetchAllIssues(project.id);

const summary = {
  projectId: project.id,
  scanned: issues.length,
  reassigned: 0,
  alreadyCorrect: 0,
  invalidDirective: 0,
  noDirective: 0,
  skipped409: 0,
  recovery: { candidates: 0, recovered: 0, failed: 0 },
  inbox: { in_progress: 0, todo: 0, blocked: 0 },
  touchedIssues: [],
  recoveryIssues: [],
};

const recoveryCandidates = [];

for (const issue of issues) {
  let comments;
  try {
    comments = await fetchJson(`/api/issues/${issue.id}/comments`, { requestClass: 'issue_comments' });
  } catch (err) {
    summary.touchedIssues.push({ issue: issue.identifier || issue.id, action: 'skip_comments_fetch_failed', error: String(err.message || err) });
    continue;
  }
  const commentList = asArray(comments).slice().sort((a,b)=> {
    if ((a.createdAt||'') < (b.createdAt||'')) return -1;
    if ((a.createdAt||'') > (b.createdAt||'')) return 1;
    return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
  });

  const has409 = commentList.some(c => hasCheckout409Line(c.body || ''));
  if (has409) {
    summary.skipped409 += 1;
    recoveryCandidates.push({ issue, comments: commentList });
    continue;
  }

  const descriptionDirectives = extractDirectives(issue.description || '', 'description', issue.createdAt || '1970-01-01T00:00:00.000Z', `desc:${issue.id}`);
  const commentDirectives = commentList.flatMap(c => extractDirectives(c.body || '', 'comment', c.createdAt || '1970-01-01T00:00:00.000Z', String(c.id)));

  const directives = [...descriptionDirectives, ...commentDirectives];
  if (directives.length === 0) {
    summary.noDirective += 1;
    continue;
  }

  directives.sort(sortByCreatedAtId);
  const winner = directives[directives.length - 1];

  const targetAgent = byName.get(winner.target);
  if (!targetAgent) {
    summary.invalidDirective += 1;
    summary.touchedIssues.push({ issue: issue.identifier || issue.id, action: 'invalid_target', target: winner.target });
    continue;
  }

  if (issue.assigneeAgentId === targetAgent.id) {
    summary.alreadyCorrect += 1;
    continue;
  }

  try {
    await fetchJson(`/api/issues/${issue.id}`, {
      method: 'PATCH',
      mutating: true,
      body: {
        assigneeAgentId: targetAgent.id,
        status: issue.status === 'backlog' ? 'todo' : issue.status,
      },
      requestClass: 'patch_issue_assign',
    });
    await fetchJson(`/api/issues/${issue.id}/comments`, {
      method: 'POST',
      mutating: true,
      body: {
        body: `Assigned to ${targetAgent.name}.`,
      },
      requestClass: 'post_assign_comment',
    });
    summary.reassigned += 1;
    summary.touchedIssues.push({ issue: issue.identifier || issue.id, action: 'assigned', to: targetAgent.name });
  } catch (err) {
    summary.touchedIssues.push({ issue: issue.identifier || issue.id, action: 'assign_failed', to: targetAgent.name, error: String(err.message || err) });
  }
}

summary.recovery.candidates = recoveryCandidates.length;

for (const rec of recoveryCandidates) {
  const { issue, comments } = rec;
  try {
    await fetchJson(`/api/issues/${issue.id}/comments`, {
      method: 'POST',
      mutating: true,
      body: {
        body: 'Board: please release checkout for this issue (assignee got 409). See docs/PAPERCLIP_SETUP.md § Release a stuck checkout.',
      },
      requestClass: 'recovery_comment_board',
    });

    await fetchJson(`/api/issues/${issue.id}`, {
      method: 'PATCH',
      mutating: true,
      body: {
        status: 'cancelled',
        assigneeAgentId: null,
      },
      requestClass: 'recovery_cancel_old',
    });

    const directives = [
      ...extractDirectives(issue.description || '', 'description', issue.createdAt || '1970-01-01T00:00:00.000Z', `desc:${issue.id}`),
      ...comments.flatMap(c => extractDirectives(c.body || '', 'comment', c.createdAt || '1970-01-01T00:00:00.000Z', String(c.id))),
    ].sort(sortByCreatedAtId);
    const winner = directives.at(-1);
    const target = winner ? byName.get(winner.target) : null;

    const transcriptBlocks = comments
      .slice()
      .sort((a,b)=> {
        if ((a.createdAt||'') < (b.createdAt||'')) return -1;
        if ((a.createdAt||'') > (b.createdAt||'')) return 1;
        return String(a.id).localeCompare(String(b.id), undefined, { numeric: true });
      })
      .map(c => {
        const author = c.authorAgentId ? (byId.get(c.authorAgentId)?.name || 'Unknown Agent') : 'User';
        return `[${author}]:\n${c.body || ''}`;
      })
      .join('\n\n');

    const newDescription = `${issue.description || ''}\n\n---\n## Context from previous issue\n\n${transcriptBlocks}`;

    const newIssue = await fetchJson(`/api/companies/${companyId}/issues`, {
      method: 'POST',
      mutating: true,
      body: {
        title: issue.title,
        description: newDescription,
        projectId: issue.projectId,
        goalId: issue.goalId || null,
        parentId: issue.parentId || null,
        status: 'todo',
        assigneeAgentId: target?.id || null,
        priority: issue.priority,
      },
      requestClass: 'recovery_create_new',
    });

    await fetchJson(`/api/issues/${issue.id}/comments`, {
      method: 'POST',
      mutating: true,
      body: {
        body: `Superseded by ${newIssue.identifier || newIssue.id}.`,
      },
      requestClass: 'recovery_superseded_old',
    });

    await fetchJson(`/api/issues/${newIssue.id}/comments`, {
      method: 'POST',
      mutating: true,
      body: {
        body: `Recovery ticket; previous ${issue.identifier || issue.id} stuck (checkout 409) and cancelled.`,
      },
      requestClass: 'recovery_comment_new',
    });

    summary.recovery.recovered += 1;
    summary.recoveryIssues.push({ old: issue.identifier || issue.id, new: newIssue.identifier || newIssue.id, assignedTo: target?.name || null });
  } catch (err) {
    summary.recovery.failed += 1;
    summary.recoveryIssues.push({ old: issue.identifier || issue.id, error: String(err.message || err) });
  }
}

// Inbox step for CEO's own work
try {
  const inbox = await fetchJson(`/api/companies/${companyId}/issues?assigneeAgentId=${me.id}&status=todo,in_progress,blocked`, { requestClass: 'ceo_inbox' });
  const inboxIssues = asArray(inbox);
  for (const i of inboxIssues) {
    if (i.status === 'in_progress') summary.inbox.in_progress += 1;
    else if (i.status === 'todo') summary.inbox.todo += 1;
    else if (i.status === 'blocked') summary.inbox.blocked += 1;
  }
  summary.inbox.issues = inboxIssues.map(i => ({ id: i.id, identifier: i.identifier, title: i.title, status: i.status }));
} catch (err) {
  summary.inbox.error = String(err.message || err);
}

await fs.writeFile(`${outDir}/summary.json`, JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
