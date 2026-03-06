# Org model (reference)

Rough mapping of roles and flow for the story-writing-app company.

| Role | What they do |
|------|----------------|
| **CEO** | Strategy, hires, priorities, governance. |
| **Marketing Product** | Writes feature tickets for the app. |
| **Market Research** | Competitor research, suggestions to Marketing Product, approves or filters feature tickets before they go to engineering. |
| **Design** | Defines look, feel, colors, style, and intuitiveness; adds a design brief per feature so plan and implementation are design-informed. |
| **Founding Engineer** | Reviews codebase and stack, writes a step-by-step implementation plan in the ticket (no code). Hands off to Code Monkey. |
| **Code Monkey** | Implements from the step-by-step plan in the ticket; hands off to Code Reviewer when done. |
| **Code Reviewer** | Reviews Code Monkey's code, gives feedback. |
| **Logs / Ops** | Reads logs, opens tickets for errors; Founding Engineer plans the fix, Code Monkey implements. |

**Flow:** Marketing Product + Market Research → approved feature → **Design** (design brief: look, feel, colors, style, intuitiveness) → Founding Engineer (plan incorporates design) → Code Monkey (branch, implement, push) → Code Reviewer → either **approve** (Code Reviewer creates "Review and merge: BIN-xx" ticket with PR link, assigned to **board**; board reviews PR and merges to main) OR Code Reviewer → Founding Engineer (revise plan) → Code Monkey → Code Reviewer → approve → merge ticket for board. Logs/Ops bug tickets skip Design (Founding Engineer → Code Monkey → Code Reviewer). **Merge to main is always done by the board (you), not by Code Reviewer.**
