const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const API = process.env.PAPERCLIP_API_URL;
const KEY = process.env.PAPERCLIP_API_KEY;
const COMPANY = process.env.PAPERCLIP_COMPANY_ID;
const AGENT_ID = process.env.PAPERCLIP_AGENT_ID;
const RUN_ID = process.env.PAPERCLIP_RUN_ID;

if (!API || !KEY || !COMPANY || !AGENT_ID || !RUN_ID) {
  console.error('Missing required PAPERCLIP env vars');
  process.exit(1);
}

const outDir = path.resolve('.tmp/ceo-heartbeat');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

function sh(cmd) {
  return execSync(cmd, { stdio: ['ignore', 'pipe', 'pipe'] }).toString();
}

function esc(s) {
  return `'${String(s).replace(/'/g, `'"'"'`)}'`;
}

function request(method, endpoint, outFile, bodyObj = null, mutate = false) {
  const url = `${API}${endpoint}`;
  const hdrs = [`-H ${esc(`Authorization: Bearer ${KEY}`)}`, `-H ${esc('Content-Type: application/json')}`];
  if (mutate) hdrs.push(`-H ${esc(`X-Paperclip-Run-Id: ${RUN_ID}`)}`);
  const bodyPart = bodyObj === null ? '' : `--data ${esc(JSON.stringify(bodyObj))}`;
  const target = path.join(outDir, outFile);

  const cmd = `curl -sS -f -X ${method} ${hdrs.join(' ')} ${bodyPart} ${esc(url)} -o ${esc(target)}`;
  try {
    sh(cmd);
  } catch (e) {
    const stderr = String(e.stderr || e.message || '');
    const transient = /429|rate|timed out|timeout|Failed to connect|Connection reset|cancel/i.test(stderr);
    if (!transient) throw e;
    sh(cmd); // one retry
  }

  const stat = fs.statSync(target);
  if (!stat || stat.size === 0) throw new Error(`Empty response for ${method} ${endpoint}`);

  try {
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  } catch (_) {
    // strict sequential refetch once on parse failure
    sh(cmd);
    const stat2 = fs.statSync(target);
    if (!stat2 || stat2.size === 0) throw new Error(`Empty response after retry for ${method} ${endpoint}`);
    return JSON.parse(fs.readFileSync(target, 'utf8'));
  }
}

function asArray(resp) {
  if (Array.isArray(resp)) return resp;
  if (Array.isArray(resp.items)) return resp.items;
  if (Array.isArray(resp.data)) return resp.data;
  return [];
}

function getIssueId(issue) {
  return issue.id || issue.identifier;
}

function normalizeTarget(raw) {
  if (!raw) return '';
  let t = String(raw).trim();
  if (t.startsWith('[') && t.endsWith(']')) t = t.slice(1, -1).trim();
  return t;
}

function extractAssignDirectives(text, createdAt = '', id = '') {
  const out = [];
  if (!text) return out;
  const re = /^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$/gm;
  let m;
  while ((m = re.exec(text)) !== null) {
    out.push({ target: normalizeTarget(m[1]), createdAt: createdAt || '', id: String(id || '') });
  }
  return out;
}

function hasCheckout409(comments) {
  return comments.some(c => /^Checkout release requested: 409$/m.test(c.body || ''));
}

function getAuthorLabel(c, agentsById) {
  if (c.authorAgentId && agentsById[c.authorAgentId]) return `[${agentsById[c.authorAgentId].name}]:`;
  return '[User]:';
}

function chronological(a, b) {
  const ta = new Date(a.createdAt || 0).getTime();
  const tb = new Date(b.createdAt || 0).getTime();
  if (ta !== tb) return ta - tb;
  return String(a.id || '').localeCompare(String(b.id || ''));
}

const summary = {
  scannedIssues: 0,
  reassigned: 0,
  alreadyCorrect: 0,
  noDirective: 0,
  invalidTarget: 0,
  skipped409: 0,
  recoveries: 0,
  recoveryFailures: 0,
  assignmentErrors: 0,
  inbox: { in_progress: 0, todo: 0, blocked: 0 },
  notes: [],
};

const me = request('GET', '/api/agents/me', 'me.json');

const agentsResp = request('GET', `/api/companies/${COMPANY}/agents`, 'agents.json');
const agents = asArray(agentsResp).filter(a => a && (a.active !== false) && !a.deletedAt);
const agentsByName = {};
const agentsById = {};
for (const a of agents) {
  agentsByName[String(a.name || '').trim()] = a;
  agentsById[a.id] = a;
}

const projectsResp = request('GET', `/api/companies/${COMPANY}/projects`, 'projects.json');
const projects = asArray(projectsResp);
const normalize = (v) => String(v || '').toLowerCase().replace(/[^a-z0-9]/g, '');
let project = projects.find(p => normalize(p.urlKey) === 'storywritingapp');
if (!project) {
  project = projects.find(p => normalize(p.name) === 'storywritingapp');
}
if (!project) {
  project = projects.find(p => {
    const primary = p.primaryWorkspace || {};
    const workspaces = Array.isArray(p.workspaces) ? p.workspaces : [];
    const all = [primary, ...workspaces];
    return all.some(w => String(w.cwd || '').toLowerCase().includes('/users/tim/code/story-writing-app'));
  });
}
if (!project) {
  throw new Error('Could not find project story-writing-app');
}

// Paginate full active-status issue list
const wantedStatuses = 'backlog,todo,in_progress,in_review,blocked';
const allIssues = [];
let page = 0;
let stop = false;
while (!stop) {
  const ep = `/api/companies/${COMPANY}/issues?projectId=${project.id}&status=${encodeURIComponent(wantedStatuses)}&page=${page}&pageSize=100`;
  const resp = request('GET', ep, `issues-page-${page}.json`);
  const items = asArray(resp);
  if (items.length === 0) break;
  allIssues.push(...items);

  if (resp.pagination && typeof resp.pagination.page === 'number' && typeof resp.pagination.totalPages === 'number') {
    stop = resp.pagination.page >= resp.pagination.totalPages;
  } else if (resp.meta && typeof resp.meta.page === 'number' && typeof resp.meta.totalPages === 'number') {
    stop = resp.meta.page >= resp.meta.totalPages;
  } else if (items.length < 100) {
    stop = true;
  }
  page += 1;
}

summary.scannedIssues = allIssues.length;

const recoveryCandidates = [];

for (const issue of allIssues) {
  const issueId = getIssueId(issue);
  const issueIdent = issue.identifier || issueId;
  const commentsFile = `comments-${issueId}.json`;

  let comments;
  try {
    comments = asArray(request('GET', `/api/issues/${issueId}/comments`, commentsFile));
  } catch (e) {
    summary.notes.push(`Skipped ${issueIdent}: comment fetch/parse failed`);
    continue;
  }

  comments.sort(chronological);
  const contains409 = hasCheckout409(comments);
  if (contains409) {
    summary.skipped409 += 1;
    recoveryCandidates.push({ issue, comments });
    continue; // do not assign old issue
  }

  const descriptionDirectives = extractAssignDirectives(issue.description || '', issue.createdAt || '', issue.id || '');
  const commentDirectives = [];
  for (const c of comments) commentDirectives.push(...extractAssignDirectives(c.body || '', c.createdAt || '', c.id || ''));

  const source = commentDirectives.length > 0 ? commentDirectives : descriptionDirectives;
  if (source.length === 0) {
    summary.noDirective += 1;
    continue;
  }

  source.sort((a, b) => {
    const tA = new Date(a.createdAt || 0).getTime();
    const tB = new Date(b.createdAt || 0).getTime();
    if (tA !== tB) return tA - tB;
    return String(a.id).localeCompare(String(b.id));
  });

  const chosen = source[source.length - 1];
  const targetName = normalizeTarget(chosen.target);
  const targetAgent = agentsByName[targetName];

  if (!targetAgent) {
    summary.invalidTarget += 1;
    summary.notes.push(`Issue ${issueIdent}: invalid Assign to target '${targetName}'`);
    continue;
  }

  if (issue.assigneeAgentId === targetAgent.id) {
    summary.alreadyCorrect += 1;
    continue;
  }

  try {
    request('PATCH', `/api/issues/${issueId}`, `patch-assign-${issueId}.json`, { assigneeAgentId: targetAgent.id }, true);
    request('POST', `/api/issues/${issueId}/comments`, `comment-assign-${issueId}.json`, { body: `Assigned to ${targetAgent.name}.` }, true);
    summary.reassigned += 1;
  } catch (e) {
    summary.assignmentErrors += 1;
    summary.notes.push(`Issue ${issueIdent}: assignment patch/comment failed`);
  }
}

for (const item of recoveryCandidates) {
  const { issue, comments } = item;
  const issueId = getIssueId(issue);
  const issueIdent = issue.identifier || issueId;
  try {
    request(
      'POST',
      `/api/issues/${issueId}/comments`,
      `recovery-note-old-${issueId}.json`,
      { body: 'Board: please release checkout for this issue (assignee got 409). See docs/PAPERCLIP_SETUP.md § Release a stuck checkout.' },
      true,
    );

    request('PATCH', `/api/issues/${issueId}`, `recovery-cancel-${issueId}.json`, { status: 'cancelled', assigneeAgentId: null }, true);

    const descDirectives = extractAssignDirectives(issue.description || '', issue.createdAt || '', issue.id || '');
    const comDirectives = [];
    for (const c of comments) comDirectives.push(...extractAssignDirectives(c.body || '', c.createdAt || '', c.id || ''));
    const directives = [...descDirectives, ...comDirectives].sort((a, b) => {
      const tA = new Date(a.createdAt || 0).getTime();
      const tB = new Date(b.createdAt || 0).getTime();
      if (tA !== tB) return tA - tB;
      return String(a.id).localeCompare(String(b.id));
    });
    const lastDirective = directives.length ? directives[directives.length - 1] : null;
    const targetAgent = lastDirective ? agentsByName[normalizeTarget(lastDirective.target)] : null;

    const commentsChrono = [...comments].sort(chronological);
    const blocks = commentsChrono.map(c => `${getAuthorLabel(c, agentsById)}\n${(c.body || '').trim()}`);
    const originalDesc = (issue.description || '').trim();
    const combinedDescription = `${originalDesc}\n\n---\n\n## Context from previous issue\n\n${blocks.join('\n\n')}`;

    const createBody = {
      title: issue.title,
      description: combinedDescription,
      projectId: issue.projectId,
      goalId: issue.goalId || null,
      parentId: issue.parentId || null,
      status: 'todo',
      assigneeAgentId: targetAgent ? targetAgent.id : null,
    };

    const created = request('POST', `/api/companies/${COMPANY}/issues`, `recovery-create-${issueId}.json`, createBody, true);
    const newIssueId = getIssueId(created);
    const newIdent = created.identifier || newIssueId;

    request('POST', `/api/issues/${issueId}/comments`, `recovery-superseded-old-${issueId}.json`, { body: `Superseded by ${newIdent}.` }, true);
    request('POST', `/api/issues/${newIssueId}/comments`, `recovery-note-new-${newIssueId}.json`, { body: `Recovery ticket; previous ${issueIdent} stuck (checkout 409) and cancelled.` }, true);

    summary.recoveries += 1;
  } catch (e) {
    summary.recoveryFailures += 1;
    summary.notes.push(`Recovery failed for ${issueIdent}: ${String(e.message || e)}`);
  }
}

const inboxResp = request('GET', `/api/companies/${COMPANY}/issues?assigneeAgentId=${AGENT_ID}&status=todo,in_progress,blocked`, 'my-inbox.json');
const inbox = asArray(inboxResp);
for (const i of inbox) {
  const s = i.status;
  if (s === 'in_progress') summary.inbox.in_progress += 1;
  if (s === 'todo') summary.inbox.todo += 1;
  if (s === 'blocked') summary.inbox.blocked += 1;
}

const result = {
  runId: RUN_ID,
  wakeReason: process.env.PAPERCLIP_WAKE_REASON || null,
  me: { id: me.id, name: me.name, role: me.role },
  project: { id: project.id, name: project.name },
  summary,
  inbox: inbox.map(i => ({ id: i.id, identifier: i.identifier, title: i.title, status: i.status, assigneeAgentId: i.assigneeAgentId })),
};

fs.writeFileSync(path.join(outDir, 'result.json'), JSON.stringify(result, null, 2));
console.log(JSON.stringify(result, null, 2));
