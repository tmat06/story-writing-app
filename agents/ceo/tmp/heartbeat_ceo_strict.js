const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const apiUrl = process.env.PAPERCLIP_API_URL;
const apiKey = process.env.PAPERCLIP_API_KEY;
const companyId = process.env.PAPERCLIP_COMPANY_ID;
const runId = process.env.PAPERCLIP_RUN_ID;

if (!apiUrl || !apiKey || !companyId || !runId) {
  console.error('Missing required PAPERCLIP_* env vars.');
  process.exit(1);
}

const outDir = path.join(
  'agents',
  'ceo',
  'tmp',
  `heartbeat_${new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15)}`,
);
fs.mkdirSync(outDir, { recursive: true });

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function sanitize(s) {
  return String(s).replace(/[^a-zA-Z0-9._-]+/g, '_');
}

function stripBracketsAndTrim(s) {
  const t = String(s || '').trim();
  const m = t.match(/^\[(.*)\]$/);
  return (m ? m[1] : t).trim();
}

function asItems(d) {
  if (Array.isArray(d)) return d;
  if (d && Array.isArray(d.items)) return d.items;
  if (d && Array.isArray(d.data)) return d.data;
  if (d && Array.isArray(d.results)) return d.results;
  return [];
}

function nextToken(d) {
  if (!d || Array.isArray(d)) return null;
  if (typeof d.nextCursor === 'string' && d.nextCursor) return { type: 'cursor', value: d.nextCursor };
  if (d.pageInfo && typeof d.pageInfo.nextCursor === 'string' && d.pageInfo.nextCursor) {
    return { type: 'cursor', value: d.pageInfo.nextCursor };
  }
  if (d.pagination && typeof d.pagination.nextCursor === 'string' && d.pagination.nextCursor) {
    return { type: 'cursor', value: d.pagination.nextCursor };
  }
  if (typeof d.nextPage === 'number') return { type: 'page', value: d.nextPage };
  if (typeof d.page === 'number' && typeof d.totalPages === 'number' && d.page < d.totalPages) {
    return { type: 'page', value: d.page + 1 };
  }
  return null;
}

function extractDirectives(text) {
  const out = [];
  const re = /^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$/gm;
  let m;
  const src = String(text || '');
  while ((m = re.exec(src)) !== null) out.push(stripBracketsAndTrim(m[1]));
  return out;
}

function hasCheckoutReleaseRequested409(text) {
  return /(?:^|\n)Checkout release requested: 409(?:\n|$)/.test(String(text || ''));
}

function runCurl(url, outFile, method = 'GET', body = null, mutate = false, strict = false) {
  const args = ['-sS'];
  if (strict) args.push('-f');
  args.push('-X', method, '-H', `Authorization: Bearer ${apiKey}`, '-H', 'Accept: application/json');
  if (mutate) args.push('-H', `X-Paperclip-Run-Id: ${runId}`);
  if (body !== null) {
    args.push('-H', 'Content-Type: application/json', '--data-binary', JSON.stringify(body));
  }
  args.push('-o', outFile, '-w', '%{http_code}', url);
  const code = cp.execFileSync('curl', args, { encoding: 'utf8' }).trim();
  return Number(code);
}

async function requestJson({ name, url, method = 'GET', body = null, mutate = false }) {
  const file = path.join(outDir, `${sanitize(name)}.json`);

  const attemptRequest = async (attemptName, strict = false) => {
    try {
      const status = runCurl(url, file, method, body, mutate, strict);
      const text = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
      if (!text || text.trim().length === 0) {
        return { ok: false, retryable: true, reason: `empty body (${attemptName})`, status };
      }
      if (Number.isNaN(status) || status < 200 || status > 299) {
        const retryable = status === 429 || status >= 500 || status === 0;
        return { ok: false, retryable, reason: `HTTP ${status} (${attemptName})` };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, retryable: true, reason: `transport error (${attemptName}): ${err.message}` };
    }
  };

  let first = await attemptRequest('initial', false);
  if (!first.ok && first.retryable) {
    await sleep(700);
    first = await attemptRequest('retry', false);
  }
  if (!first.ok) return { ok: false, file, error: first.reason };

  const tryParse = () => {
    const saved = fs.readFileSync(file, 'utf8');
    if (!saved || saved.trim().length === 0) throw new Error('saved file empty');
    return JSON.parse(saved);
  };

  try {
    return { ok: true, file, data: tryParse() };
  } catch (err) {
    await sleep(400);
    const refetch = await attemptRequest('parse-refetch', true);
    if (!refetch.ok) return { ok: false, file, error: `parse failed then strict refetch failed: ${refetch.reason}` };
    try {
      return { ok: true, file, data: tryParse() };
    } catch (err2) {
      return { ok: false, file, error: `parse failed after strict refetch: ${err2.message}` };
    }
  }
}

async function fetchAllPages({ name, url, pageLimit = 200 }) {
  const all = [];
  let page = 1;
  let cursor = null;
  let pages = 0;

  for (;;) {
    const u = new URL(url);
    if (cursor) u.searchParams.set('cursor', cursor);
    else u.searchParams.set('page', String(page));

    const res = await requestJson({
      name: `${name}_${cursor ? `cursor_${cursor}` : `page_${page}`}`,
      url: u.toString(),
    });
    if (!res.ok) return { ok: false, error: res.error, pages, data: all };

    const data = res.data;
    asItems(data).forEach((it) => all.push(it));
    pages += 1;

    const n = nextToken(data);
    if (!n) break;
    if (n.type === 'cursor') {
      cursor = n.value;
    } else {
      page = n.value;
      cursor = null;
    }

    if (pages > pageLimit) return { ok: false, error: `${name} pagination safety limit exceeded`, pages, data: all };
  }

  return { ok: true, data: all, pages };
}

function pingPongArtifact(targets) {
  const set = new Set(targets);
  if (set.has('Founding Engineer')) return 'plan revision';
  if (set.has('Code Monkey')) return 'test evidence';
  if (set.has('Code Reviewer')) return 'review finding';
  if (set.has('Design')) return 'design brief';
  return 'plan revision';
}

function formatCommentContext(comment, agentsById) {
  let label = '[User]';
  if (comment.authorAgentId && agentsById.has(comment.authorAgentId)) {
    label = `[${agentsById.get(comment.authorAgentId).name}]`;
  }
  const body = String(comment.body || '').trimEnd();
  return `${label}:\n${body}`;
}

function buildRecoveryDescription(issue, comments, agentsById, boardCommentBody) {
  const blocks = [];
  const base = String(issue.description || '').trimEnd();
  if (base) blocks.push(base);

  blocks.push('---');
  blocks.push('## Context from previous issue');

  const ordered = [...comments].sort((a, b) => {
    const ta = String(a.createdAt || '');
    const tb = String(b.createdAt || '');
    if (ta !== tb) return ta.localeCompare(tb);
    return String(a.id || '').localeCompare(String(b.id || ''));
  });

  ordered.forEach((c) => blocks.push(formatCommentContext(c, agentsById)));
  blocks.push(`[CEO]:\n${boardCommentBody}`);

  return `${blocks.join('\n\n')}\n`;
}

function selectLastDirective(issue, comments) {
  const descDirectives = [];
  const commentDirectives = [];

  extractDirectives(issue.description || '').forEach((targetName) => {
    descDirectives.push({
      createdAt: issue.createdAt || '1970-01-01T00:00:00.000Z',
      id: `description:${issue.id}`,
      targetName,
      source: 'description',
    });
  });

  comments.forEach((c) => {
    extractDirectives(c.body || '').forEach((targetName) => {
      commentDirectives.push({
        createdAt: c.createdAt || '1970-01-01T00:00:00.000Z',
        id: String(c.id || ''),
        targetName,
        source: 'comment',
      });
    });
  });

  const sortDirectives = (arr) => {
    arr.sort((a, b) => {
      if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
      return String(a.id).localeCompare(String(b.id));
    });
  };

  sortDirectives(descDirectives);
  sortDirectives(commentDirectives);

  if (commentDirectives.length > 0) return commentDirectives[commentDirectives.length - 1];
  if (descDirectives.length > 0) return descDirectives[descDirectives.length - 1];
  return null;
}

(async () => {
  const summary = {
    runId,
    outDir,
    projectId: null,
    projectName: null,
    paginationPages: 0,
    scannedIssues: 0,
    reassigned: 0,
    alreadyCorrect: 0,
    noValidDirective: 0,
    invalidTargets: 0,
    skippedFailures: 0,
    pingPongWarnings: 0,
    checkout409Candidates: 0,
    checkout409Recovered: 0,
    checkout409RecoveryFailed: 0,
    inbox: { todo: 0, in_progress: 0, blocked: 0 },
    issueResults: [],
    recoveryResults: [],
  };

  const meRes = await requestJson({ name: 'agents_me', url: `${apiUrl}/api/agents/me` });
  if (!meRes.ok) {
    console.error(meRes.error);
    process.exit(0);
  }
  const me = meRes.data;

  const projectsRes = await fetchAllPages({ name: 'projects', url: `${apiUrl}/api/companies/${companyId}/projects` });
  if (!projectsRes.ok) {
    console.error(projectsRes.error);
    process.exit(0);
  }

  const projects = projectsRes.data;
  const project = projects.find((p) => {
    const n = String(p.name || '').toLowerCase();
    const k = String(p.urlKey || '').toLowerCase();
    const ws = Array.isArray(p.workspaces) ? p.workspaces : [];
    const wsHit = ws.some(
      (w) =>
        String(w.name || '').toLowerCase().includes('story-writing-app') ||
        String(w.repoUrl || '').toLowerCase().includes('story-writing-app') ||
        String(w.cwd || '').toLowerCase().includes('story-writing-app'),
    );
    return n.includes('story writing app') || n.includes('story-writing-app') || k.includes('story-writing-app') || wsHit;
  });

  if (!project) {
    console.error('Story Writing App project not found.');
    process.exit(0);
  }
  summary.projectId = project.id;
  summary.projectName = project.name;

  const agentsRes = await fetchAllPages({ name: 'agents', url: `${apiUrl}/api/companies/${companyId}/agents` });
  if (!agentsRes.ok) {
    console.error(agentsRes.error);
    process.exit(0);
  }

  const agents = agentsRes.data;
  const activeAgentByName = new Map();
  const agentsById = new Map();
  for (const a of agents) {
    agentsById.set(a.id, a);
    if (String(a.status || '').toLowerCase() !== 'terminated') {
      const nm = stripBracketsAndTrim(a.name || '');
      if (nm && !activeAgentByName.has(nm)) activeAgentByName.set(nm, a);
    }
  }

  const issuesUrl = new URL(`${apiUrl}/api/companies/${companyId}/issues`);
  issuesUrl.searchParams.set('projectId', project.id);
  issuesUrl.searchParams.set('status', 'backlog,todo,in_progress,in_review,blocked');
  issuesUrl.searchParams.set('limit', '100');

  const issuesRes = await fetchAllPages({ name: 'issues', url: issuesUrl.toString(), pageLimit: 500 });
  if (!issuesRes.ok) {
    console.error(`Issues page failure: ${issuesRes.error}`);
    process.exit(0);
  }

  const issues = issuesRes.data;
  summary.paginationPages = issuesRes.pages;
  summary.scannedIssues = issues.length;

  const issueMap = new Map();
  const commentsByIssue = new Map();
  const recoveryIssueIds = new Set();

  for (const issue of issues) {
    issueMap.set(issue.id, issue);

    const commentsRes = await fetchAllPages({
      name: `comments_${issue.identifier || issue.id}`,
      url: `${apiUrl}/api/issues/${issue.id}/comments`,
      pageLimit: 500,
    });

    if (!commentsRes.ok) {
      summary.skippedFailures += 1;
      summary.issueResults.push({ identifier: issue.identifier, action: 'skip_comments_fetch_failed' });
      continue;
    }

    const comments = commentsRes.data;
    commentsByIssue.set(issue.id, comments);

    comments.forEach((c) => {
      if (hasCheckoutReleaseRequested409(c.body || '')) recoveryIssueIds.add(issue.id);
    });

    const selected = selectLastDirective(issue, comments);

    if (!selected) {
      summary.noValidDirective += 1;
      summary.issueResults.push({ identifier: issue.identifier, action: 'no_directive' });
      continue;
    }

    const targetName = stripBracketsAndTrim(selected.targetName);
    const target = activeAgentByName.get(targetName);

    if (!target) {
      summary.invalidTargets += 1;
      summary.issueResults.push({ identifier: issue.identifier, action: 'invalid_target', targetName });
      continue;
    }

    if (issue.assigneeAgentId === target.id) {
      summary.alreadyCorrect += 1;
      summary.issueResults.push({ identifier: issue.identifier, action: 'already_correct', targetName });
      continue;
    }

    const combinedRecent = [
      ...extractDirectives(issue.description || '').map((t) => ({
        createdAt: issue.createdAt || '1970-01-01T00:00:00.000Z',
        id: `description:${issue.id}`,
        targetName: stripBracketsAndTrim(t),
      })),
      ...comments.flatMap((c) =>
        extractDirectives(c.body || '').map((t) => ({
          createdAt: c.createdAt || '1970-01-01T00:00:00.000Z',
          id: String(c.id || ''),
          targetName: stripBracketsAndTrim(t),
        })),
      ),
    ]
      .sort((a, b) => {
        if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
        return String(a.id).localeCompare(String(b.id));
      })
      .map((d) => d.targetName);

    const recentTargets = combinedRecent.slice(-4);
    const pingPong =
      recentTargets.length === 4 &&
      recentTargets[0] === recentTargets[2] &&
      recentTargets[1] === recentTargets[3] &&
      recentTargets[0] !== recentTargets[1];

    if (pingPong) {
      const artifact = pingPongArtifact(recentTargets);
      const warnRes = await requestJson({
        name: `comment_pingpong_${issue.identifier || issue.id}`,
        url: `${apiUrl}/api/issues/${issue.id}/comments`,
        method: 'POST',
        body: {
          body: `Routing clarification: repeated reassignment detected. Missing artifact before next handoff: ${artifact}.`,
        },
        mutate: true,
      });
      if (warnRes.ok) summary.pingPongWarnings += 1;
    }

    const patchRes = await requestJson({
      name: `patch_assign_${issue.identifier || issue.id}`,
      url: `${apiUrl}/api/issues/${issue.id}`,
      method: 'PATCH',
      body: { assigneeAgentId: target.id, comment: `Assigned to ${target.name}.` },
      mutate: true,
    });

    if (!patchRes.ok) {
      summary.skippedFailures += 1;
      summary.issueResults.push({ identifier: issue.identifier, action: 'patch_failed', targetName, error: patchRes.error });
      continue;
    }

    summary.reassigned += 1;
    summary.issueResults.push({ identifier: issue.identifier, action: 'reassigned', targetName });
  }

  const recoveryIds = Array.from(recoveryIssueIds);
  summary.checkout409Candidates = recoveryIds.length;

  for (const issueId of recoveryIds) {
    const oldIssue = issueMap.get(issueId);
    const comments = commentsByIssue.get(issueId) || [];
    if (!oldIssue) {
      summary.checkout409RecoveryFailed += 1;
      summary.recoveryResults.push({ issueId, action: 'skip_missing_issue_payload' });
      continue;
    }

    const boardCommentBody =
      'Board: please release checkout for this issue (assignee got 409). See docs/PAPERCLIP_SETUP.md § Release a stuck checkout.';

    const boardCommentRes = await requestJson({
      name: `recovery_board_comment_${oldIssue.identifier || issueId}`,
      url: `${apiUrl}/api/issues/${issueId}/comments`,
      method: 'POST',
      mutate: true,
      body: { body: boardCommentBody },
    });

    if (!boardCommentRes.ok) {
      summary.checkout409RecoveryFailed += 1;
      summary.recoveryResults.push({
        identifier: oldIssue.identifier,
        action: 'failed_board_comment',
        error: boardCommentRes.error,
      });
      continue;
    }

    const cancelRes = await requestJson({
      name: `recovery_cancel_${oldIssue.identifier || issueId}`,
      url: `${apiUrl}/api/issues/${issueId}`,
      method: 'PATCH',
      mutate: true,
      body: { status: 'cancelled', assigneeAgentId: null },
    });

    if (!cancelRes.ok) {
      summary.checkout409RecoveryFailed += 1;
      summary.recoveryResults.push({
        identifier: oldIssue.identifier,
        action: 'failed_cancel_old_issue',
        error: cancelRes.error,
      });
      continue;
    }

    const lastDirective = selectLastDirective(oldIssue, comments);
    const targetName = lastDirective ? stripBracketsAndTrim(lastDirective.targetName) : '';
    const targetAgent = targetName ? activeAgentByName.get(targetName) : null;

    const newDescription = buildRecoveryDescription(oldIssue, comments, agentsById, boardCommentBody);

    const createBody = {
      projectId: oldIssue.projectId,
      goalId: oldIssue.goalId || null,
      parentId: oldIssue.parentId || null,
      title: oldIssue.title,
      description: newDescription,
      status: 'todo',
      assigneeAgentId: targetAgent ? targetAgent.id : null,
      priority: oldIssue.priority || 'medium',
    };

    const createRes = await requestJson({
      name: `recovery_create_${oldIssue.identifier || issueId}`,
      url: `${apiUrl}/api/companies/${companyId}/issues`,
      method: 'POST',
      mutate: true,
      body: createBody,
    });

    if (!createRes.ok) {
      summary.checkout409RecoveryFailed += 1;
      summary.recoveryResults.push({
        identifier: oldIssue.identifier,
        action: 'failed_create_replacement',
        targetName: targetName || null,
        error: createRes.error,
      });
      continue;
    }

    const newIssue = createRes.data || {};

    const supersedeRes = await requestJson({
      name: `recovery_superseded_comment_${oldIssue.identifier || issueId}`,
      url: `${apiUrl}/api/issues/${issueId}/comments`,
      method: 'POST',
      mutate: true,
      body: { body: `Superseded by ${newIssue.identifier || newIssue.id}.` },
    });

    if (!supersedeRes.ok) {
      summary.skippedFailures += 1;
    }

    if (newIssue.id) {
      const newInfoRes = await requestJson({
        name: `recovery_new_info_comment_${newIssue.identifier || newIssue.id}`,
        url: `${apiUrl}/api/issues/${newIssue.id}/comments`,
        method: 'POST',
        mutate: true,
        body: {
          body: `Recovery ticket; previous ${oldIssue.identifier || oldIssue.id} stuck (checkout 409) and cancelled.`,
        },
      });
      if (!newInfoRes.ok) summary.skippedFailures += 1;
    }

    summary.checkout409Recovered += 1;
    summary.recoveryResults.push({
      oldIdentifier: oldIssue.identifier,
      newIdentifier: newIssue.identifier || newIssue.id,
      targetName: targetAgent ? targetAgent.name : null,
      action: 'recovered_clone_and_cancel',
    });
  }

  const inboxRes = await requestJson({
    name: 'ceo_inbox',
    url: `${apiUrl}/api/companies/${companyId}/issues?assigneeAgentId=${me.id}&status=todo,in_progress,blocked`,
  });

  if (inboxRes.ok) {
    for (const i of asItems(inboxRes.data)) {
      if (i.status === 'todo') summary.inbox.todo += 1;
      else if (i.status === 'in_progress') summary.inbox.in_progress += 1;
      else if (i.status === 'blocked') summary.inbox.blocked += 1;
    }
  }

  const summaryPath = path.join(outDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})();
