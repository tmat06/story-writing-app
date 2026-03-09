# Definition of Done

This checklist defines when work is complete enough to move forward in the story-writing-app pipeline.

## Applies to all tickets

- Scope is clear and bounded (what is included and excluded).
- Acceptance criteria are explicit and testable.
- Handoff comment includes exactly one `Assign to:` line when transitioning ownership.
- Status is not set to `done` until final review/merge handoff is complete.

## Product + Research + Design

- **Marketing Product**
  - Problem statement, target user, expected outcome, and acceptance criteria are present.
  - Priority/rationale is documented.
- **Market Research**
  - Differentiation rationale includes competitor references and recommendation (approve/reject/reframe).
- **Design**
  - Brief includes layout, interaction states, accessibility notes, and visual style constraints.

## Engineering Plan

- **Founding Engineer**
  - Step-by-step implementation plan references concrete files/components.
  - Plan includes tests to add/update and verification commands.
  - Plan includes risks, rollback notes, and observability/logging impacts when relevant.

## Implementation

- **Code Monkey**
  - Implementation follows the approved plan.
  - Branch and commit workflow is followed and branch is pushed (or failure is documented).
  - Test evidence is included in handoff comment (commands + concise results).

## Review + Merge Handoff

- **Code Reviewer**
  - Review is recorded with severity-labeled findings (`critical`, `major`, `minor`, `nit`).
  - Approval confirms no blocking issues remain.
  - Merge ticket is created with PR/compare link and assigned to board user.
  - Original implementation ticket is set to `done` only after approval + merge handoff ticket creation.

## Ops / Reliability

- **Logs/Ops**
  - Issue includes source, timestamp/window, impact, severity, and reproduction hints.
  - Repeated incidents include frequency and any known trigger pattern.
