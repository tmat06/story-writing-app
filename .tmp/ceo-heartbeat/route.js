const fs = require('fs');
const path = require('path');

const API = process.env.PAPERCLIP_API_URL;
const KEY = process.env.PAPERCLIP_API_KEY;
const COMPANY = process.env.PAPERCLIP_COMPANY_ID;
const RUN = process.env.PAPERCLIP_RUN_ID;
const PROJECT_ID = '9433c050-62e8-4d4a-9dee-a2ccd33d8407';
const TMP = path.resolve('.tmp/ceo-heartbeat');

if (!API || !KEY || !COMPANY || !RUN) {
  console.error('Missing required PAPERCLIP env vars');
  process.exit(1);
}

function sh(cmd) {
  const { execSync } = require('child_process');
  return execSync(cmd, { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
}

function esc(s) {
  return s.replace(/'/g, `'\\''`);
}

function curlToFile(url, outFile, { method = 'GET', data = null, mutate = false } = {}, attempt = 1) {
  const headers = [
    `-H 'Authorization: Bearer ${esc(KEY)}'`,
    `-H 'Content-Type: application/json'`,
  ];
  if (mutate) headers.push(`-H 'X-Paperclip-Run-Id: ${esc(RUN)}'`);
  const dataPart = data ? `--data '${esc(JSON.stringify(data))}'` : '';
  const methodPart = method !== 'GET' ? `-X ${method}` : '';
  const cmd = `curl -sS -D '${esc(outFile + '.headers')}' -o '${esc(outFile)}' ${methodPart} ${headers.join(' ')} ${dataPart} '${esc(url)}'`;
  try {
    sh(cmd);
  } catch (e) {
    if (attempt < 2) {
      return curlToFile(url, outFile, { method, data, mutate }, attempt + 1);
    }
    throw e;
  }
  const headersText = fs.readFileSync(outFile + '.headers', 'utf8');
  const statusMatch = headersText.match(/HTTP\/\d(?:\.\d)?\s+(\d{3})/);
  const status = statusMatch ? Number(statusMatch[1]) : 0;
  if (!fs.existsSync(outFile) || fs.statSync(outFile).size === 0) {
    if (attempt < 2) return curlToFile(url, outFile, { method, data, mutate }, attempt + 1);
    throw new Error(`Empty response for ${url}`);
  }
  if (status === 429 && attempt < 2) {
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 700);
    return curlToFile(url, outFile, { method, data, mutate }, attempt + 1);
  }
  if (status >= 400) {
    if (attempt < 2) return curlToFile(url, outFile, { method, data, mutate }, attempt + 1);
    throw new Error(`HTTP ${status} for ${url}`);
  }
  return status;
}

function readJsonWithRetry(fetchFn, file) {
  try {
    const txt = fs.readFileSync(file, 'utf8');
    if (!txt.trim()) throw new Error('empty');
    return JSON.parse(txt);
  } catch (_) {
    fetchFn();
    const txt2 = fs.readFileSync(file, 'utf8');
    if (!txt2.trim()) throw new Error('empty after retry');
    return JSON.parse(txt2);
  }
}

function normalizeName(s) {
  if (!s) return '';
  return s.trim().replace(/^\[/, '').replace(/\]$/, '').trim();
}

function parseAssignDirectives(text) {
  if (!text) return [];
  const regex = /^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$/gm;
  const out = [];
  let m;
  while ((m = regex.exec(text)) !== null) {
    out.push(normalizeName(m[1]));
  }
  return out;
}

function has409Line(text) {
  if (!text) return false;
  return /^(?:Checkout release requested: 409)$/m.test(text);
}

fs.mkdirSync(TMP, { recursive: true });

const agentsFile = path.join(TMP, 'agents.json');
curlToFile(`${API}/api/companies/${COMPANY}/agents`, agentsFile);
const agentsData = readJsonWithRetry(() => curlToFile(`${API}/api/companies/${COMPANY}/agents`, agentsFile), agentsFile);
const agents = Array.isArray(agentsData) ? agentsData : (agentsData.items || agentsData.data || []);
const agentByName = new Map();
for (const a of agents) agentByName.set((a.name || '').trim(), a);

const issues = [];
let page = 1;
let gotPagination = false;
while (true) {
  const pageFile = path.join(TMP, `issues-page-${page}.json`);
  const url = `${API}/api/companies/${COMPANY}/issues?projectId=${PROJECT_ID}&status=backlog,todo,in_progress,in_review,blocked&page=${page}&limit=50`;
  curlToFile(url, pageFile);
  const payload = readJsonWithRetry(() => curlToFile(url, pageFile), pageFile);
  let items;
  if (Array.isArray(payload)) {
    items = payload;
  } else {
    gotPagination = true;
    items = payload.items || payload.data || [];
  }
  if (!items.length) break;
  issues.push(...items);
  if (Array.isArray(payload)) {
    // If API ignores pagination and returns all items each time, stop after first page.
    break;
  }
  if (payload.nextCursor) {
    page += 1;
    continue;
  }
  if (payload.page && payload.totalPages && payload.page < payload.totalPages) {
    page += 1;
    continue;
  }
  break;
}

const recoveryIssues = [];
let reassigned = 0;
let skippedAlready = 0;
let skippedInvalidTarget = 0;
let skippedNoDirective = 0;
let skipped409 = 0;

for (const issue of issues) {
  const issueId = issue.id;
  const cfile = path.join(TMP, `comments-${issueId}.json`);
  const curlComments = () => curlToFile(`${API}/api/issues/${issueId}/comments`, cfile);
  try {
    curlComments();
  } catch (e) {
    console.error(`comments fetch failed for ${issue.identifier || issueId}: ${e.message}`);
    continue;
  }

  let comments;
  try {
    comments = readJsonWithRetry(curlComments, cfile);
  } catch (e) {
    console.error(`comments parse failed for ${issue.identifier || issueId}, skipped`);
    continue;
  }
  comments = Array.isArray(comments) ? comments : (comments.items || comments.data || []);

  const has409 = comments.some(c => has409Line(c.body || ''));
  if (has409) {
    recoveryIssues.push({ issue, comments });
    skipped409 += 1;
    continue;
  }

  const directives = [];
  const descDirectives = parseAssignDirectives(issue.description || '');
  for (const name of descDirectives) {
    directives.push({ name, createdAt: issue.createdAt || '', id: issue.id + ':desc' });
  }
  for (const c of comments) {
    for (const name of parseAssignDirectives(c.body || '')) {
      directives.push({ name, createdAt: c.createdAt || '', id: String(c.id || '') });
    }
  }

  if (!directives.length) {
    skippedNoDirective += 1;
    continue;
  }

  directives.sort((a, b) => {
    const ta = new Date(a.createdAt).getTime() || 0;
    const tb = new Date(b.createdAt).getTime() || 0;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });

  const chosen = directives[directives.length - 1];
  const target = agentByName.get(normalizeName(chosen.name));
  if (!target) {
    skippedInvalidTarget += 1;
    continue;
  }

  if (issue.assigneeAgentId === target.id) {
    skippedAlready += 1;
    continue;
  }

  const pfile = path.join(TMP, `patch-${issueId}.json`);
  try {
    curlToFile(`${API}/api/issues/${issueId}`, pfile, {
      method: 'PATCH',
      mutate: true,
      data: { assigneeAgentId: target.id }
    });
    reassigned += 1;
  } catch (e) {
    console.error(`assign patch failed for ${issue.identifier || issueId}: ${e.message}`);
    continue;
  }

  const cmfile = path.join(TMP, `assign-comment-${issueId}.json`);
  try {
    curlToFile(`${API}/api/issues/${issueId}/comments`, cmfile, {
      method: 'POST',
      mutate: true,
      data: { body: `Assigned to ${target.name}.` }
    });
  } catch (e) {
    console.error(`assign comment failed for ${issue.identifier || issueId}: ${e.message}`);
  }
}

const idToName = new Map(agents.map(a => [a.id, a.name]));

for (const { issue, comments } of recoveryIssues) {
  const issueId = issue.id;
  const identifier = issue.identifier || issueId;

  const boardBody = 'Board: please release checkout for this issue (assignee got 409). See docs/PAPERCLIP_SETUP.md § Release a stuck checkout.';
  const bfile = path.join(TMP, `recovery-board-comment-${issueId}.json`);
  try {
    curlToFile(`${API}/api/issues/${issueId}/comments`, bfile, {
      method: 'POST',
      mutate: true,
      data: { body: boardBody }
    });
  } catch (e) {
    console.error(`recovery board comment failed for ${identifier}`);
  }

  const cancelFile = path.join(TMP, `recovery-cancel-${issueId}.json`);
  try {
    curlToFile(`${API}/api/issues/${issueId}`, cancelFile, {
      method: 'PATCH',
      mutate: true,
      data: { status: 'cancelled', assigneeAgentId: null }
    });
  } catch (e) {
    console.error(`recovery cancel failed for ${identifier}`);
    continue;
  }

  const sep = '\n\n---\nRecovery context from previous ticket comments:\n';
  const sortedComments = [...comments].sort((a,b)=>{
    const ta = new Date(a.createdAt).getTime()||0;
    const tb = new Date(b.createdAt).getTime()||0;
    if (ta!==tb) return ta-tb;
    return String(a.id||'').localeCompare(String(b.id||''));
  });

  let transcript = '';
  for (const c of sortedComments) {
    const name = c.authorAgentId ? (idToName.get(c.authorAgentId) || 'Unknown Agent') : 'User';
    transcript += `\n[${name}]:\n${c.body || ''}\n`;
  }

  const directives = [];
  for (const d of parseAssignDirectives(issue.description || '')) {
    directives.push({ name: d, createdAt: issue.createdAt || '', id: issue.id + ':desc' });
  }
  for (const c of sortedComments) {
    for (const d of parseAssignDirectives(c.body || '')) {
      directives.push({ name: d, createdAt: c.createdAt || '', id: String(c.id || '') });
    }
  }
  directives.sort((a, b) => {
    const ta = new Date(a.createdAt).getTime() || 0;
    const tb = new Date(b.createdAt).getTime() || 0;
    if (ta !== tb) return ta - tb;
    return String(a.id).localeCompare(String(b.id));
  });
  const last = directives[directives.length - 1];
  const target = last ? agentByName.get(normalizeName(last.name)) : null;

  const createBody = {
    title: issue.title,
    projectId: issue.projectId || PROJECT_ID,
    goalId: issue.goalId || null,
    parentId: issue.parentId || null,
    description: `${issue.description || ''}${sep}${transcript}`,
    status: 'todo',
    assigneeAgentId: target ? target.id : null,
  };

  const createFile = path.join(TMP, `recovery-create-${issueId}.json`);
  let newIssue = null;
  try {
    curlToFile(`${API}/api/companies/${COMPANY}/issues`, createFile, {
      method: 'POST',
      mutate: true,
      data: createBody
    });
    newIssue = JSON.parse(fs.readFileSync(createFile, 'utf8'));
  } catch (e) {
    console.error(`recovery create failed for ${identifier}`);
    continue;
  }

  const oldCommentFile = path.join(TMP, `recovery-old-note-${issueId}.json`);
  try {
    curlToFile(`${API}/api/issues/${issueId}/comments`, oldCommentFile, {
      method: 'POST',
      mutate: true,
      data: { body: `Superseded by ${newIssue.identifier || newIssue.id}.` }
    });
  } catch (_) {}

  const newCommentFile = path.join(TMP, `recovery-new-note-${issueId}.json`);
  try {
    curlToFile(`${API}/api/issues/${newIssue.id}/comments`, newCommentFile, {
      method: 'POST',
      mutate: true,
      data: { body: `Recovery ticket; previous ${identifier} stuck (checkout 409) and cancelled.` }
    });
  } catch (_) {}
}

const summary = {
  scannedIssues: issues.length,
  paginationMode: gotPagination ? 'paginated' : 'single-array',
  reassigned,
  skippedAlready,
  skippedNoDirective,
  skippedInvalidTarget,
  skipped409,
  recoveryProcessed: recoveryIssues.length
};
fs.writeFileSync(path.join(TMP, 'routing-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
