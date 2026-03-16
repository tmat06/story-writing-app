import fs from 'fs';
import path from 'path';

const API_URL = process.env.PAPERCLIP_API_URL;
const API_KEY = process.env.PAPERCLIP_API_KEY;
const COMPANY_ID = process.env.PAPERCLIP_COMPANY_ID;
const RUN_ID = process.env.PAPERCLIP_RUN_ID;

if (!API_URL || !API_KEY || !COMPANY_ID || !RUN_ID) {
  console.error('Missing required PAPERCLIP env vars.');
  process.exit(1);
}

const now = new Date();
const stamp = now.toISOString().replace(/[:.]/g, '-');
const outDir = path.join(process.cwd(), 'agents/ceo/tmp', `heartbeat-${stamp}`);
fs.mkdirSync(outDir, { recursive: true });

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function requestWithRetry(label, relPath, options = {}, { mutate = false } = {}) {
  const url = `${API_URL}${relPath}`;
  const headers = {
    Authorization: `Bearer ${API_KEY}`,
    ...(options.headers || {}),
  };
  if (mutate) headers['X-Paperclip-Run-Id'] = RUN_ID;

  let lastErr;
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    try {
      const res = await fetch(url, { ...options, headers, signal: AbortSignal.timeout(20000) });
      const text = await res.text();
      const fileBase = `${label}.attempt${attempt}.json`;
      const filePath = path.join(outDir, fileBase);
      fs.writeFileSync(filePath, text || '', 'utf8');

      if (!text || text.trim().length === 0) {
        throw new Error(`Empty response body for ${label}`);
      }

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch (err) {
        throw new Error(`JSON parse failure for ${label}: ${err.message}`);
      }

      if (!res.ok) {
        const error = new Error(`HTTP ${res.status} for ${label}`);
        error.status = res.status;
        error.body = parsed;
        throw error;
      }

      return { parsed, status: res.status, filePath };
    } catch (err) {
      lastErr = err;
      const status = err.status || 0;
      const shouldRetry = attempt === 1 && (status === 429 || status >= 500 || status === 0);
      if (shouldRetry) {
        await sleep(400);
        continue;
      }
      if (attempt === 1) {
        await sleep(250);
        continue;
      }
    }
  }
  throw lastErr;
}

function stripBracketsAndTrim(value) {
  const t = String(value || '').trim();
  if (t.startsWith('[') && t.endsWith(']')) return t.slice(1, -1).trim();
  return t;
}

function extractDirectives(text) {
  const body = String(text || '');
  const regex = /^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$/gm;
  const matches = [];
  let m;
  while ((m = regex.exec(body)) !== null) {
    matches.push(stripBracketsAndTrim(m[1]));
  }
  return matches;
}

function hasCheckout409Line(text) {
  const lines = String(text || '').split(/\r?\n/);
  return lines.includes('Checkout release requested: 409');
}

function toMillis(value, fallback = 0) {
  const ms = Date.parse(value || '');
  return Number.isFinite(ms) ? ms : fallback;
}

async function main() {
  const summary = {
    projectId: null,
    projectName: null,
    totalIssuesScanned: 0,
    reassigned: 0,
    skippedAlreadyCorrect: 0,
    noValidDirective: 0,
    invalidDirective: 0,
    commentDirectiveWins: 0,
    descriptionDirectiveUsed: 0,
    releasesAttempted: 0,
    releasesSucceeded: 0,
    releasesFailed: 0,
    releaseIssueIds: [],
    assignmentChanges: [],
    failures: [],
  };

  const me = await requestWithRetry('agents_me', '/api/agents/me');
  const myAgentId = me.parsed?.id;

  const projectsRes = await requestWithRetry('projects', `/api/companies/${COMPANY_ID}/projects`);
  const projects = Array.isArray(projectsRes.parsed) ? projectsRes.parsed : (projectsRes.parsed?.items || []);

  const target = projects.find((p) => {
    const name = String(p?.name || '').toLowerCase();
    const primaryCwd = String(p?.primaryWorkspace?.cwd || '').toLowerCase();
    const primaryRepo = String(p?.primaryWorkspace?.repoUrl || '').toLowerCase();
    const workspaces = Array.isArray(p?.workspaces) ? p.workspaces : [];
    const wsHit = workspaces.some((ws) => {
      const cwd = String(ws?.cwd || '').toLowerCase();
      const repo = String(ws?.repoUrl || '').toLowerCase();
      const wsName = String(ws?.name || '').toLowerCase();
      return cwd.includes('story-writing-app') || repo.includes('story-writing-app') || wsName.includes('story-writing-app');
    });
    return (
      name.includes('story-writing-app') ||
      primaryCwd.includes('story-writing-app') ||
      primaryRepo.includes('story-writing-app') ||
      wsHit
    );
  });

  if (!target?.id) {
    throw new Error('Could not locate story-writing-app project id.');
  }
  summary.projectId = target.id;
  summary.projectName = target.name || null;

  const agentsRes = await requestWithRetry('agents', `/api/companies/${COMPANY_ID}/agents`);
  const agents = Array.isArray(agentsRes.parsed) ? agentsRes.parsed : (agentsRes.parsed?.items || []);
  const activeAgents = agents.filter((a) => !a.archivedAt && !a.deletedAt);
  const nameToAgent = new Map();
  for (const a of activeAgents) {
    const key = stripBracketsAndTrim(a.name || '');
    if (key) nameToAgent.set(key, a);
  }

  // Pagination for all active statuses
  const statuses = 'backlog,todo,in_progress,in_review,blocked';
  let page = 1;
  let allIssues = [];
  const seenIssueIds = new Set();
  while (true) {
    const rel = `/api/companies/${COMPANY_ID}/issues?projectId=${encodeURIComponent(target.id)}&status=${encodeURIComponent(statuses)}&page=${page}`;
    const pageRes = await requestWithRetry(`issues_page_${page}`, rel);
    const parsed = pageRes.parsed;
    const items = Array.isArray(parsed) ? parsed : (Array.isArray(parsed?.items) ? parsed.items : []);
    if (items.length === 0) break;

    let newCount = 0;
    for (const item of items) {
      if (!seenIssueIds.has(item.id)) {
        seenIssueIds.add(item.id);
        allIssues.push(item);
        newCount += 1;
      }
    }
    if (newCount === 0) break;

    if (Array.isArray(parsed)) {
      // unknown total; continue until empty page
      page += 1;
      continue;
    }

    const totalPages = Number(parsed?.totalPages || parsed?.pages || 0);
    const hasNext = Boolean(parsed?.hasNextPage) || (totalPages > 0 && page < totalPages);
    if (!hasNext) break;
    page += 1;
  }

  summary.totalIssuesScanned = allIssues.length;
  console.error(`Scanned issue list size: ${allIssues.length}`);

  const releaseCandidates = new Set();

  for (let idx = 0; idx < allIssues.length; idx += 1) {
    const issue = allIssues[idx];
    if (idx % 25 === 0) console.error(`Processing issue ${idx + 1}/${allIssues.length}`);
    const issueId = issue.id;
    const issueKey = issue.identifier || issueId;

    let comments = [];
    try {
      const commentsRes = await requestWithRetry(`issue_${issueKey}_comments`, `/api/issues/${issueId}/comments`);
      comments = Array.isArray(commentsRes.parsed) ? commentsRes.parsed : (commentsRes.parsed?.items || []);
    } catch (err) {
      summary.failures.push({ issue: issueKey, stage: 'comments', error: String(err.message || err) });
      continue;
    }

    for (const c of comments) {
      if (hasCheckout409Line(c?.body || '')) {
        releaseCandidates.add(issueId);
        break;
      }
    }

    const directives = [];

    const descriptionMatches = extractDirectives(issue.description || '');
    for (const m of descriptionMatches) {
      directives.push({
        source: 'description',
        targetNameRaw: m,
        sortCreatedAt: toMillis(issue.createdAt, 0),
        sortId: 0,
      });
    }

    for (const c of comments) {
      const matches = extractDirectives(c?.body || '');
      for (const m of matches) {
        directives.push({
          source: 'comment',
          targetNameRaw: m,
          sortCreatedAt: toMillis(c.createdAt, 0),
          sortId: Number(c.id) || 0,
        });
      }
    }

    if (directives.length === 0) {
      summary.noValidDirective += 1;
      continue;
    }

    directives.sort((a, b) => {
      if (a.sortCreatedAt !== b.sortCreatedAt) return a.sortCreatedAt - b.sortCreatedAt;
      return a.sortId - b.sortId;
    });

    const selected = directives[directives.length - 1];
    if (selected.source === 'comment') summary.commentDirectiveWins += 1;
    if (selected.source === 'description') summary.descriptionDirectiveUsed += 1;

    const targetName = stripBracketsAndTrim(selected.targetNameRaw);
    const targetAgent = nameToAgent.get(targetName);

    if (!targetAgent?.id) {
      summary.invalidDirective += 1;
      continue;
    }

    if (issue.assigneeAgentId === targetAgent.id) {
      summary.skippedAlreadyCorrect += 1;
      continue;
    }

    try {
      await requestWithRetry(
        `issue_${issueKey}_assign_patch`,
        `/api/issues/${issueId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ assigneeAgentId: targetAgent.id }),
        },
        { mutate: true },
      );

      await requestWithRetry(
        `issue_${issueKey}_assign_comment`,
        `/api/issues/${issueId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: `Assigned to ${targetAgent.name}.` }),
        },
        { mutate: true },
      );

      summary.reassigned += 1;
      summary.assignmentChanges.push({
        issue: issueKey,
        to: targetAgent.name,
      });
    } catch (err) {
      summary.failures.push({ issue: issueKey, stage: 'assign', error: String(err.message || err) });
      continue;
    }
  }

  for (const issueId of releaseCandidates) {
    summary.releasesAttempted += 1;

    const issue = allIssues.find((i) => i.id === issueId);
    const issueKey = issue?.identifier || issueId;

    try {
      await requestWithRetry(
        `issue_${issueKey}_release`,
        `/api/issues/${issueId}/release`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        { mutate: true },
      );

      await requestWithRetry(
        `issue_${issueKey}_release_comment_ok`,
        `/api/issues/${issueId}/comments`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ body: 'Released checkout. You can checkout again on your next run.' }),
        },
        { mutate: true },
      );

      summary.releasesSucceeded += 1;
      summary.releaseIssueIds.push(issueKey);
    } catch (err) {
      summary.releasesFailed += 1;
      summary.failures.push({ issue: issueKey, stage: 'release', error: String(err.message || err) });

      try {
        await requestWithRetry(
          `issue_${issueKey}_release_comment_fail`,
          `/api/issues/${issueId}/comments`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ body: 'Board: please release checkout for this issue (assignee got 409). See docs/PAPERCLIP_SETUP.md § Release a stuck checkout.' }),
          },
          { mutate: true },
        );
      } catch (commentErr) {
        summary.failures.push({ issue: issueKey, stage: 'release-comment-fallback', error: String(commentErr.message || commentErr) });
      }
    }
  }

  // Inbox summary
  let inbox = [];
  try {
    const inboxRes = await requestWithRetry(
      'my_inbox',
      `/api/companies/${COMPANY_ID}/issues?assigneeAgentId=${encodeURIComponent(myAgentId)}&status=todo,in_progress,blocked`,
    );
    inbox = Array.isArray(inboxRes.parsed) ? inboxRes.parsed : (inboxRes.parsed?.items || []);
  } catch (err) {
    summary.failures.push({ issue: '-', stage: 'inbox', error: String(err.message || err) });
  }

  const output = {
    runId: RUN_ID,
    generatedAt: now.toISOString(),
    outDir,
    summary,
    inbox: inbox.map((i) => ({ id: i.id, identifier: i.identifier, title: i.title, status: i.status, assigneeAgentId: i.assigneeAgentId })),
  };

  const summaryPath = path.join(outDir, 'summary.json');
  fs.writeFileSync(summaryPath, JSON.stringify(output, null, 2), 'utf8');
  console.log(summaryPath);
}

main().catch((err) => {
  console.error('Heartbeat routing failed:', err);
  process.exit(1);
});
