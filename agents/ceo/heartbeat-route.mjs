#!/usr/bin/env node
/**
 * CEO heartbeat routing script — label-based issue assignment.
 *
 * Run: node agents/ceo/heartbeat-route.mjs
 *
 * Reads env vars set by Paperclip:
 *   PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID,
 *   PAPERCLIP_RUN_ID, PAPERCLIP_WAKE_REASON, PAPERCLIP_TASK_ID
 *
 * Exits 0 on success (even if nothing to route), 1 on fatal error.
 * Prints a JSON summary to stdout.
 *
 * DO NOT MODIFY this file from within an agent heartbeat.
 * It is version-controlled and managed by the board only.
 */

const API     = (process.env.PAPERCLIP_API_URL ?? 'http://127.0.0.1:3100').replace(/\/$/, '');
const KEY     = process.env.PAPERCLIP_API_KEY ?? '';
const COMPANY = process.env.PAPERCLIP_COMPANY_ID ?? '';
const RUN_ID  = process.env.PAPERCLIP_RUN_ID ?? '';
const WAKE    = process.env.PAPERCLIP_WAKE_REASON ?? '';
const TASK_ID = process.env.PAPERCLIP_TASK_ID ?? '';

if (!COMPANY) { console.error('PAPERCLIP_COMPANY_ID not set'); process.exit(1); }
if (!KEY)     { console.error('PAPERCLIP_API_KEY not set');     process.exit(1); }

// Pipeline label name → target agent name
const LABEL_TO_AGENT = {
  'needs-market-research': 'Market Research',
  'needs-design':          'Design',
  'needs-plan':            'Founding Engineer',
  'needs-implementation':  'Code Monkey',
  'needs-review':          'Code Reviewer',
  'needs-revision':        'Founding Engineer',
};

const CONCURRENCY_LIMIT = 1; // max todo/in_progress tickets per agent

// Default GitHub owner/repo for compare-URL fallback when thread has Branch: but no PR link.
const DEFAULT_GITHUB_REPO = (process.env.STORY_APP_GITHUB_REPO ?? 'tmat06/story-writing-app').replace(
  /^\/+|\/+$/g,
  '',
);

// ---------------------------------------------------------------------------
// API helpers
// ---------------------------------------------------------------------------

async function request(method, path, body = null) {
  const headers = { 'Authorization': `Bearer ${KEY}`, 'Content-Type': 'application/json' };
  if (body && RUN_ID) headers['X-Paperclip-Run-Id'] = RUN_ID;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return res.json().catch(() => null);
}

function toArray(payload) {
  if (Array.isArray(payload))        return payload;
  if (Array.isArray(payload?.items)) return payload.items;
  if (Array.isArray(payload?.data))  return payload.data;
  return [];
}

async function getAllIssues(projectId) {
  const statuses = 'backlog,todo,in_progress,in_review,blocked';
  const all = [];
  let page = 1;
  while (true) {
    const payload = await request('GET',
      `/api/companies/${COMPANY}/issues?projectId=${projectId}&status=${statuses}&page=${page}&limit=100`
    );
    const chunk = toArray(payload);
    all.push(...chunk);
    if (chunk.length === 0)                             break;
    if (payload?.nextCursor === null)                   break;
    if (payload?.nextCursor === undefined && chunk.length < 100) break;
    page++;
  }
  return all;
}

function mergeTicketTitle(identifier) {
  return `Review and merge: ${identifier}`;
}

function mergeTicketAlreadyExists(existingIssues, identifier) {
  const want = mergeTicketTitle(identifier);
  return existingIssues.some((i) => (i.title ?? '').trim() === want);
}

function extractPrUrlAndBranchFromComments(commentsPayload) {
  const comments = toArray(commentsPayload);
  const text = comments.map((c) => c.body ?? '').join('\n');
  const prMatch = text.match(/https:\/\/github\.com\/[^/\s]+\/[^/\s]+\/pull\/\d+/);
  const prUrl = prMatch ? prMatch[0].replace(/[.,;:)]+$/, '') : null;
  const brMatch = text.match(/Branch:\s*(\S+)/i);
  const branch = brMatch ? brMatch[1].replace(/[.,;:)]+$/, '') : null;
  return { prUrl, branch };
}

/**
 * If Code Reviewer skipped create-merge-ticket.mjs, create the board queue issue here.
 * Requires a GitHub PR URL or a `Branch: …` line in the original issue comments.
 */
async function ensureMergeTicketIfMissing(issue, project, existingIssues, company) {
  const identifier = issue.identifier ?? issue.id;

  if (mergeTicketAlreadyExists(existingIssues, identifier)) {
    return { skipped: 'merge_ticket_already_exists' };
  }

  const boardUserId = issue.createdByUserId;
  if (!boardUserId) {
    return { skipped: 'original_missing_createdByUserId' };
  }

  const commentsRaw = await request('GET', `/api/issues/${issue.id}/comments`);
  const { prUrl, branch } = extractPrUrlAndBranchFromComments(commentsRaw);

  let linkBlock = '';
  if (prUrl) {
    linkBlock = `**PR:** ${prUrl}\n`;
  } else if (branch) {
    const enc = encodeURIComponent(branch);
    linkBlock =
      `**Compare (open PR from here):** https://github.com/${DEFAULT_GITHUB_REPO}/compare/main...${enc}\n` +
      `**Branch:** \`${branch}\`\n`;
  } else {
    return { skipped: 'no_github_pr_or_branch_in_comments' };
  }

  const description =
    'Automated merge ticket from `heartbeat-route.mjs` (created because no matching queue ticket existed).\n\n' +
    'Merge into `main` on GitHub when ready.\n\n' +
    linkBlock +
    `\n**Original implementation issue:** ${identifier}`;

  const created = await request('POST', `/api/companies/${company}/issues`, {
    projectId: issue.projectId ?? project.id,
    goalId: issue.goalId ?? null,
    parentId: issue.id,
    title: mergeTicketTitle(identifier),
    description,
    status: 'todo',
  });

  const mergeId = created?.id ?? created?.issue?.id;
  if (!mergeId) {
    throw new Error('POST merge ticket returned no issue id');
  }

  await request('PATCH', `/api/issues/${mergeId}`, {
    assigneeAgentId: null,
    assigneeUserId: boardUserId,
  });

  await request('POST', `/api/issues/${issue.id}/comments`, {
    body: `Merge queue ticket created (routing automation): ${mergeTicketTitle(identifier)}.`,
  });

  return {
    merge_ticket_created: true,
    original: identifier,
    mergeIssueId: mergeId,
    mergeIdentifier: created?.identifier ?? created?.issue?.identifier ?? mergeId,
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const summary = {
    wake: WAKE || 'unknown',
    scanned: 0,
    routed: [],
    already_correct: [],
    skipped_no_label: [],
    skipped_concurrency: [],
    checkout_stuck_recovered: [],
    merge_tickets_created: [],
    merge_ticket_skipped: [],
    merge_ticket_failed: [],
    errors: [],
  };

  // 1. Fetch labels, agents, projects in parallel
  const [labelsRaw, agentsRaw, projectsRaw] = await Promise.all([
    request('GET', `/api/companies/${COMPANY}/labels`),
    request('GET', `/api/companies/${COMPANY}/agents`),
    request('GET', `/api/companies/${COMPANY}/projects`),
  ]);

  const labelsList  = toArray(labelsRaw);
  const agentsList  = toArray(agentsRaw).filter(a => a.isActive !== false);
  const projectList = toArray(projectsRaw);

  // Maps
  const labelByName = new Map(labelsList.map(l => [l.name, l]));
  const labelById   = new Map(labelsList.map(l => [l.id, l.name]));
  const agentByName = new Map(agentsList.map(a => [String(a.name ?? '').trim(), a]));
  const agentById   = new Map(agentsList.map(a => [a.id, a.name]));

  // Find project — try name match first, then fall back to first
  const project =
    projectList.find(p => /story.writing/i.test(p.name ?? '')) ??
    projectList.find(p => /story/i.test(p.name ?? '')) ??
    projectList[0];

  if (!project) {
    console.error('No project found. Available:', projectList.map(p => p.name));
    process.exit(1);
  }

  // 2. Get issues
  let issues;
  if (WAKE !== 'heartbeat_timer' && TASK_ID) {
    // Fast path: single issue
    const issue = await request('GET', `/api/issues/${TASK_ID}`);
    issues = issue ? [issue] : [];
  } else {
    issues = await getAllIssues(project.id);
  }
  summary.scanned = issues.length;

  // 3. Concurrency map — count only in_progress tickets per agent.
  // Tickets in todo are queued but the agent isn't actively working yet,
  // so they don't block routing additional work to that agent.
  const agentActiveCount = new Map();
  for (const issue of issues) {
    if (issue.assigneeAgentId && issue.status === 'in_progress') {
      agentActiveCount.set(issue.assigneeAgentId,
        (agentActiveCount.get(issue.assigneeAgentId) ?? 0) + 1);
    }
  }

  // 4. Route each issue by label
  const stuckIssues = [];

  for (const issue of issues) {
    const id  = issue.identifier ?? issue.id;
    // Prefer inline labels array (already resolved); fall back to id→name map
    const labelNames = issue.labels
      ? issue.labels.map(l => l.name).filter(Boolean)
      : (issue.labelIds ?? []).map(lid => labelById.get(lid)).filter(Boolean);

    try {
      // checkout-stuck: collect for clone-and-cancel pass
      if (labelNames.includes('checkout-stuck')) {
        stuckIssues.push(issue);
        continue;
      }

      // Find the pipeline label
      let targetAgentName = null;
      let isMerge = false;

      for (const lname of labelNames) {
        if (LABEL_TO_AGENT[lname]) { targetAgentName = LABEL_TO_AGENT[lname]; break; }
        if (lname === 'needs-merge') { isMerge = true; break; }
      }

      if (!targetAgentName && !isMerge) {
        summary.skipped_no_label.push(id);
        continue;
      }

      // needs-merge → board user + ensure "Review and merge:" queue ticket exists
      if (isMerge) {
        const alreadyBoard = issue.assigneeUserId === issue.createdByUserId && !issue.assigneeAgentId;
        if (!alreadyBoard) {
          await request('PATCH', `/api/issues/${issue.id}`, {
            assigneeUserId: issue.createdByUserId,
            assigneeAgentId: null,
          });
          await request('POST', `/api/issues/${issue.id}/comments`, { body: 'Assigned to board for merge.' });
          summary.routed.push({ issue: id, target: 'board user' });
        } else {
          summary.already_correct.push(id);
        }

        try {
          const dedupeList =
            issues.length > 1 ? issues : await getAllIssues(project.id);
          const mt = await ensureMergeTicketIfMissing(issue, project, dedupeList, COMPANY);
          if (mt.merge_ticket_created) summary.merge_tickets_created.push(mt);
          else if (mt.skipped) summary.merge_ticket_skipped.push({ issue: id, reason: mt.skipped });
        } catch (e) {
          summary.merge_ticket_failed.push({ issue: id, error: e.message });
        }
        continue;
      }

      // Resolve agent
      const targetAgent = agentByName.get(targetAgentName);
      if (!targetAgent) {
        summary.errors.push({ issue: id, error: `Agent not found: "${targetAgentName}"` });
        continue;
      }

      // Already assigned correctly?
      if (issue.assigneeAgentId === targetAgent.id) {
        summary.already_correct.push(id);
        continue;
      }

      // Concurrency gate
      const active = agentActiveCount.get(targetAgent.id) ?? 0;
      if (active >= CONCURRENCY_LIMIT) {
        summary.skipped_concurrency.push({ issue: id, agent: targetAgentName, active });
        continue;
      }

      // Assign + set todo
      await request('PATCH', `/api/issues/${issue.id}`, {
        assigneeAgentId: targetAgent.id,
        assigneeUserId: null,
        status: 'todo',
      });
      await request('POST', `/api/issues/${issue.id}/comments`, {
        body: `Assigned to ${targetAgentName}.`,
      });

      // Update local concurrency map so subsequent issues see this assignment
      agentActiveCount.set(targetAgent.id, (agentActiveCount.get(targetAgent.id) ?? 0) + 1);
      summary.routed.push({ issue: id, target: targetAgentName });

    } catch (e) {
      summary.errors.push({ issue: id, error: e.message });
    }
  }

  // 5. Clone-and-cancel for checkout-stuck issues
  for (const old of stuckIssues) {
    const id = old.identifier ?? old.id;
    try {
      const commentsRaw = await request('GET', `/api/issues/${old.id}/comments`);
      const comments = toArray(commentsRaw)
        .slice()
        .sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));

      await request('POST', `/api/issues/${old.id}/comments`, {
        body: 'Checkout was stuck (409). Cloning issue and cancelling — recovery ticket created.',
      });
      await request('PATCH', `/api/issues/${old.id}`, {
        status: 'cancelled',
        assigneeAgentId: null,
        assigneeUserId: null,
      });

      // Build combined description
      const blocks = comments.map(c => {
        const who = c.authorAgentId
          ? `[${agentById.get(c.authorAgentId) ?? 'Unknown Agent'}]`
          : '[User]';
        return `${who}:\n${c.body ?? ''}`;
      });
      const newDesc =
        `${old.description ?? ''}\n\n---\n\n## Context from previous issue\n\n` +
        blocks.join('\n\n');

      // Determine new assignee from pipeline label (excluding checkout-stuck)
      const pipelineLabels = (old.labelIds ?? [])
        .map(lid => labelById.get(lid))
        .filter(n => n && n !== 'checkout-stuck');

      let newAssigneeId = null;
      let newLabelIds   = [];
      for (const lname of pipelineLabels) {
        const agentName = LABEL_TO_AGENT[lname];
        if (agentName) {
          const agent = agentByName.get(agentName);
          if (agent) newAssigneeId = agent.id;
          const label = labelByName.get(lname);
          if (label) newLabelIds = [label.id];
          break;
        }
      }

      const created = await request('POST', `/api/companies/${COMPANY}/issues`, {
        projectId:      old.projectId ?? project.id,
        title:          old.title,
        description:    newDesc,
        goalId:         old.goalId  ?? null,
        parentId:       old.parentId ?? null,
        status:         'todo',
        assigneeAgentId: newAssigneeId,
        labelIds:       newLabelIds,
      });

      const newIssueId         = created?.id         ?? created?.issue?.id;
      const newIssueIdentifier = created?.identifier ?? created?.issue?.identifier ?? newIssueId;

      await request('POST', `/api/issues/${old.id}/comments`,  { body: `Superseded by ${newIssueIdentifier}.` });
      if (newIssueId) {
        await request('POST', `/api/issues/${newIssueId}/comments`, {
          body: `Recovery ticket; ${id} was stuck (checkout 409) and cancelled.`,
        });
      }

      summary.checkout_stuck_recovered.push({ old: id, new: newIssueIdentifier });
    } catch (e) {
      summary.errors.push({ issue: id, error: `clone-and-cancel failed: ${e.message}` });
    }
  }

  console.log(JSON.stringify(summary, null, 2));
  if (summary.errors.length > 0) process.exit(1);
}

main().catch(err => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
