import fs from 'fs';
import path from 'path';

const API_URL = process.env.PAPERCLIP_API_URL;
const API_KEY = process.env.PAPERCLIP_API_KEY;
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID;
const RUN_ID = process.env.PAPERCLIP_RUN_ID;
const AGENT_ID = process.env.PAPERCLIP_AGENT_ID;

if (!API_URL || !API_KEY || !COMPANY_ID || !RUN_ID || !AGENT_ID) {
  console.error('Missing required PAPERCLIP_* env vars.');
  process.exit(1);
}

const outDir = path.resolve('agents/ceo/tmp/heartbeat-outputs');
fs.mkdirSync(outDir, { recursive: true });

function headers(mutating = false) {
  const h = {
    Authorization: `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };
  if (mutating) h['X-Paperclip-Run-Id'] = RUN_ID;
  return h;
}

async function sleep(ms) { return new Promise((r) => setTimeout(r, ms)); }

async function requestWithRetry({ method = 'GET', endpoint, body, mutating = false, requestClass = 'default' }) {
  const url = `${API_URL}${endpoint}`;
  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(url, {
        method,
        headers: headers(mutating),
        body: body == null ? undefined : JSON.stringify(body),
      });
      if (res.status === 429 && attempt === 1) {
        console.log(`Rate limited (${requestClass}); retrying once after short backoff.`);
        await sleep(800);
        continue;
      }
      if (!res.ok) {
        const txt = await res.text();
        if (attempt === 1 && (res.status >= 500 || res.status === 408 || res.status === 499)) {
          console.log(`Transient failure (${requestClass}, ${res.status}); retrying once.`);
          await sleep(600);
          continue;
        }
        throw new Error(`${method} ${endpoint} failed ${res.status}: ${txt.slice(0, 500)}`);
      }
      const text = await res.text();
      return text ? JSON.parse(text) : {};
    } catch (err) {
      lastErr = err;
      if (attempt === 1) {
        console.log(`Transport/parse failure (${requestClass}); retrying once.`);
        await sleep(600);
        continue;
      }
    }
  }
  throw lastErr;
}

function normalizeName(name) {
  return String(name || '').trim().replace(/^\[(.*)\]$/, '$1').trim();
}

function extractDirectivesFromText(text, createdAt, id, source) {
  const directives = [];
  if (!text) return directives;
  const lines = String(text).split(/\r?\n/);
  const re = /^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$/;
  for (const line of lines) {
    const m = line.match(re);
    if (m) {
      directives.push({
        targetNameRaw: m[1],
        targetName: normalizeName(m[1]),
        createdAt: createdAt || '1970-01-01T00:00:00.000Z',
        id: id == null ? -1 : Number(id),
        source,
      });
    }
  }
  return directives;
}

function commentsArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function issuesArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data)) return payload.data;
  return [];
}

function getNextCursor(payload) {
  return payload?.nextCursor || payload?.next || payload?.cursor || payload?.pagination?.nextCursor || null;
}

function findProject(projects) {
  const byName = projects.find((p) => /story[-\s]?writing[-\s]?app/i.test(String(p.name || '')));
  if (byName) return byName;
  const byWorkspace = projects.find((p) => {
    const primary = String(p?.primaryWorkspace?.cwd || p?.primaryWorkspace?.repoUrl || '');
    const anyWs = Array.isArray(p?.workspaces)
      ? p.workspaces.some((w) => /story-writing-app/i.test(String(w?.cwd || w?.repoUrl || w?.name || '')))
      : false;
    return /story-writing-app/i.test(primary) || anyWs;
  });
  return byWorkspace || null;
}

function bodyHas409Line(body) {
  if (!body) return false;
  return String(body).split(/\r?\n/).some((l) => l.trim() === 'Checkout release requested: 409');
}

function formatAuthor(c, agentById) {
  if (c?.authorAgentId && agentById.get(c.authorAgentId)) return `[${agentById.get(c.authorAgentId)}]:`;
  return '[User]:';
}

function cmpDirective(a, b) {
  const ta = new Date(a.createdAt).getTime();
  const tb = new Date(b.createdAt).getTime();
  if (ta !== tb) return ta - tb;
  return (a.id || 0) - (b.id || 0);
}

async function main() {
  const summary = {
    scanned: 0,
    reassigned: 0,
    alreadyCorrect: 0,
    invalidTargets: 0,
    noDirective: 0,
    skipped409: 0,
    recoveries: 0,
    recoveryFailures: 0,
  };

  const me = await requestWithRetry({ endpoint: '/api/agents/me', requestClass: 'identity' });
  fs.writeFileSync(path.join(outDir, 'me.json'), JSON.stringify(me, null, 2));

  const projectsPayload = await requestWithRetry({ endpoint: `/api/companies/${COMPANY_ID}/projects`, requestClass: 'projects' });
  fs.writeFileSync(path.join(outDir, 'projects.json'), JSON.stringify(projectsPayload, null, 2));
  const projects = issuesArray(projectsPayload);
  const project = findProject(projects);
  if (!project) {
    console.log('No matching story-writing-app project found; exiting heartbeat cleanly.');
    return;
  }

  const agentsPayload = await requestWithRetry({ endpoint: `/api/companies/${COMPANY_ID}/agents`, requestClass: 'agents' });
  fs.writeFileSync(path.join(outDir, 'agents.json'), JSON.stringify(agentsPayload, null, 2));
  const agents = issuesArray(agentsPayload);
  const activeAgents = agents.filter((a) => a.status !== 'inactive');
  const agentByName = new Map(activeAgents.map((a) => [normalizeName(a.name), a]));
  const agentById = new Map(agents.map((a) => [a.id, a.name]));

  const statuses = 'backlog,todo,in_progress,in_review,blocked';
  const allIssues = [];
  let cursor = null;
  let page = 1;
  while (true) {
    const qs = new URLSearchParams({ projectId: project.id, status: statuses, limit: '100' });
    if (cursor) qs.set('cursor', cursor);
    const endpoint = `/api/companies/${COMPANY_ID}/issues?${qs.toString()}`;
    const payload = await requestWithRetry({ endpoint, requestClass: `issues-page-${page}` });
    fs.writeFileSync(path.join(outDir, `issues-page-${page}.json`), JSON.stringify(payload, null, 2));
    const pageIssues = issuesArray(payload);
    allIssues.push(...pageIssues);
    const nextCursor = getNextCursor(payload);
    if (!nextCursor || pageIssues.length === 0) break;
    cursor = nextCursor;
    page += 1;
  }

  const recoveryCandidates = [];

  for (const issue of allIssues) {
    summary.scanned += 1;

    let commentsPayload;
    try {
      commentsPayload = await requestWithRetry({ endpoint: `/api/issues/${issue.id}/comments`, requestClass: `comments-${issue.id}` });
      fs.writeFileSync(path.join(outDir, `issue-${issue.identifier || issue.id}-comments.json`), JSON.stringify(commentsPayload, null, 2));
    } catch (err) {
      console.log(`Skipping issue ${issue.identifier || issue.id}; failed comments fetch after retry.`);
      continue;
    }

    const comments = commentsArray(commentsPayload);
    const has409 = comments.some((c) => bodyHas409Line(c.body));
    if (has409) {
      summary.skipped409 += 1;
      recoveryCandidates.push({ issue, comments });
      continue;
    }

    const directives = [];
    directives.push(...extractDirectivesFromText(issue.description, issue.createdAt, issue.id, 'description'));
    for (const c of comments) {
      directives.push(...extractDirectivesFromText(c.body, c.createdAt, c.id, 'comment'));
    }

    const commentDirectives = directives.filter((d) => d.source === 'comment');
    const pool = commentDirectives.length > 0 ? commentDirectives : directives.filter((d) => d.source === 'description');
    if (pool.length === 0) {
      summary.noDirective += 1;
      continue;
    }
    pool.sort(cmpDirective);
    const winner = pool[pool.length - 1];
    const targetAgent = agentByName.get(normalizeName(winner.targetName));
    if (!targetAgent) {
      summary.invalidTargets += 1;
      continue;
    }

    if (issue.assigneeAgentId === targetAgent.id) {
      summary.alreadyCorrect += 1;
      continue;
    }

    try {
      await requestWithRetry({
        method: 'PATCH',
        endpoint: `/api/issues/${issue.id}`,
        mutating: true,
        requestClass: `assign-${issue.id}`,
        body: {
          assigneeAgentId: targetAgent.id,
          comment: `Assigned to ${targetAgent.name}.`,
        },
      });
      summary.reassigned += 1;
    } catch (err) {
      console.log(`Failed assigning ${issue.identifier || issue.id}: ${String(err.message || err)}`);
    }
  }

  for (const item of recoveryCandidates) {
    const { issue, comments } = item;
    try {
      await requestWithRetry({
        method: 'POST',
        endpoint: `/api/issues/${issue.id}/comments`,
        mutating: true,
        requestClass: `recovery-comment-${issue.id}`,
        body: {
          body: 'Board: please release checkout for this issue (assignee got 409). See docs/PAPERCLIP_SETUP.md § Release a stuck checkout.',
        },
      });

      await requestWithRetry({
        method: 'PATCH',
        endpoint: `/api/issues/${issue.id}`,
        mutating: true,
        requestClass: `recovery-cancel-${issue.id}`,
        body: {
          status: 'cancelled',
          assigneeAgentId: null,
        },
      });

      const commentsChrono = [...comments].sort((a, b) => {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        if (ta !== tb) return ta - tb;
        return (a.id || 0) - (b.id || 0);
      });

      const directives = [];
      directives.push(...extractDirectivesFromText(issue.description, issue.createdAt, issue.id, 'description'));
      for (const c of commentsChrono) directives.push(...extractDirectivesFromText(c.body, c.createdAt, c.id, 'comment'));
      const commentDirectives = directives.filter((d) => d.source === 'comment');
      const pool = commentDirectives.length > 0 ? commentDirectives : directives.filter((d) => d.source === 'description');
      pool.sort(cmpDirective);
      const winner = pool[pool.length - 1] || null;
      const target = winner ? agentByName.get(normalizeName(winner.targetName)) : null;

      const transcript = commentsChrono
        .map((c) => `${formatAuthor(c, agentById)}\n${String(c.body || '').trim()}\n`)
        .join('\n');
      const separator = '\n\n---\n\nRecovered transcript from cancelled issue:\n\n';
      const newDescription = `${String(issue.description || '').trim()}${separator}${transcript}`;

      const created = await requestWithRetry({
        method: 'POST',
        endpoint: `/api/companies/${COMPANY_ID}/issues`,
        mutating: true,
        requestClass: `recovery-create-${issue.id}`,
        body: {
          projectId: issue.projectId,
          title: issue.title,
          description: newDescription,
          goalId: issue.goalId || null,
          parentId: issue.parentId || null,
          status: 'todo',
          assigneeAgentId: target ? target.id : null,
          priority: issue.priority || 'medium',
        },
      });

      await requestWithRetry({
        method: 'POST',
        endpoint: `/api/issues/${issue.id}/comments`,
        mutating: true,
        requestClass: `recovery-link-old-${issue.id}`,
        body: {
          body: `Superseded by ${created.identifier || created.id}.`,
        },
      });

      await requestWithRetry({
        method: 'POST',
        endpoint: `/api/issues/${created.id}/comments`,
        mutating: true,
        requestClass: `recovery-link-new-${created.id}`,
        body: {
          body: `Recovery ticket; previous ${issue.identifier || issue.id} stuck (checkout 409) and cancelled.`,
        },
      });

      summary.recoveries += 1;
    } catch (err) {
      summary.recoveryFailures += 1;
      console.log(`Recovery failed for ${issue.identifier || issue.id}: ${String(err.message || err)}`);
    }
  }

  const inbox = await requestWithRetry({
    endpoint: `/api/companies/${COMPANY_ID}/issues?assigneeAgentId=${AGENT_ID}&status=todo,in_progress,blocked`,
    requestClass: 'ceo-inbox',
  });
  fs.writeFileSync(path.join(outDir, 'ceo-inbox.json'), JSON.stringify(inbox, null, 2));

  const inboxIssues = issuesArray(inbox);
  const inboxCounts = {
    todo: inboxIssues.filter((i) => i.status === 'todo').length,
    in_progress: inboxIssues.filter((i) => i.status === 'in_progress').length,
    blocked: inboxIssues.filter((i) => i.status === 'blocked').length,
    total: inboxIssues.length,
  };

  const result = {
    runId: RUN_ID,
    me: { id: me.id, name: me.name, role: me.role },
    project: { id: project.id, name: project.name },
    summary,
    inboxCounts,
  };

  fs.writeFileSync(path.join(outDir, 'routing-summary.json'), JSON.stringify(result, null, 2));
  console.log(JSON.stringify(result, null, 2));
}

main().catch((err) => {
  console.error(String(err.stack || err));
  process.exit(1);
});
