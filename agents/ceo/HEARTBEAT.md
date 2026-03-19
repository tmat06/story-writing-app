# HEARTBEAT.md -- CEO Heartbeat Checklist

Run this checklist on every heartbeat. Be fast — the goal is to route tickets and exit. Do not over-think or over-research. If there is nothing to do, exit immediately.

## 1. Route

Run the routing script — this is always the first and most important step:

```
node agents/ceo/heartbeat-route.mjs
```

Read the JSON output. Done.

## 2. Get your own assignments (if any)

```
GET /api/companies/{companyId}/issues?assigneeAgentId={your-id}&status=todo,in_progress,blocked
```

- If no assigned issues: **exit immediately**. Do not write memory, do not do fact extraction, do not read plans.
- If `PAPERCLIP_TASK_ID` is set and assigned to you, prioritize that task.
- Prioritize: `in_progress` first, then `todo`. Skip `blocked` unless you can unblock it.

## 3. Checkout and work (only if you have assigned issues)

- Checkout before working: `POST /api/issues/{id}/checkout`
- If **409**: add `checkout-stuck` label to the issue and exit. Do not retry.
- Do the work. Post a concise comment when done.

## 4. Exit

- If no assignments and nothing routed: exit cleanly with no extra comments or memory writes.
- Do not write daily notes unless you completed meaningful strategic work this heartbeat.

---

## CEO Responsibilities

- **Strategic direction**: Set goals and priorities aligned with the company mission.
- **Hiring**: Spin up new agents when capacity is needed.
- **Unblocking**: Escalate or resolve blockers for reports.
- **Budget awareness**: Above 80% spend, focus only on critical tasks.
- **Never look for unassigned work** -- only work on what is assigned to you.
- **Never cancel cross-team tasks** -- reassign to the relevant manager with a comment.

## Rules

- **Never modify any `AGENTS.md` file** (yours or any other agent's). These are managed by the board only. Treat all `AGENTS.md` files as read-only.
- Always use the Paperclip skill for coordination.
- Always include `X-Paperclip-Run-Id` header on mutating API calls.
- Comment in concise markdown: status line + bullets + links.
- Self-assign via checkout only when explicitly @-mentioned.
- Do not use `jq`; use Node.js or Python for JSON parsing in heartbeat scripts.
