import fs from 'fs/promises';

const API = process.env.PAPERCLIP_API_URL;
const API_KEY = process.env.PAPERCLIP_API_KEY;
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID;
const RUN_ID = process.env.PAPERCLIP_RUN_ID;
const PROJECT_ID = '9433c050-62e8-4d4a-9dee-a2ccd33d8407';
const STATUSES = 'backlog,todo,in_progress,in_review,blocked';

if (!API || !API_KEY || !COMPANY_ID || !RUN_ID) {
  throw new Error('Missing PAPERCLIP env vars');
}

const outDir = '.tmp/ceo';
await fs.mkdir(outDir, { recursive: true });

async function requestJson(path, opts = {}, reqClass = 'generic', allowRetry = true) {
  const url = `${API}${path}`;
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
    ...(opts.headers || {}),
  };
  const init = { method: opts.method || 'GET', headers };
  if (opts.body !== undefined) init.body = JSON.stringify(opts.body);

  try {
    const res = await fetch(url, init);
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      const transient = res.status === 429 || res.status >= 500;
      if (allowRetry && transient) {
        await new Promise(r => setTimeout(r, 400));
        return requestJson(path, opts, reqClass, false);
      }
      throw new Error(`${reqClass} ${init.method} ${path} failed ${res.status}: ${text.slice(0, 300)}`);
    }
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  } catch (err) {
    const msg = String(err?.message || err);
    const transient = /fetch failed|network|ECONN|ETIMEDOUT|aborted/i.test(msg);
    if (allowRetry && transient) {
      await new Promise(r => setTimeout(r, 400));
      return requestJson(path, opts, reqClass, false);
    }
    throw err;
  }
}

async function fetchAndSave(path, file, reqClass = 'fetch') {
  const data = await requestJson(path, {}, reqClass, true);
  await fs.writeFile(file, JSON.stringify(data, null, 2));
  const st = await fs.stat(file);
  if (st.size === 0) throw new Error(`Empty response file: ${file}`);
  try {
    JSON.parse(await fs.readFile(file, 'utf8'));
  } catch {
    // strict one-shot refetch + parse retry contract
    const retry = await requestJson(path, {}, reqClass, false);
    await fs.writeFile(file, JSON.stringify(retry, null, 2));
    JSON.parse(await fs.readFile(file, 'utf8'));
  }
  return data;
}

function stripBracketName(v) {
  return String(v || '').trim().replace(/^\[/, '').replace(/\]$/, '').trim();
}

function parseAssignLines(text, createdAt, id, source) {
  if (!text) return [];
  const out = [];
  const re = /^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({
      source,
      targetRaw: m[1],
      target: stripBracketName(m[1]),
      createdAt: createdAt || '',
      id: String(id || ''),
    });
  }
  return out;
}

function compareDirective(a, b) {
  const at = new Date(a.createdAt || 0).getTime();
  const bt = new Date(b.createdAt || 0).getTime();
  if (at !== bt) return at - bt;
  return String(a.id).localeCompare(String(b.id));
}

function has409Line(text) {
  return /^Checkout release requested: 409$/m.test(String(text || ''));
}

const summary = {
  scannedIssues: 0,
  directivesFound: 0,
  reassigned: 0,
  alreadyCorrect: 0,
  invalidTargets: 0,
  noDirective: 0,
  skipped409: 0,
  recoveries: 0,
  recoveryErrors: 0,
  assignmentErrors: 0,
};

const agents = await fetchAndSave(`/api/companies/${COMPANY_ID}/agents`, `${outDir}/agents.json`, 'agents');
const agentsList = Array.isArray(agents) ? agents : (agents.items || agents.data || []);
const agentByName = new Map();
const agentById = new Map();
for (const a of agentsList) {
  if (a?.name) agentByName.set(stripBracketName(a.name), a);
  if (a?.id) agentById.set(a.id, a);
}

// Issues (paginate when applicable)
let allIssues = [];
let page = 1;
for (;;) {
  const suffix = page === 1 ? '' : `&page=${page}`;
  const file = `${outDir}/issues_page_${page}.json`;
  const payload = await fetchAndSave(`/api/companies/${COMPANY_ID}/issues?projectId=${PROJECT_ID}&status=${STATUSES}${suffix}`, file, 'issues');
  const arr = Array.isArray(payload) ? payload : (payload.items || payload.data || []);
  allIssues.push(...arr);

  // pagination detection
  if (Array.isArray(payload)) break;
  const p = payload.pagination || payload.meta || null;
  const hasNext = Boolean(p?.hasNextPage) || (p?.page && p?.totalPages && p.page < p.totalPages);
  if (!hasNext) break;
  page += 1;
}

// De-dup by id
const issueMap = new Map();
for (const it of allIssues) issueMap.set(it.id, it);
allIssues = [...issueMap.values()];
summary.scannedIssues = allIssues.length;

const recoveryCandidates = [];

for (const issue of allIssues) {
  const issueId = issue.id;
  const commentsPath = `/api/issues/${issueId}/comments`;
  const commentsFile = `${outDir}/comments_${issueId}.json`;

  let comments;
  try {
    comments = await fetchAndSave(commentsPath, commentsFile, `comments:${issueId}`);
  } catch (err) {
    summary.assignmentErrors += 1;
    continue;
  }

  const commentList = Array.isArray(comments) ? comments : (comments.items || comments.data || []);

  const has409 = commentList.some(c => has409Line(c.body || c.comment || c.text || ''));
  if (has409) {
    summary.skipped409 += 1;
    recoveryCandidates.push({ issue, comments: commentList });
    continue;
  }

  const directives = [];
  directives.push(...parseAssignLines(issue.description || '', issue.createdAt, issue.id, 'description'));
  for (const c of commentList) {
    directives.push(...parseAssignLines(c.body || c.comment || c.text || '', c.createdAt, c.id, 'comment'));
  }

  if (directives.length === 0) {
    summary.noDirective += 1;
    continue;
  }
  summary.directivesFound += directives.length;
  directives.sort(compareDirective);
  const selected = directives[directives.length - 1];

  const targetAgent = agentByName.get(stripBracketName(selected.target));
  if (!targetAgent?.id) {
    summary.invalidTargets += 1;
    continue;
  }

  if (issue.assigneeAgentId === targetAgent.id) {
    summary.alreadyCorrect += 1;
    continue;
  }

  try {
    await requestJson(`/api/issues/${issueId}`, {
      method: 'PATCH',
      headers: { 'X-Paperclip-Run-Id': RUN_ID },
      body: { assigneeAgentId: targetAgent.id },
    }, `assign:${issueId}`);

    await requestJson(`/api/issues/${issueId}/comments`, {
      method: 'POST',
      headers: { 'X-Paperclip-Run-Id': RUN_ID },
      body: { body: `Assigned to ${targetAgent.name}.` },
    }, `assign-comment:${issueId}`);

    summary.reassigned += 1;
  } catch {
    summary.assignmentErrors += 1;
  }
}

for (const rec of recoveryCandidates) {
  const issue = rec.issue;
  const comments = rec.comments;
  const issueId = issue.id;

  try {
    await requestJson(`/api/issues/${issueId}/comments`, {
      method: 'POST',
      headers: { 'X-Paperclip-Run-Id': RUN_ID },
      body: { body: 'Board: please release checkout for this issue (assignee got 409). See docs/PAPERCLIP_SETUP.md § Release a stuck checkout.' },
    }, `recover-note-old:${issueId}`);

    await requestJson(`/api/issues/${issueId}`, {
      method: 'PATCH',
      headers: { 'X-Paperclip-Run-Id': RUN_ID },
      body: { status: 'cancelled', assigneeAgentId: null },
    }, `recover-cancel:${issueId}`);

    const lines = [];
    for (const c of comments.sort((a,b)=>compareDirective({createdAt:a.createdAt,id:a.id},{createdAt:b.createdAt,id:b.id}))) {
      const name = c.authorAgentId ? (agentById.get(c.authorAgentId)?.name || 'Unknown Agent') : 'User';
      const body = String(c.body || c.comment || c.text || '').trim();
      lines.push(`[${name}]:\n${body}`);
    }

    const separator = '\n\n---\n\nRecovery context from cancelled issue comments:\n\n';
    const newDescription = `${issue.description || ''}${separator}${lines.join('\n\n')}`;

    const directives = [];
    directives.push(...parseAssignLines(issue.description || '', issue.createdAt, issue.id, 'description'));
    for (const c of comments) {
      directives.push(...parseAssignLines(c.body || c.comment || c.text || '', c.createdAt, c.id, 'comment'));
    }
    directives.sort(compareDirective);
    const selected = directives.length ? directives[directives.length - 1] : null;
    const targetAgent = selected ? agentByName.get(stripBracketName(selected.target)) : null;

    const createBody = {
      title: issue.title,
      description: newDescription,
      projectId: issue.projectId || PROJECT_ID,
      goalId: issue.goalId ?? null,
      parentId: issue.parentId ?? null,
      status: 'todo',
      assigneeAgentId: targetAgent?.id || null,
      priority: issue.priority || 'medium',
    };

    const created = await requestJson(`/api/companies/${COMPANY_ID}/issues`, {
      method: 'POST',
      headers: { 'X-Paperclip-Run-Id': RUN_ID },
      body: createBody,
    }, `recover-create:${issueId}`);

    if (created?.id) {
      await requestJson(`/api/issues/${issueId}/comments`, {
        method: 'POST',
        headers: { 'X-Paperclip-Run-Id': RUN_ID },
        body: { body: `Superseded by ${created.identifier || created.id}.` },
      }, `recover-link-old:${issueId}`);

      await requestJson(`/api/issues/${created.id}/comments`, {
        method: 'POST',
        headers: { 'X-Paperclip-Run-Id': RUN_ID },
        body: { body: `Recovery ticket; previous ${issue.identifier || issue.id} stuck (checkout 409) and cancelled.` },
      }, `recover-link-new:${created.id}`);
    }

    summary.recoveries += 1;
  } catch (err) {
    summary.recoveryErrors += 1;
  }
}

// Inbox summary for own work
const me = await fetchAndSave('/api/agents/me', `${outDir}/me_after.json`, 'me');
const myIssues = await fetchAndSave(`/api/companies/${COMPANY_ID}/issues?assigneeAgentId=${me.id}&status=todo,in_progress,blocked`, `${outDir}/my_issues.json`, 'my-issues');
const inbox = Array.isArray(myIssues) ? myIssues : (myIssues.items || myIssues.data || []);

const output = {
  runId: RUN_ID,
  projectId: PROJECT_ID,
  summary,
  inboxCount: inbox.length,
  inbox: inbox.map(i => ({ id: i.id, identifier: i.identifier, status: i.status, title: i.title })),
};

await fs.writeFile(`${outDir}/heartbeat_summary.json`, JSON.stringify(output, null, 2));
console.log(JSON.stringify(output, null, 2));
