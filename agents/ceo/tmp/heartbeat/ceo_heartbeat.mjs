import fs from 'node:fs/promises';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

const apiUrl = process.env.PAPERCLIP_API_URL;
const apiKey = process.env.PAPERCLIP_API_KEY;
const companyId = process.env.PAPERCLIP_COMPANY_ID;
const runId = process.env.PAPERCLIP_RUN_ID;
const agentId = process.env.PAPERCLIP_AGENT_ID;

if (!apiUrl || !apiKey || !companyId || !runId || !agentId) {
  throw new Error('Missing required PAPERCLIP_* environment variables.');
}

const outDir = path.resolve('agents/ceo/tmp/heartbeat/runtime');
await fs.mkdir(outDir, { recursive: true });

const retriedClasses = new Set();
let reqSeq = 0;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function sanitizeName(raw) {
  return String(raw || '').trim().replace(/^\[(.*)\]$/, '$1').trim();
}

function extractDirectives(text, sourceType, meta) {
  const directives = [];
  const lines = String(text || '').split(/\r?\n/);
  const re = /^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$/;
  for (let i = 0; i < lines.length; i += 1) {
    const m = lines[i].match(re);
    if (!m) continue;
    directives.push({
      targetNameRaw: m[1],
      targetName: sanitizeName(m[1]),
      sourceType,
      sourceId: meta.id,
      createdAt: meta.createdAt,
      line: i + 1,
    });
  }
  return directives;
}

function compareByCreatedAtThenId(a, b) {
  const ta = new Date(a.createdAt || 0).getTime();
  const tb = new Date(b.createdAt || 0).getTime();
  if (ta !== tb) return ta - tb;
  return String(a.sourceId).localeCompare(String(b.sourceId));
}

async function fetchToFile({ endpoint, method = 'GET', body, requestClass, mutate = false, nameHint = 'resp' }) {
  const url = `${apiUrl}${endpoint}`;
  const attempt = retriedClasses.has(requestClass) ? 2 : 1;
  const filePath = path.join(outDir, `${String(reqSeq++).padStart(4, '0')}_${nameHint}_${method.toLowerCase()}.json`);

  const headers = {
    Authorization: `Bearer ${apiKey}`,
    'Content-Type': 'application/json',
  };
  if (mutate) headers['X-Paperclip-Run-Id'] = runId;

  try {
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });

    if (!res.ok) {
      const text = await res.text();
      if ((res.status === 429 || res.status >= 500) && attempt === 1) {
        retriedClasses.add(requestClass);
        await sleep(700);
        return fetchToFile({ endpoint, method, body, requestClass, mutate, nameHint });
      }
      throw new Error(`HTTP ${res.status} for ${endpoint}: ${text.slice(0, 500)}`);
    }

    const text = await res.text();
    await fs.writeFile(filePath, text, 'utf8');
    const stat = await fs.stat(filePath);
    if (!stat.size) {
      throw new Error(`Empty response file for ${endpoint}`);
    }

    return { filePath, status: res.status };
  } catch (err) {
    if (attempt === 1) {
      retriedClasses.add(requestClass);
      await sleep(700);
      return fetchToFile({ endpoint, method, body, requestClass, mutate, nameHint });
    }
    throw err;
  }
}

async function parseJsonFileWithSingleCurlRefetch({ filePath, endpoint, requestClass, nameHint }) {
  const parseOnce = async () => {
    const text = await fs.readFile(filePath, 'utf8');
    if (!text.trim()) throw new Error('Empty file content.');
    return JSON.parse(text);
  };

  try {
    return await parseOnce();
  } catch {
    const curlOutPath = filePath;
    const url = `${apiUrl}${endpoint}`;
    await execFileAsync('curl', [
      '-sS',
      '-f',
      '-H', `Authorization: Bearer ${apiKey}`,
      url,
      '-o', curlOutPath,
    ]);
    const stat = await fs.stat(curlOutPath);
    if (!stat.size) throw new Error(`Retry produced empty payload for ${requestClass}`);
    return parseOnce();
  }
}

async function fetchJson({ endpoint, method = 'GET', body, requestClass, mutate = false, nameHint }) {
  const resp = await fetchToFile({ endpoint, method, body, requestClass, mutate, nameHint });
  const json = await parseJsonFileWithSingleCurlRefetch({
    filePath: resp.filePath,
    endpoint,
    requestClass,
    nameHint,
  });
  return json;
}

async function fetchIssuesPaginated(projectId) {
  const statuses = 'backlog,todo,in_progress,in_review,blocked';
  const all = [];
  let page = 1;
  let cursor = null;

  for (;;) {
    const params = new URLSearchParams({
      projectId,
      status: statuses,
      limit: '100',
    });
    if (cursor) params.set('cursor', cursor);
    else params.set('page', String(page));

    const endpoint = `/api/companies/${companyId}/issues?${params.toString()}`;
    const json = await fetchJson({
      endpoint,
      requestClass: 'issues_list',
      nameHint: `issues_page_${page}`,
    });

    let items = [];
    let next = null;

    if (Array.isArray(json)) {
      items = json;
      all.push(...items);
      break;
    }

    if (json && Array.isArray(json.items)) {
      items = json.items;
      all.push(...items);
      next = json.nextCursor ?? json.cursor?.next ?? json.pagination?.nextCursor ?? null;
      if (!next && json.pagination?.hasMore && typeof json.pagination.page === 'number') {
        page = json.pagination.page + 1;
        continue;
      }
      if (next) {
        cursor = next;
        continue;
      }
      if (items.length === 100) {
        page += 1;
        continue;
      }
      break;
    }

    throw new Error('Unexpected issues list payload format.');
  }

  return all;
}

function detectPingPong(commentDirectives) {
  if (commentDirectives.length < 4) return false;
  const sorted = [...commentDirectives].sort(compareByCreatedAtThenId);
  const last4 = sorted.slice(-4).map((d) => d.targetName);
  return last4[0] === last4[2] && last4[1] === last4[3] && last4[0] !== last4[1];
}

function missingArtifactForTarget(targetName) {
  switch (targetName) {
    case 'Design': return 'design brief';
    case 'Founding Engineer': return 'plan revision';
    case 'Code Monkey': return 'plan revision';
    case 'Code Reviewer': return 'test evidence';
    case 'Market Research': return 'differentiation recommendation';
    default: return 'review finding';
  }
}

const summary = {
  scanned: 0,
  reassigned: 0,
  alreadyCorrect: 0,
  noDirective: 0,
  invalidTarget: 0,
  skippedIssueFailures: 0,
  pingPongComments: 0,
};

const me = await fetchJson({
  endpoint: '/api/agents/me',
  requestClass: 'identity',
  nameHint: 'agents_me',
});

const projects = await fetchJson({
  endpoint: `/api/companies/${companyId}/projects`,
  requestClass: 'projects',
  nameHint: 'projects',
});

const project = (Array.isArray(projects) ? projects : []).find((p) => {
  const n = String(p?.name || '').toLowerCase();
  const key = String(p?.urlKey || '').toLowerCase();
  const ws = Array.isArray(p?.workspaces) ? p.workspaces : [];
  return n.includes('story writing app') || key === 'story-writing-app' || ws.some((w) => String(w?.name || '').includes('story-writing-app'));
});
if (!project) throw new Error('Story Writing App project not found.');

const agents = await fetchJson({
  endpoint: `/api/companies/${companyId}/agents`,
  requestClass: 'agents',
  nameHint: 'agents',
});

const activeAgents = (Array.isArray(agents) ? agents : []).filter((a) => {
  const st = String(a?.status || '').toLowerCase();
  return st !== 'terminated' && st !== 'deleted' && st !== 'archived';
});

const agentByExactName = new Map(activeAgents.map((a) => [String(a.name).trim(), a]));

const issues = await fetchIssuesPaginated(project.id);

for (const issue of issues) {
  summary.scanned += 1;

  let comments;
  try {
    comments = await fetchJson({
      endpoint: `/api/issues/${issue.id}/comments`,
      requestClass: 'comments_per_issue',
      nameHint: `comments_${issue.identifier || issue.id}`,
    });
  } catch {
    summary.skippedIssueFailures += 1;
    continue;
  }

  const commentArray = Array.isArray(comments) ? comments : [];
  const commentDirectives = [];
  for (const c of commentArray) {
    const body = c.body ?? c.comment ?? c.text ?? '';
    commentDirectives.push(...extractDirectives(body, 'comment', { id: c.id, createdAt: c.createdAt }));
  }

  const descriptionDirectives = extractDirectives(issue.description || '', 'description', {
    id: issue.id,
    createdAt: issue.createdAt,
  });

  const selectedPool = commentDirectives.length > 0 ? commentDirectives : descriptionDirectives;
  if (selectedPool.length === 0) {
    summary.noDirective += 1;
    continue;
  }

  const sorted = [...selectedPool].sort(compareByCreatedAtThenId);
  const winner = sorted[sorted.length - 1];

  const target = agentByExactName.get(sanitizeName(winner.targetName));
  if (!target) {
    summary.invalidTarget += 1;
    continue;
  }

  if (issue.assigneeAgentId === target.id) {
    summary.alreadyCorrect += 1;
    continue;
  }

  const pingPong = detectPingPong(commentDirectives);
  if (pingPong) {
    const artifact = missingArtifactForTarget(target.name);
    await fetchJson({
      endpoint: `/api/issues/${issue.id}/comments`,
      method: 'POST',
      body: {
        body: `Clarification before reassignment: missing artifact is **${artifact}**. Please attach it in this ticket before the next handoff to reduce assignment churn.`,
      },
      requestClass: 'mutate_comment',
      mutate: true,
      nameHint: `pingpong_${issue.identifier || issue.id}`,
    });
    summary.pingPongComments += 1;
  }

  await fetchJson({
    endpoint: `/api/issues/${issue.id}`,
    method: 'PATCH',
    body: { assigneeAgentId: target.id },
    requestClass: 'mutate_patch',
    mutate: true,
    nameHint: `patch_${issue.identifier || issue.id}`,
  });

  await fetchJson({
    endpoint: `/api/issues/${issue.id}/comments`,
    method: 'POST',
    body: { body: `Assigned to ${target.name}.` },
    requestClass: 'mutate_comment',
    mutate: true,
    nameHint: `assign_comment_${issue.identifier || issue.id}`,
  });

  summary.reassigned += 1;
}

const inbox = await fetchJson({
  endpoint: `/api/companies/${companyId}/issues?assigneeAgentId=${agentId}&status=todo,in_progress,blocked`,
  requestClass: 'inbox',
  nameHint: 'inbox',
});

const approvalId = process.env.PAPERCLIP_APPROVAL_ID || null;
let approvalSummary = 'none';
if (approvalId) {
  approvalSummary = `pending follow-up for ${approvalId}`;
}

const output = {
  runId,
  wakeReason: process.env.PAPERCLIP_WAKE_REASON || null,
  me: {
    id: me.id,
    name: me.name,
    role: me.role,
  },
  project: {
    id: project.id,
    name: project.name,
  },
  routing: summary,
  inboxCount: Array.isArray(inbox) ? inbox.length : Array.isArray(inbox?.items) ? inbox.items.length : 0,
  inboxIssues: (Array.isArray(inbox) ? inbox : Array.isArray(inbox?.items) ? inbox.items : []).map((i) => ({
    identifier: i.identifier,
    status: i.status,
    assigneeAgentId: i.assigneeAgentId,
  })),
  approvalSummary,
};

const summaryPath = path.join(outDir, `heartbeat_summary_${runId}.json`);
await fs.writeFile(summaryPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');

console.log(JSON.stringify(output, null, 2));
console.log(`SUMMARY_PATH=${summaryPath}`);
