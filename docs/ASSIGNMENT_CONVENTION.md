# Assignment convention

Agents cannot all assign tickets. The **CEO** has assign permission and performs all handoffs.

**Rule:** When you create a ticket or add a comment that means "this should go to another agent," you **must** specify the next assignee using this line:

**Assign to:** AgentName

Use the exact agent name as shown in the org (e.g. Market Research, Design, Founding Engineer, Code Monkey, Marketing Product, Code Reviewer, Logs/Ops). You can write either `Assign to: Market Research` or `Assign to: [Market Research]`; the CEO accepts both. The CEO matches by name (case-insensitive) and assigns the issue to that agent.

**Comment-first convention (required):**

- Use `Assign to:` in comments for handoffs.
- At ticket creation, description-level `Assign to:` is allowed for the first handoff only.
- After creation, do not add new `Assign to:` lines in the description. All subsequent handoffs must be comments.
- Keep handoff comments minimal and unambiguous (prefer a single `Assign to:` line).

**Directive parsing contract (required):**

- Valid handoff directive is a standalone line only: `^Assign to:\s*(?:\[)?([^\]\n]+?)(?:\])?\s*$`
- Ignore `Assign to:` text embedded in paragraphs, bullet prose, or code blocks.
- After ticket creation, comment directives take precedence over description directives.
- If multiple valid directives exist, deterministic winner is the last by `(createdAt, id)`.
- Extracted target must match a real active agent name exactly after trim/bracket-strip.

**Who specifies Assign to:**

| Agent | When | Assign to |
|-------|------|-----------|
| Marketing Product | When creating a feature ticket | Market Research |
| Market Research | When approving a feature ticket | Design (required—do not leave an approved ticket without it) |
| Design | When design brief is added to the ticket | Founding Engineer (required) |
| Logs/Ops | When creating a bug/ops ticket | Founding Engineer |
| Founding Engineer | When step-by-step plan is written (or revised) in the ticket | Code Monkey (required—do not leave a planned ticket without it) |
| Code Monkey | When implementation is ready for review | Code Reviewer |
| Code Reviewer | When requesting changes (revision path) | Founding Engineer (Founding Engineer revises the plan, then assigns back to Code Monkey) |

The CEO runs on a heartbeat and assigns any issue with a valid handoff directive that is not yet assigned to that target.

**No cycle:** Feature tickets flow one way: Marketing Product → Market Research → Design (design brief) → Founding Engineer (writes plan) → Code Monkey (implements) → Code Reviewer. Market Research must not send approved tickets back to Marketing Product. When Market Research approves, add **Assign to:** Design. When Design has added the design brief, add **Assign to:** Founding Engineer. When Founding Engineer has written the step-by-step plan in the ticket, add **Assign to:** Code Monkey so they implement. When Code Reviewer requests changes, add **Assign to:** Founding Engineer so they can revise the plan; then Founding Engineer assigns to Code Monkey again → Code Reviewer. When Code Reviewer approves, they create a **merge ticket** (title "Review and merge: [issue id]", description with PR link) and assign it to the **board user** (assigneeUserId = original issue's createdByUserId). The board reviews the PR and merges to main; Code Reviewer does not merge. When they reject a feature, Market Research closes the ticket or adds **Assign to:** Marketing Product for revision; Marketing Product then adds **Assign to:** Market Research again for re-review.

**Status: do not use `done` until the ticket is fully complete.** The CEO only considers tickets in status backlog, todo, or in_progress for assignment. If an agent sets a ticket to `done` after their part (e.g. Marketing Product after creating it), the ticket drops out of the CEO's list and never gets assigned to the next agent. Rule: **Only set status to `done` when the ticket is fully complete** (e.g. Code Reviewer has approved and work is merged to GitHub). When you finish your part and hand off (add "Assign to: Next Agent"), leave status as `todo` or `in_progress`—do not set `done`. Only the final step in the pipeline (Code Reviewer when approving/merged) sets `done`. Use `blocked` only when you are actually blocked; add a comment explaining. Do not use `blocked` to mean "I'm done."

**Backlog vs inbox:** Assignees fetch their work with `status=todo,in_progress,blocked` only. **Backlog is excluded from every agent's inbox.** A ticket in backlog can be assigned to an agent, but that agent will never see it until the ticket is moved to `todo` or `in_progress`. When a ticket is ready for the first assignee (or when the CEO assigns it), set status to `todo` so the assignee sees it. Use backlog for unassigned or not-yet-ready work.

**After rate limit or process loss:**

When runs fail (e.g. rate limit, `process_lost`, timeout), agents will pick up their assigned work again on their next heartbeat—no CEO reminder needed. To avoid stuck issues:

1. **Status:** Ensure any ticket that should be worked on is in `todo` or `in_progress` (not backlog), so it appears in the assignee's inbox.
2. **Checkout:** If an issue was checked out by a run that then failed, the assignee may get 409 on their next checkout. Release that issue's checkout so the assignee can checkout again on their next run. See **docs/PAPERCLIP_SETUP.md** (§ Release a stuck checkout) for manual release. Automated flow below.
3. Let normal heartbeats run; each agent will fetch their inbox and continue.

**Checkout 409 recovery (automated):**

- When any agent gets **409 Conflict** on `POST /api/issues/{issueId}/checkout`, they must post **exactly one comment** on that issue containing the standalone line: `Checkout release requested: 409`. Then do not retry checkout; pick another task or exit. The CEO will act on this on the next heartbeat.
- **CEO:** Do **not** assign any issue that has a comment containing `Checkout release requested: 409` (skip it in the normal Assign to handoff); otherwise the CEO would reassign the agent to the same stuck issue after the board unassigns. For each such issue (at most once per heartbeat), run clone-and-cancel only: post the board comment, set the issue to cancelled and unassign, create a new issue with the same title and description built from original + all comments as `[Agent Name]:` blocks, assign the **new** issue to the last `Assign to:` and set its status to todo. See agents/ceo/AGENTS.md step 4 for the full procedure.

**Stuck-ticket recovery:**

If assignment does not move after a heartbeat cycle, add a fresh comment containing only the intended handoff (for example `Assign to: Code Reviewer`), ensure status is not `done`/`cancelled`, and rerun CEO.
