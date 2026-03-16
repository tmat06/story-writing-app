import fs from 'fs';
import path from 'path';
import { execFileSync } from 'child_process';

const API_URL = process.env.PAPERCLIP_API_URL;
const API_KEY = process.env.PAPERCLIP_API_KEY;
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID;
const RUN_ID = process.env.PAPERCLIP_RUN_ID;

if (!API_URL || !API_KEY || !COMPANY_ID || !RUN_ID) {
  console.error('Missing required PAPERCLIP_* env vars');
  process.exit(1);
}

const now = new Date();
const stamp = `${now.toISOString().slice(0, 10)}_${now.toISOString().slice(11, 19).replace(/:/g, '')}`;
const outDir = path.join(process.cwd(), 'agents/ceo/tmp', `heartbeat_${stamp}_strict`);
fs.mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function stripBracketsAndTrim(value) {
  const t = String(value || '').trim();
  if (t.startsWith('[') && t.endsWith(']')) return t.slice(1, -1).trim();
  return t;
}

function extractDirectives(text) {
  const body = String(text || '');
  const regex = /^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$/gm;
  const out = [];
  let m;
  while ((m = regex.exec(body)) !== null) {
    out.push(stripBracketsAndTrim(m[1]));
  }
  return out;
}

function hasCheckout409Line(text) {
  const lines = String(text || '').split(/\r?\n/);
  return lines.includes('Checkout release requested: 409');
}

function parseDateMs(v, fallback = 0) {
  const ms = Date.parse(v || '');
  return Number.isFinite(ms) ? ms : fallback;
}

function writeFile(name, text) {
  const p = path.join(outDir, name);
  fs.writeFileSync(p, text, 'utf8');
  return p;
}

function curlRequest(relPath, method = 'GET', bodyObj = null, mutate = false) {
  const url = `${API_URL}${relPath}`;
  const args = ['-sS', '-D', '-', '-X', method, url, '-H', `Authorization: Bearer ${API_KEY}`];
  if (mutate) args.push('-H', `X-Paperclip-Run-Id: ${RUN_ID}`);
  if (bodyObj !== null) {
    args.push('-H', 'Content-Type: application/json');
    args.push('--data-binary', JSON.stringify(bodyObj));
  }
  const raw = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });

  // split headers/body using first blank line from curl -D -
  const splitIdx = raw.indexOf('\r\n\r\n') >= 0 ? raw.indexOf('\r\n\r\n') : raw.indexOf('\n\n');
  const headerText = splitIdx >= 0 ? raw.slice(0, splitIdx) : '';
  const bodyText = splitIdx >= 0 ? raw.slice(splitIdx + (raw.includes('\r\n\r\n') ? 4 : 2)) : raw;

  const statusMatch = headerText.match(/HTTP\/\d(?:\.\d)?\s+(\d{3})/);
  const status = statusMatch ? Number(statusMatch[1]) : 0;

  return { status, bodyText, headerText };
}

async function requestJson(label, relPath, { method = 'GET', body = null, mutate = false } = {}) {
  const fileBase = `${label}.json`;

  // attempt 1
  let first;
  try {
    first = curlRequest(relPath, method, body, mutate);
  } catch (err) {
    // transport failure: retry once after short backoff
    await sleep(350);
    first = null;
  }

  const handle = (resp, suffix = '') => {
    if (!resp) return null;
    const file = writeFile(fileBase.replace('.json', `${suffix}.json`), resp.bodyText || '');
    if (!resp.bodyText || !resp.bodyText.trim()) {
      return { ok: false, file, error: 'empty body', status: resp.status };
    }
    let parsed;
    try {
      parsed = JSON.parse(resp.bodyText);
    } catch (e) {
      return { ok: false, file, error: `parse failure: ${e.message}`, status: resp.status };
    }
    if (resp.status >= 400 || resp.status === 0) {
      return { ok: false, file, error: `http ${resp.status}`, status: resp.status, parsed };
    }
    return { ok: true, file, parsed, status: resp.status };
  };

  let result = handle(first, '_attempt1');

  const shouldRetry = !result || !result.ok;
  if (!shouldRetry) return result;

  const status = result?.status || 0;
  const retryable = status === 429 || status >= 500 || status === 0 || String(result?.error || '').includes('parse failure') || String(result?.error || '').includes('empty body');
  if (!retryable) return result;

  await sleep(450);

  // strict retry using curl -sS -f (as required)
  try {
    const url = `${API_URL}${relPath}`;
    const args = ['-sS', '-f', '-X', method, url, '-H', `Authorization: Bearer ${API_KEY}`];
    if (mutate) args.push('-H', `X-Paperclip-Run-Id: ${RUN_ID}`);
    if (body !== null) {
      args.push('-H', 'Content-Type: application/json');
      args.push('--data-binary', JSON.stringify(body));
    }
    const bodyText = execFileSync('curl', args, { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    const file = writeFile(fileBase.replace('.json', '_attempt2.json'), bodyText || '');
    if (!bodyText || !bodyText.trim()) return { ok: false, file, error: 'empty body retry', status: 0 };
    let parsed;
    try {
      parsed = JSON.parse(bodyText);
    } catch (e) {
      return { ok: false, file, error: `parse failure retry: ${e.message}`, status: 0 };
    }
    return { ok: true, file, parsed, status: 200 };
  } catch (e) {
    return result;
  }
}

function sortByCreatedAtId(a, b) {
  const ac = parseDateMs(a.createdAt, 0);
  const bc = parseDateMs(b.createdAt, 0);
  if (ac !== bc) return ac - bc;
  const ai = Number(a.id) || 0;
  const bi = Number(b.id) || 0;
  return ai - bi;
}

function buildCommentsTranscript(issue, comments, agentById) {
  const ordered = [...comments].sort(sortByCreatedAtId);
  const blocks = ordered.map((c) => {
    let name = '[User]';
    if (c.authorAgentId && agentById.has(c.authorAgentId)) {
      name = `[${agentById.get(c.authorAgentId).name}]`;
    }
    const body = String(c.body || '').trim();
    return `${name}:\n${body}`;
  });

  const base = String(issue.description || '').trim();
  const sep = '\n\n---\n\nRecovered from cancelled issue due to checkout 409. Prior discussion:\n\n';
  return `${base}${sep}${blocks.join('\n\n')}`.trim();
}

function chooseDirective(issue, comments) {
  const descDirectives = extractDirectives(issue.description || '').map((target) => ({
    source: 'description',
    target,
    createdAt: issue.createdAt,
    id: '0',
  }));

  const commentDirectives = [];
  for (const c of comments) {
    const m = extractDirectives(c.body || '');
    for (const target of m) {
      commentDirectives.push({
        source: 'comment',
        target,
        createdAt: c.createdAt,
        id: c.id,
      });
    }
  }

  let pool = commentDirectives.length > 0 ? commentDirectives : descDirectives;
  if (pool.length === 0) return null;
  pool = pool.sort(sortByCreatedAtId);
  return pool[pool.length - 1];
}

async function fetchPaged(relPathBase, labelPrefix) {
  const all = [];
  let page = 1;
  const seenIds = new Set();
  while (true) {
    const rel = relPathBase.includes('?') ? `${relPathBase}&page=${page}` : `${relPathBase}?page=${page}`;
    const res = await requestJson(`${labelPrefix}_page_${page}`, rel);
    if (!res?.ok) {
      return { ok: false, error: res?.error || 'paged request failed', items: all };
    }

    const parsed = res.parsed;
    const items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : []);

    if (!items.length) break;

    let newCount = 0;
    for (const it of items) {
      const key = it?.id || JSON.stringify(it);
      if (!seenIds.has(key)) {
        seenIds.add(key);
        all.push(it);
        newCount += 1;
      }
    }

    if (newCount === 0) break;

    if (!Array.isArray(parsed)) {
      const totalPages = Number(parsed?.totalPages || parsed?.pages || 0);
      const hasNext = Boolean(parsed?.hasNextPage) || (totalPages > 0 && page < totalPages);
      if (!hasNext) break;
    }

    page += 1;
  }
  return { ok: true, items: all };
}

async function main() {
  const summary = {
    runId: RUN_ID,
    generatedAt: new Date().toISOString(),
    outDir,
    projectId: null,
    projectName: null,
    totalIssuesScanned: 0,
    assigned: 0,
    skippedAlreadyAssigned: 0,
    skippedNoDirective: 0,
    skippedInvalidDirective: 0,
    skipped409Recovery: 0,
    cloneCancelCount: 0,
    cloneCancelFailures: 0,
    pingPongComments: 0,
    failures: [],
    assignmentChanges: [],
    recoveries: [],
    inboxCount: 0,
    inbox: [],
  };

  const meRes = await requestJson('agents_me', '/api/agents/me');
  if (!meRes?.ok) throw new Error(`agents/me failed: ${meRes?.error}`);
  const myAgentId = meRes.parsed.id;

  const projectsRes = await fetchPaged(`/api/companies/${COMPANY_ID}/projects`, 'projects');
  if (!projectsRes.ok) throw new Error(`projects fetch failed: ${projectsRes.error}`);

  const projects = projectsRes.items;
  const project = projects.find((p) => {
    const name = String(p?.name || '').toLowerCase();
    const pws = p?.primaryWorkspace || {};
    const cwd = String(pws.cwd || '').toLowerCase();
    const repo = String(pws.repoUrl || '').toLowerCase();
    const ws = Array.isArray(p?.workspaces) ? p.workspaces : [];
    const wsHit = ws.some((w) => {
      const wcwd = String(w?.cwd || '').toLowerCase();
      const wrepo = String(w?.repoUrl || '').toLowerCase();
      const wname = String(w?.name || '').toLowerCase();
      return wcwd.includes('story-writing-app') || wrepo.includes('story-writing-app') || wname.includes('story-writing-app');
    });
    return name.includes('story-writing-app') || cwd.includes('story-writing-app') || repo.includes('story-writing-app') || wsHit;
  });

  if (!project?.id) throw new Error('Could not find story-writing-app project');
  summary.projectId = project.id;
  summary.projectName = project.name;

  const agentsRes = await fetchPaged(`/api/companies/${COMPANY_ID}/agents`, 'agents');
  if (!agentsRes.ok) throw new Error(`agents fetch failed: ${agentsRes.error}`);
  const activeAgents = agentsRes.items.filter((a) => !a.deletedAt && !a.archivedAt);
  const agentNameMap = new Map();
  const agentById = new Map();
  for (const a of activeAgents) {
    const key = stripBracketsAndTrim(a.name || '');
    if (key) agentNameMap.set(key, a);
    if (a.id) agentById.set(a.id, a);
  }

  const statuses = 'backlog,todo,in_progress,in_review,blocked';
  const issuesRes = await fetchPaged(`/api/companies/${COMPANY_ID}/issues?projectId=${encodeURIComponent(project.id)}&status=${encodeURIComponent(statuses)}`, 'issues');
  if (!issuesRes.ok) throw new Error(`issues fetch failed: ${issuesRes.error}`);
  const issues = issuesRes.items;
  summary.totalIssuesScanned = issues.length;

  const issueContext = new Map();
  const recoveryIssueIds = new Set();

  for (const issue of issues) {
    const key = issue.identifier || issue.id;
    const commentsRes = await fetchPaged(`/api/issues/${issue.id}/comments`, `comments_${key}`);
    if (!commentsRes.ok) {
      summary.failures.push({ issue: key, stage: 'comments', error: commentsRes.error });
      continue;
    }
    const comments = commentsRes.items;

    const has409 = comments.some((c) => hasCheckout409Line(c.body || ''));
    if (has409) recoveryIssueIds.add(issue.id);

    issueContext.set(issue.id, { issue, comments, has409 });

    if (has409) {
      summary.skipped409Recovery += 1;
      continue;
    }

    const chosen = chooseDirective(issue, comments);
    if (!chosen) {
      summary.skippedNoDirective += 1;
      continue;
    }

    const targetName = stripBracketsAndTrim(chosen.target);
    const target = agentNameMap.get(targetName);
    if (!target?.id) {
      summary.skippedInvalidDirective += 1;
      continue;
    }

    if (issue.assigneeAgentId === target.id) {
      summary.skippedAlreadyAssigned += 1;
      continue;
    }

    // Ping-pong detection in last 8 directives for same issue
    const allDirectives = [];
    for (const d of extractDirectives(issue.description || '')) {
      allDirectives.push({ source: 'description', target: d, createdAt: issue.createdAt, id: '0' });
    }
    for (const c of comments) {
      const list = extractDirectives(c.body || '');
      for (const d of list) allDirectives.push({ source: 'comment', target: d, createdAt: c.createdAt, id: c.id });
    }
    allDirectives.sort(sortByCreatedAtId);
    const tail = allDirectives.slice(-8).map((d) => stripBracketsAndTrim(d.target));
    const uniq = new Set(tail);
    const pingPong = tail.length >= 4 && uniq.size <= 2;
    if (pingPong) {
      const clarification = 'Routing clarification: repeated reassignment detected. Missing artifact required before next handoff: explicit review findings with severity labels and required plan revision or test evidence. Post that artifact, then add a single `Assign to:` line.';
      const cRes = await requestJson(`pingpong_comment_${key}`, `/api/issues/${issue.id}/comments`, {
        method: 'POST',
        body: { body: clarification },
        mutate: true,
      });
      if (cRes?.ok) summary.pingPongComments += 1;
      else summary.failures.push({ issue: key, stage: 'pingpong-comment', error: cRes?.error || 'failed' });
    }

    const pRes = await requestJson(`patch_assign_${key}`, `/api/issues/${issue.id}`, {
      method: 'PATCH',
      body: { assigneeAgentId: target.id },
      mutate: true,
    });
    if (!pRes?.ok) {
      summary.failures.push({ issue: key, stage: 'assign-patch', error: pRes?.error || 'failed' });
      continue;
    }

    const cRes = await requestJson(`assign_comment_${key}`, `/api/issues/${issue.id}/comments`, {
      method: 'POST',
      body: { body: `Assigned to ${target.name}.` },
      mutate: true,
    });
    if (!cRes?.ok) {
      summary.failures.push({ issue: key, stage: 'assign-comment', error: cRes?.error || 'failed' });
    }

    summary.assigned += 1;
    summary.assignmentChanges.push({ issue: key, to: target.name });
  }

  for (const issueId of recoveryIssueIds) {
    const ctx = issueContext.get(issueId);
    if (!ctx) continue;
    const issue = ctx.issue;
    const comments = ctx.comments;
    const issueKey = issue.identifier || issue.id;

    // 1) board comment on old issue
    const boardComment = 'Board: please release checkout for this issue (assignee got 409). See docs/PAPERCLIP_SETUP.md § Release a stuck checkout.';
    const step1 = await requestJson(`recovery_board_comment_${issueKey}`, `/api/issues/${issue.id}/comments`, {
      method: 'POST',
      body: { body: boardComment },
      mutate: true,
    });
    if (!step1?.ok) {
      summary.cloneCancelFailures += 1;
      summary.failures.push({ issue: issueKey, stage: 'recovery-step1-comment', error: step1?.error || 'failed' });
      continue;
    }

    // 2) cancel + unassign old issue
    const step2 = await requestJson(`recovery_cancel_${issueKey}`, `/api/issues/${issue.id}`, {
      method: 'PATCH',
      body: { status: 'cancelled', assigneeAgentId: null },
      mutate: true,
    });
    if (!step2?.ok) {
      summary.cloneCancelFailures += 1;
      summary.failures.push({ issue: issueKey, stage: 'recovery-step2-cancel', error: step2?.error || 'failed' });
      continue;
    }

    // 3) create replacement issue with transcript description
    const desc = buildCommentsTranscript(issue, comments, agentById);

    // 4) determine last valid Assign to for new assignee
    const chosen = chooseDirective(issue, comments);
    let newAssigneeId = null;
    let newAssigneeName = null;
    if (chosen) {
      const tName = stripBracketsAndTrim(chosen.target);
      const target = agentNameMap.get(tName);
      if (target?.id) {
        newAssigneeId = target.id;
        newAssigneeName = target.name;
      }
    }

    const createBody = {
      title: issue.title,
      description: desc,
      projectId: issue.projectId || project.id,
      goalId: issue.goalId || null,
      parentId: issue.parentId || null,
      status: 'todo',
      assigneeAgentId: newAssigneeId,
      priority: issue.priority || undefined,
    };

    const step3 = await requestJson(`recovery_create_${issueKey}`, `/api/companies/${COMPANY_ID}/issues`, {
      method: 'POST',
      body: createBody,
      mutate: true,
    });
    if (!step3?.ok) {
      summary.cloneCancelFailures += 1;
      summary.failures.push({ issue: issueKey, stage: 'recovery-step3-create', error: step3?.error || 'failed' });
      continue;
    }

    const newIssue = step3.parsed;
    const newIssueId = newIssue?.id;
    const newIssueKey = newIssue?.identifier || newIssueId;

    // 5) optional comments linking old/new
    await requestJson(`recovery_old_superseded_${issueKey}`, `/api/issues/${issue.id}/comments`, {
      method: 'POST',
      body: { body: `Superseded by ${newIssueKey}.` },
      mutate: true,
    });

    await requestJson(`recovery_new_comment_${newIssueKey}`, `/api/issues/${newIssueId}/comments`, {
      method: 'POST',
      body: { body: `Recovery ticket; previous ${issueKey} stuck (checkout 409) and cancelled.` },
      mutate: true,
    });

    summary.cloneCancelCount += 1;
    summary.recoveries.push({ oldIssue: issueKey, newIssue: newIssueKey, reassignedTo: newAssigneeName });
  }

  const inboxRes = await fetchPaged(`/api/companies/${COMPANY_ID}/issues?assigneeAgentId=${encodeURIComponent(myAgentId)}&status=todo,in_progress,blocked`, 'ceo_inbox');
  if (inboxRes.ok) {
    summary.inboxCount = inboxRes.items.length;
    summary.inbox = inboxRes.items.map((i) => ({
      identifier: i.identifier,
      title: i.title,
      status: i.status,
    }));
  } else {
    summary.failures.push({ issue: '-', stage: 'inbox', error: inboxRes.error });
  }

  const summaryPath = path.join(outDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), 'utf8');
  console.log(summaryPath);
}

main().catch((err) => {
  console.error(String(err?.stack || err));
  process.exit(1);
});
