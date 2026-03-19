const fs = require('fs');
const path = require('path');

const API = process.env.PAPERCLIP_API_URL;
const API_KEY = process.env.PAPERCLIP_API_KEY;
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID;
const RUN_ID = process.env.PAPERCLIP_RUN_ID;
const AGENT_ID = process.env.PAPERCLIP_AGENT_ID;
const WAKE_REASON = process.env.PAPERCLIP_WAKE_REASON;
const TASK_ID = process.env.PAPERCLIP_TASK_ID;

if (!API || !API_KEY || !COMPANY_ID || !RUN_ID || !AGENT_ID) {
  console.error('Missing required PAPERCLIP env vars');
  process.exit(1);
}

const outDir = path.resolve('.tmp/ceo-heartbeat-2026-03-17');
fs.mkdirSync(outDir, { recursive: true });

let callCounter = 0;
const requestClassRetries = new Map();

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

function sanitizePath(p) {
  return p.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 140);
}

async function doFetch(method, urlPath, body, mutating = false) {
  const headers = {
    'Authorization': `Bearer ${API_KEY}`,
    'Content-Type': 'application/json',
  };
  if (mutating) headers['X-Paperclip-Run-Id'] = RUN_ID;
  const res = await fetch(`${API}${urlPath}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const file = path.join(outDir, `${String(++callCounter).padStart(4,'0')}_${method}_${sanitizePath(urlPath)}.json`);
  fs.writeFileSync(file, text);
  return { res, text, file };
}

async function requestJson(method, urlPath, body, opts = {}) {
  const { mutating = false, classKey = `${method}:${urlPath.split('?')[0]}`, tolerate404 = false } = opts;
  let attemptedRetry = false;
  while (true) {
    let response;
    try {
      response = await doFetch(method, urlPath, body, mutating);
    } catch (err) {
      const used = requestClassRetries.get(classKey) || 0;
      if (used >= 1) throw err;
      requestClassRetries.set(classKey, used + 1);
      await sleep(350);
      attemptedRetry = true;
      continue;
    }

    const { res, text, file } = response;
    if (tolerate404 && res.status === 404) return { data: null, status: 404, file };

    if (!res.ok) {
      const retryable = res.status === 429 || res.status >= 500;
      const used = requestClassRetries.get(classKey) || 0;
      if (retryable && used < 1) {
        requestClassRetries.set(classKey, used + 1);
        await sleep(400);
        attemptedRetry = true;
        continue;
      }
      const msg = `HTTP ${res.status} for ${method} ${urlPath} file=${file}`;
      const err = new Error(msg);
      err.status = res.status;
      err.file = file;
      throw err;
    }

    if (!text || !text.trim()) {
      // parse/read failure contract: one strict sequential refetch
      if (attemptedRetry) {
        throw new Error(`Empty response after retry for ${method} ${urlPath} file=${file}`);
      }
      attemptedRetry = true;
      await sleep(250);
      continue;
    }

    try {
      return { data: JSON.parse(text), status: res.status, file };
    } catch (err) {
      if (attemptedRetry) {
        throw new Error(`JSON parse failure after retry for ${method} ${urlPath} file=${file}`);
      }
      attemptedRetry = true;
      await sleep(250);
    }
  }
}

function extractDirectivesFromBody(body, sourceType, createdAt, id) {
  const directives = [];
  if (!body) return directives;
  const re = /^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$/gm;
  let m;
  while ((m = re.exec(body)) !== null) {
    directives.push({
      sourceType,
      target: (m[1] || '').trim(),
      createdAt: createdAt || '',
      id: id || '',
    });
  }
  return directives;
}

function has409Marker(body) {
  if (!body) return false;
  return body.split(/\r?\n/).some(line => line.trim() === 'Checkout release requested: 409');
}

function formatCommentForRecovery(comment, agentNameById) {
  const who = comment.authorAgentId
    ? (agentNameById.get(comment.authorAgentId) || 'Unknown Agent')
    : 'User';
  return `[${who}]:\n${comment.body || ''}`;
}

async function main() {
  const summary = {
    wakeReason: WAKE_REASON || null,
    routing: { issuesScanned: 0, reassigned: 0, alreadyCorrect: 0, invalidTarget: 0, noDirective: 0, skipped409: 0, fetchFailures: 0 },
    recovery: { candidates: 0, completed: 0, failures: 0 },
    inbox: { todo: 0, in_progress: 0, blocked: 0, ids: [] },
  };

  const me = await requestJson('GET', '/api/agents/me');
  summary.me = { id: me.data.id, name: me.data.name };

  const agentsResp = await requestJson('GET', `/api/companies/${COMPANY_ID}/agents`);
  const activeAgents = Array.isArray(agentsResp.data)
    ? agentsResp.data.filter(a => !a.hiddenAt)
    : [];
  const nameToAgent = new Map();
  const agentNameById = new Map();
  for (const a of activeAgents) {
    nameToAgent.set((a.name || '').trim(), a);
    agentNameById.set(a.id, a.name || a.id);
  }

  let projectId = null;
  if (WAKE_REASON === 'heartbeat_timer') {
    const projResp = await requestJson('GET', `/api/companies/${COMPANY_ID}/projects`);
    const projects = Array.isArray(projResp.data) ? projResp.data : [];
    const project = projects.find(p => (p.name || '').trim().toLowerCase() === 'story writing app')
      || projects.find(p => (p.name || '').toLowerCase().includes('story'));
    if (!project) throw new Error('Project not found for story-writing app');
    projectId = project.id;

    // Pagination support: either array (single page) or object with items + nextCursor/page.
    let allIssues = [];
    let cursor = null;
    let page = 1;
    while (true) {
      const params = new URLSearchParams();
      params.set('projectId', projectId);
      params.set('status', 'backlog,todo,in_progress,in_review,blocked');
      if (cursor) params.set('cursor', cursor);
      if (!cursor && page > 1) params.set('page', String(page));

      const issueResp = await requestJson('GET', `/api/companies/${COMPANY_ID}/issues?${params.toString()}`, undefined, { classKey: `GET:issues-page-${cursor || page}` });
      const payload = issueResp.data;
      if (Array.isArray(payload)) {
        allIssues = payload;
        break;
      }

      const items = Array.isArray(payload.items) ? payload.items : [];
      allIssues.push(...items);
      if (payload.nextCursor) {
        cursor = payload.nextCursor;
        continue;
      }
      if (payload.totalPages && payload.page && payload.page < payload.totalPages) {
        page = payload.page + 1;
        continue;
      }
      break;
    }

    const recoveryQueue = [];

    for (const issue of allIssues) {
      summary.routing.issuesScanned += 1;
      let comments = [];
      try {
        const commentsResp = await requestJson('GET', `/api/issues/${issue.id}/comments`, undefined, { classKey: `GET:comments:${issue.id}` });
        comments = Array.isArray(commentsResp.data) ? commentsResp.data : [];
      } catch (err) {
        summary.routing.fetchFailures += 1;
        continue; // skip this issue this cycle
      }

      const has409 = comments.some(c => has409Marker(c.body || ''));
      if (has409) {
        summary.routing.skipped409 += 1;
        recoveryQueue.push({ issue, comments });
        continue; // do not assign old issue
      }

      const directives = [];
      directives.push(...extractDirectivesFromBody(issue.description || '', 'description', issue.createdAt, `desc-${issue.id}`));
      for (const c of comments) {
        directives.push(...extractDirectivesFromBody(c.body || '', 'comment', c.createdAt, c.id));
      }
      const commentDirectives = directives.filter(d => d.sourceType === 'comment');
      const candidates = commentDirectives.length > 0 ? commentDirectives : directives.filter(d => d.sourceType === 'description');

      if (!candidates.length) {
        summary.routing.noDirective += 1;
        continue;
      }

      candidates.sort((a, b) => {
        const t = String(a.createdAt).localeCompare(String(b.createdAt));
        if (t !== 0) return t;
        return String(a.id).localeCompare(String(b.id));
      });
      const last = candidates[candidates.length - 1];

      const targetAgent = nameToAgent.get((last.target || '').trim());
      if (!targetAgent) {
        summary.routing.invalidTarget += 1;
        continue;
      }

      if (issue.assigneeAgentId === targetAgent.id) {
        summary.routing.alreadyCorrect += 1;
        continue;
      }

      // Ping-pong signal detection: if last 4 valid directives switch owner 3+ times, comment required.
      const validSeq = candidates
        .map(d => ({ ...d, aid: nameToAgent.get((d.target || '').trim())?.id }))
        .filter(d => d.aid)
        .sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || String(a.id).localeCompare(String(b.id)));
      const tail = validSeq.slice(-4);
      let switches = 0;
      for (let i = 1; i < tail.length; i++) if (tail[i].aid !== tail[i-1].aid) switches++;
      if (switches >= 3) {
        await requestJson('POST', `/api/issues/${issue.id}/comments`, {
          body: `Routing note: repeated handoff churn detected.\n\n- Missing artifact before next reassignment: explicit acceptance artifact in-thread (plan revision, test evidence, review finding, or design brief).\n- Applying latest valid Assign to directive now to restore momentum.`,
        }, { mutating: true, classKey: `POST:comments:pingpong:${issue.id}` });
      }

      await requestJson('PATCH', `/api/issues/${issue.id}`, {
        assigneeAgentId: targetAgent.id,
      }, { mutating: true, classKey: `PATCH:issue-assign:${issue.id}` });

      await requestJson('POST', `/api/issues/${issue.id}/comments`, {
        body: `Assigned to ${targetAgent.name}.`,
      }, { mutating: true, classKey: `POST:comment-assigned:${issue.id}` });

      summary.routing.reassigned += 1;
    }

    summary.recovery.candidates = recoveryQueue.length;

    for (const rec of recoveryQueue) {
      const { issue, comments } = rec;
      try {
        await requestJson('POST', `/api/issues/${issue.id}/comments`, {
          body: 'Board: please release checkout for this issue (assignee got 409). See docs/PAPERCLIP_SETUP.md § Release a stuck checkout.',
        }, { mutating: true, classKey: `POST:comment-recovery-board:${issue.id}` });

        await requestJson('PATCH', `/api/issues/${issue.id}`, {
          status: 'cancelled',
          assigneeAgentId: null,
        }, { mutating: true, classKey: `PATCH:cancel-old:${issue.id}` });

        const combined = [...comments].sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || String(a.id).localeCompare(String(b.id)));
        const transcript = combined.map(c => formatCommentForRecovery(c, agentNameById)).join('\n\n---\n\n');
        const newDescription = `${issue.description || ''}\n\n---\n\nRecovery transcript from ${issue.identifier}:\n\n${transcript}`;

        const directives = [];
        directives.push(...extractDirectivesFromBody(issue.description || '', 'description', issue.createdAt, `desc-${issue.id}`));
        for (const c of combined) directives.push(...extractDirectivesFromBody(c.body || '', 'comment', c.createdAt, c.id));
        const commentDirectives = directives.filter(d => d.sourceType === 'comment');
        const candidates = commentDirectives.length ? commentDirectives : directives.filter(d => d.sourceType === 'description');
        candidates.sort((a, b) => String(a.createdAt).localeCompare(String(b.createdAt)) || String(a.id).localeCompare(String(b.id)));
        const last = candidates[candidates.length - 1];
        const target = last ? nameToAgent.get((last.target || '').trim()) : null;

        const createBody = {
          projectId: issue.projectId,
          title: issue.title,
          description: newDescription,
          goalId: issue.goalId,
          parentId: issue.parentId,
          status: 'todo',
          assigneeAgentId: target ? target.id : null,
          priority: issue.priority,
        };
        const created = await requestJson('POST', `/api/companies/${COMPANY_ID}/issues`, createBody, { mutating: true, classKey: `POST:create-recovery:${issue.id}` });

        const newIssueId = created.data.id;
        const newIdentifier = created.data.identifier || newIssueId;

        await requestJson('POST', `/api/issues/${issue.id}/comments`, {
          body: `Superseded by ${newIdentifier}.`,
        }, { mutating: true, classKey: `POST:comment-old-superseded:${issue.id}` });

        await requestJson('POST', `/api/issues/${newIssueId}/comments`, {
          body: `Recovery ticket; previous ${issue.identifier} stuck (checkout 409) and cancelled.`,
        }, { mutating: true, classKey: `POST:comment-new-recovery:${newIssueId}` });

        summary.recovery.completed += 1;
      } catch (err) {
        summary.recovery.failures += 1;
      }
    }
  } else if (WAKE_REASON === 'issue_commented' && TASK_ID) {
    // Fast-path: only fetch comments for this issue and apply handoff directive.
    try {
      const issueResp = await requestJson('GET', `/api/issues/${TASK_ID}`);
      const issue = issueResp.data;
      const commentsResp = await requestJson('GET', `/api/issues/${TASK_ID}/comments`, undefined, { classKey: `GET:comments:${TASK_ID}` });
      const comments = Array.isArray(commentsResp.data) ? commentsResp.data : [];
      const has409 = comments.some(c => has409Marker(c.body || ''));
      if (!has409) {
        const directives = [];
        directives.push(...extractDirectivesFromBody(issue.description || '', 'description', issue.createdAt, `desc-${issue.id}`));
        for (const c of comments) directives.push(...extractDirectivesFromBody(c.body || '', 'comment', c.createdAt, c.id));
        const commentDirectives = directives.filter(d => d.sourceType === 'comment');
        const candidates = commentDirectives.length > 0 ? commentDirectives : directives.filter(d => d.sourceType === 'description');
        if (candidates.length > 0) {
          candidates.sort((a,b)=>String(a.createdAt).localeCompare(String(b.createdAt)) || String(a.id).localeCompare(String(b.id)));
          const last = candidates[candidates.length - 1];
          const target = nameToAgent.get((last.target||'').trim());
          if (target && issue.assigneeAgentId !== target.id) {
            await requestJson('PATCH', `/api/issues/${issue.id}`, { assigneeAgentId: target.id }, { mutating: true, classKey: `PATCH:fastassign:${issue.id}` });
            await requestJson('POST', `/api/issues/${issue.id}/comments`, { body: `Assigned to ${target.name}.` }, { mutating: true, classKey: `POST:fastassign-comment:${issue.id}` });
            summary.routing.reassigned += 1;
          }
        }
      }
    } catch (err) {
      summary.routing.fetchFailures += 1;
    }
  }

  // Step 4 get own assignments
  const inboxResp = await requestJson('GET', `/api/companies/${COMPANY_ID}/issues?assigneeAgentId=${AGENT_ID}&status=todo,in_progress,blocked`);
  const inbox = Array.isArray(inboxResp.data) ? inboxResp.data : (Array.isArray(inboxResp.data.items) ? inboxResp.data.items : []);
  summary.inbox.ids = inbox.map(i => i.identifier);
  for (const i of inbox) {
    if (i.status === 'todo') summary.inbox.todo += 1;
    else if (i.status === 'in_progress') summary.inbox.in_progress += 1;
    else if (i.status === 'blocked') summary.inbox.blocked += 1;
  }

  const summaryFile = path.join(outDir, 'summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
}

main().catch(err => {
  console.error(err && err.stack ? err.stack : String(err));
  process.exit(1);
});
