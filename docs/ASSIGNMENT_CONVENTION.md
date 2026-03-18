# Assignment convention

Agents signal handoffs by applying a **pipeline stage label** to the issue. The CEO reads labels and assigns accordingly — no comment parsing, no `Assign to:` directives.

## Pipeline stage labels

| Label | Set by | Means |
|-------|--------|-------|
| `needs-market-research` | Marketing Product (at creation) | Ready for Market Research approval |
| `needs-design` | Market Research (on approval) | Ready for Design brief |
| `needs-plan` | Design (after brief) or Logs/Ops (at creation) | Ready for Founding Engineer plan |
| `needs-implementation` | Founding Engineer (after plan) | Ready for Code Monkey to implement |
| `needs-review` | Code Monkey (after push) | Ready for Code Reviewer |
| `needs-revision` | Code Reviewer (changes requested) | Ready for Founding Engineer to revise plan |
| `needs-merge` | Code Reviewer (on approval) | PR open, ready for board to merge |
| `checkout-stuck` | Any agent (on 409 checkout) | CEO will clone-and-cancel this issue |

## How to set a label

All label changes use `PATCH /api/issues/{issueId}` with `X-Paperclip-Run-Id`:

```
PATCH /api/issues/{issueId}
{ "labelIds": ["<next-label-id>"] }
```

To find label IDs: `GET /api/companies/{companyId}/labels` — match by name.

**Replace** the current stage label with the next one. Do not accumulate multiple stage labels on one issue.

**Exception:** `checkout-stuck` is **appended** to existing `labelIds` — do not remove the current stage label when adding it.

## CEO routing

On every `heartbeat_timer` wake, the CEO:
1. Fetches labels, agents, and project ID once at the start
2. Lists all active issues (status: backlog, todo, in_progress, in_review, blocked)
3. Builds a concurrency map — counts `todo`/`in_progress` tickets per agent
4. For each issue: reads its `labelIds` → determines target assignee from the table above → checks concurrency limit (max 1 active ticket per agent) → PATCHes assignee + sets `status: todo` if not already assigned → posts a brief comment
5. Handles `checkout-stuck` issues via clone-and-cancel (see below)

On non-timer wakes: routes only `PAPERCLIP_TASK_ID` by label, then handles own assignments.

## Concurrency limits

The CEO enforces a **maximum of 1 active ticket per agent** at a time. Before assigning, the CEO checks how many issues that agent already has in `todo` or `in_progress`. If ≥ 1, the CEO skips assignment and tries again next heartbeat. Board user (`needs-merge`) is exempt.

## Pipeline flow

```
Marketing Product → Market Research → Design → Founding Engineer → Code Monkey → Code Reviewer
(needs-market-research) (needs-design) (needs-plan) (needs-implementation) (needs-review)
                                                          ↑                        ↓
                                                   needs-revision ←──── (changes requested)
                                                                               ↓
                                                                         needs-merge → board merges
```

## Status ownership

| Status | Owner | When |
|--------|-------|------|
| `todo` | CEO | When routing/assigning an issue to an agent |
| `in_progress` | Each agent | When they checkout the issue (`POST /api/issues/{id}/checkout`) |
| `in_review` | Code Monkey | When handing off to Code Reviewer |
| `blocked` | Any agent | When genuinely stuck — must include a comment explaining why |
| `cancelled` | CEO | During clone-and-cancel recovery; Market Research on rejection |
| `done` | Code Reviewer | After board merges the PR |

- Only CEO sets `todo`. Agents do not set `todo` themselves unless resetting from `blocked`.
- Only Code Reviewer sets `done`.
- `backlog` is excluded from every agent's inbox — CEO sets `todo` when assigning.

## Checkout 409 recovery (automated)

When any agent gets **409 Conflict** on `POST /api/issues/{issueId}/checkout`:

1. Add label `checkout-stuck` to the issue (`PATCH /api/issues/{id}` appending `checkout-stuck` label ID to existing `labelIds`)
2. Do not retry checkout; do not call release
3. Pick another task or exit

The CEO detects `checkout-stuck` on the next heartbeat and runs clone-and-cancel:
1. Posts a comment: "Checkout was stuck (409). Cloning issue and cancelling — recovery ticket created."
2. PATCHes the issue: `status: cancelled`, `assigneeAgentId: null`, `assigneeUserId: null`
3. Creates a new issue: same title, `goalId`, `parentId`; description = original description + separator + all comments as `[Agent Name]: <body>` blocks (chronological order, resolve names via agents list)
4. Determines new assignee from the last valid pipeline stage label on the old issue; sets new issue assignee and `status: todo`; copies the pipeline label (without `checkout-stuck`) to the new issue
5. Comments on old: "Superseded by [new issue id]." Comments on new: "Recovery ticket; [old id] was stuck (checkout 409) and cancelled."

## After rate limit or process loss

When runs fail (rate limit, `process_lost`, timeout), agents pick up assigned work on the next heartbeat automatically. If a checkout was held by the failed run, the next checkout attempt will get 409 — the agent adds the `checkout-stuck` label and the CEO handles recovery.

## No `Assign to:` comments

The `Assign to: AgentName` comment convention is **retired**. All routing is label-based. Do not include `Assign to:` lines in comments or descriptions. If a ticket seems stuck, check that it has the correct pipeline label and status is not `done`/`cancelled`.
