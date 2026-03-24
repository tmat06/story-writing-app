#!/usr/bin/env node
/**
 * Create the board-facing "Review and merge: …" Paperclip issue after approval + PR URL exist.
 *
 * This repo has no other automation for merge tickets — the Code Reviewer must run this
 * (or equivalent API calls). Using this script avoids skipped POST steps in long agent runs.
 *
 * Env (same as CEO heartbeat):
 *   PAPERCLIP_API_URL, PAPERCLIP_API_KEY, PAPERCLIP_COMPANY_ID, PAPERCLIP_RUN_ID (recommended for POST/PATCH)
 *
 * Usage (from repo root):
 *   node agents/code-reviewer/create-merge-ticket.mjs \
 *     --original-issue-id=<uuid-or-identifier> \
 *     --pr-url=<https://github.com/...> \
 *     --branch=<branch-name>
 *
 * Exits 0 and prints JSON { mergeIssueId, mergeIdentifier, ... } on success.
 */

const API     = (process.env.PAPERCLIP_API_URL ?? 'http://127.0.0.1:3100').replace(/\/$/, '');
const KEY     = process.env.PAPERCLIP_API_KEY ?? '';
const COMPANY = process.env.PAPERCLIP_COMPANY_ID ?? '';
const RUN_ID  = process.env.PAPERCLIP_RUN_ID ?? '';

function arg(name) {
  const prefix = `--${name}=`;
  const hit = process.argv.find((a) => a.startsWith(prefix));
  return hit ? hit.slice(prefix.length) : null;
}

async function request(method, path, body = null) {
  const headers = { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
  if (body && RUN_ID) headers['X-Paperclip-Run-Id'] = RUN_ID;
  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${method} ${path} → HTTP ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json().catch(() => null);
}

function usage() {
  console.error(`Usage: node agents/code-reviewer/create-merge-ticket.mjs \\
  --original-issue-id=<id> --pr-url=<url> --branch=<branch>`);
  process.exit(1);
}

async function main() {
  const originalIssueId = arg('original-issue-id');
  const prUrl = arg('pr-url');
  const branch = arg('branch');

  if (!originalIssueId || !prUrl || !branch) usage();
  if (!COMPANY) {
    console.error('PAPERCLIP_COMPANY_ID not set');
    process.exit(1);
  }
  if (!KEY) {
    console.error('PAPERCLIP_API_KEY not set');
    process.exit(1);
  }
  if (!RUN_ID) {
    console.error('PAPERCLIP_RUN_ID not set (required for mutating Paperclip API calls)');
    process.exit(1);
  }

  const original = await request('GET', `/api/issues/${encodeURIComponent(originalIssueId)}`);
  if (!original?.id) {
    console.error('Could not load original issue');
    process.exit(1);
  }

  const identifier = original.identifier ?? original.id;
  const boardUserId = original.createdByUserId;
  if (!boardUserId) {
    console.error(
      'Original issue has no createdByUserId; cannot assign merge ticket to board. Set creator or PATCH manually.',
    );
    process.exit(1);
  }

  const title = `Review and merge: ${identifier}`;
  const description =
    `Code Reviewer approved the implementation. Merge into \`main\` when ready.\n\n` +
    `**PR:** ${prUrl}\n` +
    `**Branch:** \`${branch}\`\n\n` +
    `Open the PR and use **Merge pull request** on GitHub.`;

  const createBody = {
    projectId: original.projectId,
    goalId: original.goalId ?? null,
    parentId: original.id,
    title,
    description,
    status: 'todo',
  };

  const created = await request('POST', `/api/companies/${COMPANY}/issues`, createBody);

  const mergeId = created?.id ?? created?.issue?.id;
  if (!mergeId) {
    console.error('Create issue response missing id:', JSON.stringify(created));
    process.exit(1);
  }

  await request('PATCH', `/api/issues/${mergeId}`, {
    assigneeAgentId: null,
    assigneeUserId: boardUserId,
  });

  const out = {
    ok: true,
    originalIssueId: original.id,
    originalIdentifier: identifier,
    mergeIssueId: mergeId,
    mergeIdentifier: created?.identifier ?? created?.issue?.identifier ?? mergeId,
    title,
  };
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error('Fatal:', err.message);
  process.exit(1);
});
