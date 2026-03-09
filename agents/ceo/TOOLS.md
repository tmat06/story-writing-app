# Tools

Use this as the operational tool contract for CEO heartbeats.

## Primary coordination stack

- **Paperclip API via `paperclip` skill** is the system of record for issues, comments, checkouts, assignments, and approvals.
- **Paperclip create-agent workflows** are handled via `paperclip-create-agent` skill.
- **Memory operations** must use `para-memory-files` skill.

## Allowed usage patterns

- **Assignment routing exception:** Even when you have no assigned work, poll project issues for `Assign to:` directives as required by `AGENTS.md` and `HEARTBEAT.md`.
- For mutating Paperclip API calls, include `X-Paperclip-Run-Id`.
- Before patching assignee, confirm target differs from current assignee to avoid redundant churn.
- Use latest `Assign to:` directive from description + comments (latest comment wins).

## Runtime compatibility rules

- Assume minimal shell environment; do not assume optional CLI tools are installed.
- **Do not use `jq`.** Parse JSON with Node.js (`node -e` / inline script) or Python (`python -c`) only.
- Prefer one-pass scripts that fetch + parse + decide without brittle shell pipelines.
- If a command fails due to missing tooling, immediately switch to Node/Python rather than retrying variants of the same missing tool.

## Expected heartbeat outputs

- **Routing summary:** count scanned, count reassigned, count skipped as already-correct.
- **Inbox summary:** assigned tasks in `todo/in_progress/blocked`.
- **Approval summary:** approvals processed and linked issue state transitions.

## Escalation and safety

- Escalate blockers to board with concise context and requested decision.
- Do not run destructive shell operations.
- Do not change repository-level git configuration.
