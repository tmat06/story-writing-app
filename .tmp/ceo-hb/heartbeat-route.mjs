import fs from 'fs/promises';
import path from 'path';

const apiUrl = process.env.PAPERCLIP_API_URL;
const apiKey = process.env.PAPERCLIP_API_KEY;
const companyId = process.env.PAPERCLIP_COMPANY_ID;
const runId = process.env.PAPERCLIP_RUN_ID;
const outDir = '.tmp/ceo-hb';

if (!apiUrl || !apiKey || !companyId || !runId) {
  throw new Error('Missing required PAPERCLIP env vars');
}

const headersBase = {
  Authorization: `Bearer ${apiKey}`,
};

const mutateHeaders = {
  ...headersBase,
  'X-Paperclip-Run-Id': runId,
  'Content-Type': 'application/json',
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function fetchWithRetry(url, opts = {}, requestClass = 'request') {
  let lastErr;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const res = await fetch(url, opts);
      if (res.status === 429 && attempt === 0) {
        await sleep(400);
        continue;
      }
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`${requestClass} HTTP ${res.status}: ${text.slice(0, 300)}`);
      }
      return res;
    } catch (err) {
      lastErr = err;
      const msg = String(err?.message || err);
      const retryable = /429|fetch failed|ECONNRESET|ECONNREFUSED|ETIMEDOUT|network|aborted|terminated|cancel/i.test(msg);
      if (attempt === 0 && retryable) {
        await sleep(400);
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

async function fetchJsonToFile(url, filePath, requestClass) {
  const res = await fetchWithRetry(url, { headers: headersBase }, requestClass);
  const text = await res.text();
  await fs.writeFile(filePath, text, 'utf8');
  const stat = await fs.stat(filePath);
  if (stat.size === 0) throw new Error(`${requestClass} empty response file`);
  try {
    return JSON.parse(text);
  } catch (err) {
    // one sequential refetch + parse retry
    const res2 = await fetchWithRetry(url, { headers: headersBase }, `${requestClass}-retry`);
    const text2 = await res2.text();
    await fs.writeFile(filePath, text2, 'utf8');
    const stat2 = await fs.stat(filePath);
    if (stat2.size === 0) throw new Error(`${requestClass} retry empty response file`);
    return JSON.parse(text2);
  }
}

async function mutate(method, url, body, requestClass) {
  const res = await fetchWithRetry(
    url,
    { method, headers: mutateHeaders, body: body ? JSON.stringify(body) : undefined },
    requestClass,
  );
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

function directiveMatches(text) {
  const lines = String(text || '').split(/\r?\n/);
  const out = [];
  const re = /^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$/;
  for (const line of lines) {
    const m = line.match(re);
    if (m) out.push(m[1].trim());
  }
  return out;
}

function hasCheckout409Line(text) {
  return /^Checkout release requested: 409$/m.test(String(text || ''));
}

function cmpKey(a, b) {
  const ad = a.createdAt || '';
  const bd = b.createdAt || '';
  if (ad < bd) return -1;
  if (ad > bd) return 1;
  const ai = String(a.id || '');
  const bi = String(b.id || '');
  if (ai < bi) return -1;
  if (ai > bi) return 1;
  return 0;
}

function latestDirective(issue, comments) {
  const candidates = [];
  const descMatches = directiveMatches(issue.description || '');
  for (const target of descMatches) {
    candidates.push({ source: 'description', target, createdAt: issue.createdAt || '', id: issue.id || '' });
  }
  for (const c of comments) {
    const ms = directiveMatches(c.body || '');
    for (const target of ms) {
      candidates.push({ source: 'comment', target, createdAt: c.createdAt || '', id: c.id || '' });
    }
  }
  const commentCandidates = candidates.filter((c) => c.source === 'comment');
  const active = commentCandidates.length > 0 ? commentCandidates : candidates;
  if (active.length === 0) return null;
  active.sort(cmpKey);
  return active[active.length - 1];
}

const agents = JSON.parse(await fs.readFile(path.join(outDir, 'agents.json'), 'utf8'));
const issues = JSON.parse(await fs.readFile(path.join(outDir, 'issues-page1.json'), 'utf8'));

const activeAgentByName = new Map();
const agentNameById = new Map();
for (const a of agents) {
  if (a.status !== 'deleted') {
    activeAgentByName.set(String(a.name || '').trim(), a);
  }
  agentNameById.set(a.id, a.name);
}

const summary = {
  scanned: 0,
  reassigned: 0,
  alreadyCorrect: 0,
  noDirective: 0,
  invalidTarget: 0,
  parseSkip: 0,
  recoveryCount: 0,
  recoveryIssues: [],
  assignmentActions: [],
};

const recoveryCandidates = [];

for (const issue of issues) {
  summary.scanned += 1;
  const commentsPath = path.join(outDir, `comments-${issue.identifier || issue.id}.json`);
  let comments;
  try {
    comments = await fetchJsonToFile(
      `${apiUrl}/api/issues/${issue.id}/comments`,
      commentsPath,
      `comments:${issue.identifier || issue.id}`,
    );
    if (!Array.isArray(comments)) throw new Error('comments payload is not an array');
  } catch (err) {
    summary.parseSkip += 1;
    continue;
  }

  const has409 = comments.some((c) => hasCheckout409Line(c.body));
  if (has409) {
    recoveryCandidates.push({ issue, comments });
    // skip normal assignment for 409-recovery issues
    continue;
  }

  const latest = latestDirective(issue, comments);
  if (!latest) {
    summary.noDirective += 1;
    continue;
  }

  const targetName = latest.target.trim();
  const targetAgent = activeAgentByName.get(targetName);
  if (!targetAgent) {
    summary.invalidTarget += 1;
    continue;
  }

  if (issue.assigneeAgentId === targetAgent.id) {
    summary.alreadyCorrect += 1;
    continue;
  }

  await mutate(
    'PATCH',
    `${apiUrl}/api/issues/${issue.id}`,
    { assigneeAgentId: targetAgent.id },
    `assign:${issue.identifier || issue.id}`,
  );
  await mutate(
    'POST',
    `${apiUrl}/api/issues/${issue.id}/comments`,
    { body: `Assigned to ${targetAgent.name}.` },
    `assign-comment:${issue.identifier || issue.id}`,
  );

  summary.reassigned += 1;
  summary.assignmentActions.push({ issue: issue.identifier, target: targetAgent.name });
}

for (const rec of recoveryCandidates) {
  const issue = rec.issue;
  const comments = [...rec.comments].sort(cmpKey);

  await mutate(
    'POST',
    `${apiUrl}/api/issues/${issue.id}/comments`,
    {
      body: 'Board: please release checkout for this issue (assignee got 409). See docs/PAPERCLIP_SETUP.md § Release a stuck checkout.',
    },
    `recovery-board-comment:${issue.identifier}`,
  );

  await mutate(
    'PATCH',
    `${apiUrl}/api/issues/${issue.id}`,
    { status: 'cancelled', assigneeAgentId: null },
    `recovery-cancel:${issue.identifier}`,
  );

  const contextBlocks = comments.map((c) => {
    const author = c.authorAgentId ? `[${agentNameById.get(c.authorAgentId) || 'Unknown Agent'}]` : '[User]';
    return `${author}:\n${c.body || ''}`;
  });

  const separator = '\n\n---\n\n## Context from previous issue\n\n';
  const newDescription = `${issue.description || ''}${separator}${contextBlocks.join('\n\n')}`;

  const latest = latestDirective(issue, comments);
  let newAssigneeAgentId = null;
  if (latest) {
    const targetAgent = activeAgentByName.get(latest.target.trim());
    if (targetAgent) newAssigneeAgentId = targetAgent.id;
  }

  const created = await mutate(
    'POST',
    `${apiUrl}/api/companies/${companyId}/issues`,
    {
      projectId: issue.projectId,
      goalId: issue.goalId,
      parentId: issue.parentId,
      title: issue.title,
      description: newDescription,
      status: 'todo',
      assigneeAgentId: newAssigneeAgentId,
      priority: issue.priority || 'medium',
    },
    `recovery-create:${issue.identifier}`,
  );

  await mutate(
    'POST',
    `${apiUrl}/api/issues/${issue.id}/comments`,
    { body: `Superseded by ${created?.identifier || created?.id}.` },
    `recovery-old-link:${issue.identifier}`,
  );

  await mutate(
    'POST',
    `${apiUrl}/api/issues/${created.id}/comments`,
    {
      body: `Recovery ticket; previous issue ${issue.identifier} stuck (checkout 409) and cancelled.`,
    },
    `recovery-new-comment:${created?.identifier || created?.id}`,
  );

  summary.recoveryCount += 1;
  summary.recoveryIssues.push({ old: issue.identifier, new: created?.identifier || created?.id });
}

await fs.writeFile(path.join(outDir, 'routing-summary.json'), JSON.stringify(summary, null, 2));
console.log(JSON.stringify(summary, null, 2));
