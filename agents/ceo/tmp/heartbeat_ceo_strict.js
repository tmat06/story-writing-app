const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const apiUrl = process.env.PAPERCLIP_API_URL;
const apiKey = process.env.PAPERCLIP_API_KEY;
const companyId = process.env.PAPERCLIP_COMPANY_ID;
const runId = process.env.PAPERCLIP_RUN_ID;

if (!apiUrl || !apiKey || !companyId || !runId) {
  console.error('Missing required PAPERCLIP_* env vars.');
  process.exit(0);
}

const outDir = path.join(
  'agents',
  'ceo',
  'tmp',
  `heartbeat_${new Date().toISOString().replace(/[:.]/g, '').replace('T', '_').slice(0, 15)}`,
);
fs.mkdirSync(outDir, { recursive: true });

const ASSIGN_RE = /^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$/gm;
const STUCK_409_RE = /(?:^|\r?\n)Checkout release requested: 409(?:\r?\n|$)/;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
  if (d && Array.isArray(d.projects)) return d.projects;
  if (d && Array.isArray(d.issues)) return d.issues;
  if (d && Array.isArray(d.comments)) return d.comments;
  if (d && Array.isArray(d.agents)) return d.agents;
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
  if (d.meta && typeof d.meta.nextCursor === 'string' && d.meta.nextCursor) {
    return { type: 'cursor', value: d.meta.nextCursor };
  }
  if (typeof d.nextPage === 'number') return { type: 'page', value: d.nextPage };
  if (typeof d.page === 'number' && typeof d.totalPages === 'number' && d.page < d.totalPages) {
    return { type: 'page', value: d.page + 1 };
  }
  if (d.hasMore === true && typeof d.page === 'number') return { type: 'page', value: d.page + 1 };
  return null;
}

function extractDirectives(text) {
  const out = [];
  ASSIGN_RE.lastIndex = 0;
  const src = String(text || '');
  let m;
  while ((m = ASSIGN_RE.exec(src)) !== null) {
    out.push(stripBracketsAndTrim(m[1]));
  }
  return out;
}

function hasCheckoutReleaseRequested409(text) {
  return STUCK_409_RE.test(String(text || ''));
}

function runCurl(url, outFile, method = 'GET', body = null, mutate = false, strict = false) {
  const args = ['-sS'];
  if (strict) args.push('-f');
  args.push('-X', method, '-H', `Authorization: Bearer ${apiKey}`, '-H', 'Accept: application/json');
  if (mutate) args.push('-H', `X-Paperclip-Run-Id: ${runId}`);
  if (body !== null) args.push('-H', 'Content-Type: application/json', '--data-binary', JSON.stringify(body));
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
        return { ok: false, retryable: true, reason: `empty body (${attemptName})` };
      }
      if (Number.isNaN(status) || status < 200 || status > 299) {
        return {
          ok: false,
          retryable: status === 429 || status >= 500 || status === 0,
          reason: `HTTP ${status} (${attemptName})`,
        };
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

  const parseSaved = () => {
    const saved = fs.readFileSync(file, 'utf8');
    if (!saved || saved.trim().length === 0) throw new Error('saved file empty');
    return JSON.parse(saved);
  };

  try {
    return { ok: true, file, data: parseSaved() };
  } catch (err) {
    await sleep(400);
    const strictRefetch = await attemptRequest('parse-refetch', true);
    if (!strictRefetch.ok) return { ok: false, file, error: `parse failed then strict refetch failed: ${strictRefetch.reason}` };
    try {
      return { ok: true, file, data: parseSaved() };
    } catch (err2) {
      return { ok: false, file, error: `parse failed after strict refetch: ${err2.message}` };
    }
  }
}

async function fetchAllPages({ name, url, pageLimit = 500 }) {
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
    if (!res.ok) return { ok: false, error: res.error, data: all, pages };

    asItems(res.data).forEach((it) => all.push(it));
    pages += 1;

    const next = nextToken(res.data);
    if (!next) break;
    if (next.type === 'cursor') cursor = next.value;
    else {
      page = next.value;
      cursor = null;
    }
    if (pages > pageLimit) return { ok: false, error: `${name} pagination safety limit exceeded`, data: all, pages };
  }

  return { ok: true, data: all, pages };
}

function sortDirectiveRows(rows) {
  rows.sort((a, b) => {
    if (a.createdAt !== b.createdAt) return a.createdAt.localeCompare(b.createdAt);
    return String(a.id).localeCompare(String(b.id));
  });
}

function collectDirectives(issue, comments) {
  const descriptionDirectives = [];
  const commentDirectives = [];

  extractDirectives(issue.description || '').forEach((targetName) => {
    descriptionDirectives.push({
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

  sortDirectiveRows(descriptionDirectives);
  sortDirectiveRows(commentDirectives);
  return { descriptionDirectives, commentDirectives };
}

function selectLatestDirective(issue, comments) {
  const { descriptionDirectives, commentDirectives } = collectDirectives(issue, comments);
  if (commentDirectives.length > 0) return commentDirectives[commentDirectives.length - 1];
  if (descriptionDirectives.length > 0) return descriptionDirectives[descriptionDirectives.length - 1];
  return null;
}

function detectPingPong(issue, comments) {
  const { descriptionDirectives, commentDirectives } = collectDirectives(issue, comments);
  const combined = [...descriptionDirectives, ...commentDirectives];
  sortDirectiveRows(combined);
  const recentTargets = combined.slice(-4).map((r) => stripBracketsAndTrim(r.targetName));
  return (
    recentTargets.length === 4 &&
    recentTargets[0] === recentTargets[2] &&
    recentTargets[1] === recentTargets[3] &&
    recentTargets[0] !== recentTargets[1]
  );
}

function pingPongArtifact(issue, comments) {
  const { descriptionDirectives, commentDirectives } = collectDirectives(issue, comments);
  const combined = [...descriptionDirectives, ...commentDirectives];
  sortDirectiveRows(combined);
  const targets = combined.slice(-4).map((r) => stripBracketsAndTrim(r.targetName));
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

(async () => {
  const summary = {
    runId,
    outDir,
    projectId: null,
    projectName: null,
    pages: { projects: 0, agents: 0, issues: 0 },
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
    console.error(JSON.stringify({ phase: 'identity', error: meRes.error }));
    process.exit(0);
  }
  const me = meRes.data;

  const projectsRes = await fetchAllPages({ name: 'projects', url: `${apiUrl}/api/companies/${companyId}/projects` });
  if (!projectsRes.ok) {
    console.error(JSON.stringify({ phase: 'projects', error: projectsRes.error }));
    process.exit(0);
  }
  summary.pages.projects = projectsRes.pages;

  const projects = projectsRes.data;
  const project = projects.find((p) => {
    const n = String(p.name || '').toLowerCase();
    const k = String(p.urlKey || '').toLowerCase();
    const ws = Array.isArray(p.workspaces) ? p.workspaces : [];
    const wsHit = ws.some((w) => {
      const name = String(w.name || '').toLowerCase();
      const repo = String(w.repoUrl || '').toLowerCase();
      const cwd = String(w.cwd || '').toLowerCase();
      return name.includes('story-writing-app') || repo.includes('story-writing-app') || cwd.includes('story-writing-app');
    });
    return n.includes('story writing app') || n.includes('story-writing-app') || k.includes('story-writing-app') || wsHit;
  });
  if (!project) {
    console.error(JSON.stringify({ phase: 'project_match', error: 'Story Writing App project not found' }));
    process.exit(0);
  }

  summary.projectId = project.id;
  summary.projectName = project.name;

  const agentsRes = await fetchAllPages({ name: 'agents', url: `${apiUrl}/api/companies/${companyId}/agents` });
  if (!agentsRes.ok) {
    console.error(JSON.stringify({ phase: 'agents', error: agentsRes.error }));
    process.exit(0);
  }
  summary.pages.agents = agentsRes.pages;

  const activeAgentByName = new Map();
  const agentsById = new Map();
  for (const a of agentsRes.data) {
    agentsById.set(a.id, a);
    if (String(a.status || '').toLowerCase() !== 'terminated' && a.isActive !== false) {
      const nm = stripBracketsAndTrim(a.name || '');
      if (nm && !activeAgentByName.has(nm)) activeAgentByName.set(nm, a);
    }
  }

  const issuesUrl = new URL(`${apiUrl}/api/companies/${companyId}/issues`);
  issuesUrl.searchParams.set('projectId', project.id);
  issuesUrl.searchParams.set('status', 'backlog,todo,in_progress,in_review,blocked');
  issuesUrl.searchParams.set('limit', '100');
  const issuesRes = await fetchAllPages({ name: 'issues', url: issuesUrl.toString(), pageLimit: 1000 });
  if (!issuesRes.ok) {
    console.error(JSON.stringify({ phase: 'issues', error: issuesRes.error }));
    process.exit(0);
  }
  summary.pages.issues = issuesRes.pages;

  const issues = issuesRes.data;
  summary.scannedIssues = issues.length;

  const issueById = new Map();
  const commentsByIssueId = new Map();
  const stuckIssueIds = new Set();

  for (const issue of issues) {
    issueById.set(issue.id, issue);

    const commentsRes = await fetchAllPages({
      name: `comments_${issue.identifier || issue.id}`,
      url: `${apiUrl}/api/issues/${issue.id}/comments`,
      pageLimit: 1000,
    });

    if (!commentsRes.ok) {
      summary.skippedFailures += 1;
      summary.issueResults.push({ identifier: issue.identifier, action: 'skip_comments_fetch_failed', error: commentsRes.error });
      continue;
    }

    const comments = commentsRes.data;
    commentsByIssueId.set(issue.id, comments);
    comments.forEach((c) => {
      if (hasCheckoutReleaseRequested409(c.body || '')) stuckIssueIds.add(issue.id);
    });

    const selected = selectLatestDirective(issue, comments);
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

    if (detectPingPong(issue, comments)) {
      const artifact = pingPongArtifact(issue, comments);
      const warnRes = await requestJson({
        name: `comment_pingpong_${issue.identifier || issue.id}`,
        url: `${apiUrl}/api/issues/${issue.id}/comments`,
        method: 'POST',
        body: { body: `Routing clarification: repeated reassignment detected. Missing artifact before next handoff: ${artifact}.` },
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

  summary.checkout409Candidates = stuckIssueIds.size;
  const recoveryBoardComment =
    'Board: please release checkout for this issue (assignee got 409). See docs/PAPERCLIP_SETUP.md § Release a stuck checkout.';

  for (const issueId of stuckIssueIds) {
    const oldIssue = issueById.get(issueId);
    const comments = commentsByIssueId.get(issueId) || [];
    if (!oldIssue) {
      summary.checkout409RecoveryFailed += 1;
      summary.recoveryResults.push({ issueId, action: 'skip_missing_issue' });
      continue;
    }

    const boardCommentRes = await requestJson({
      name: `recovery_board_comment_${oldIssue.identifier || oldIssue.id}`,
      url: `${apiUrl}/api/issues/${oldIssue.id}/comments`,
      method: 'POST',
      body: { body: recoveryBoardComment },
      mutate: true,
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
      name: `recovery_cancel_${oldIssue.identifier || oldIssue.id}`,
      url: `${apiUrl}/api/issues/${oldIssue.id}`,
      method: 'PATCH',
      body: { status: 'cancelled', assigneeAgentId: null },
      mutate: true,
    });
    if (!cancelRes.ok) {
      summary.checkout409RecoveryFailed += 1;
      summary.recoveryResults.push({
        identifier: oldIssue.identifier,
        action: 'failed_cancel',
        error: cancelRes.error,
      });
      continue;
    }

    const selected = selectLatestDirective(oldIssue, comments);
    const targetName = selected ? stripBracketsAndTrim(selected.targetName) : '';
    const targetAgent = targetName ? activeAgentByName.get(targetName) : null;

    const createRes = await requestJson({
      name: `recovery_create_${oldIssue.identifier || oldIssue.id}`,
      url: `${apiUrl}/api/companies/${companyId}/issues`,
      method: 'POST',
      body: {
        projectId: oldIssue.projectId,
        goalId: oldIssue.goalId || null,
        parentId: oldIssue.parentId || null,
        title: oldIssue.title,
        description: buildRecoveryDescription(oldIssue, comments, agentsById, recoveryBoardComment),
        status: 'todo',
        assigneeAgentId: targetAgent ? targetAgent.id : null,
        priority: oldIssue.priority || 'medium',
      },
      mutate: true,
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
      name: `recovery_superseded_comment_${oldIssue.identifier || oldIssue.id}`,
      url: `${apiUrl}/api/issues/${oldIssue.id}/comments`,
      method: 'POST',
      body: { body: `Superseded by ${newIssue.identifier || newIssue.id}.` },
      mutate: true,
    });
    if (!supersedeRes.ok) summary.skippedFailures += 1;

    if (newIssue.id) {
      const newInfoRes = await requestJson({
        name: `recovery_new_info_comment_${newIssue.identifier || newIssue.id}`,
        url: `${apiUrl}/api/issues/${newIssue.id}/comments`,
        method: 'POST',
        body: {
          body: `Recovery ticket; previous ${oldIssue.identifier || oldIssue.id} stuck (checkout 409) and cancelled.`,
        },
        mutate: true,
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

  const inboxRes = await fetchAllPages({
    name: 'ceo_inbox',
    url: `${apiUrl}/api/companies/${companyId}/issues?assigneeAgentId=${me.id}&status=todo,in_progress,blocked`,
  });
  if (inboxRes.ok) {
    for (const i of inboxRes.data) {
      if (i.status === 'todo') summary.inbox.todo += 1;
      else if (i.status === 'in_progress') summary.inbox.in_progress += 1;
      else if (i.status === 'blocked') summary.inbox.blocked += 1;
    }
  }

  fs.writeFileSync(path.join(outDir, 'summary.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify(summary, null, 2));
})();
