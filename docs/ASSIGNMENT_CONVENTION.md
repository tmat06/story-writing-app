# Assignment convention

Agents cannot all assign tickets. The **CEO** has assign permission and performs all handoffs.

**Rule:** When you create a ticket or add a comment that means "this should go to another agent," you **must** specify the next assignee using this line (in the issue description or in a comment):

**Assign to:** AgentName

Use the exact agent name as shown in the org (e.g. Market Research, Design, Founding Engineer, Code Monkey, Marketing Product, Code Reviewer, Logs/Ops). You can write either `Assign to: Market Research` or `Assign to: [Market Research]`; the CEO accepts both. The CEO matches by name (case-insensitive) and assigns the issue to that agent.

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

The CEO runs on a heartbeat and assigns any issue that contains **Assign to:** and is not yet assigned to that agent.

**No cycle:** Feature tickets flow one way: Marketing Product → Market Research → Design (design brief) → Founding Engineer (writes plan) → Code Monkey (implements) → Code Reviewer. Market Research must not send approved tickets back to Marketing Product. When Market Research approves, add **Assign to:** Design. When Design has added the design brief, add **Assign to:** Founding Engineer. When Founding Engineer has written the step-by-step plan in the ticket, add **Assign to:** Code Monkey so they implement. When Code Reviewer requests changes, add **Assign to:** Founding Engineer so they can revise the plan; then Founding Engineer assigns to Code Monkey again → Code Reviewer. When Code Reviewer approves, they create a **merge ticket** (title "Review and merge: [issue id]", description with PR link) and assign it to the **board user** (assigneeUserId = original issue's createdByUserId). The board reviews the PR and merges to main; Code Reviewer does not merge. When they reject a feature, Market Research closes the ticket or adds **Assign to:** Marketing Product for revision; Marketing Product then adds **Assign to:** Market Research again for re-review.

**Status: do not use `done` until the ticket is fully complete.** The CEO only considers tickets in status backlog, todo, or in_progress for assignment. If an agent sets a ticket to `done` after their part (e.g. Marketing Product after creating it), the ticket drops out of the CEO's list and never gets assigned to the next agent. Rule: **Only set status to `done` when the ticket is fully complete** (e.g. Code Reviewer has approved and work is merged to GitHub). When you finish your part and hand off (add "Assign to: Next Agent"), leave status as `todo` or `in_progress`—do not set `done`. Only the final step in the pipeline (Code Reviewer when approving/merged) sets `done`. Use `blocked` only when you are actually blocked; add a comment explaining. Do not use `blocked` to mean "I'm done."
