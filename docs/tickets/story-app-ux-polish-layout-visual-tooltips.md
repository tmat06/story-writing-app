# Ticket: Story app UX polish — layout stability, visual hierarchy, tooltips

**Status:** Backlog  
**Assign to:** Market Research

---

## Problem

1. **Layout instability:** When navigating between story views (Editor, Corkboard, Submissions, Pacing), the header and action bars shift. Buttons and controls appear in different positions or with different density (e.g. main nav vs. view-specific toolbar), so the UI feels jumpy and unanchored. The "Focus" button sits apart from the main nav segment, adding to the inconsistency.

2. **Plain-text feel:** The app is almost entirely monochrome with minimal visual hierarchy. Story titles show raw UUIDs (e.g. "Story 272120b0-e605-409e-8879-87f1f2844738") instead of readable names where appropriate. There is little use of grayscale design tokens to create emphasis, grouping, or depth — so the interface reads like plain text rather than a structured, premium writing environment.

3. **No guidance for new writers:** Key controls (Editor, Corkboard, Submissions, Pacing, Focus, "Add beat", status filters like All/Planned/Drafting/Done) have no tooltips or short explanations. New users have no in-app cues to understand what each area does or how to use the workflow.

## Goal

- **Stable layout:** A consistent shell for story pages so that primary navigation and view-specific toolbars occupy fixed, predictable regions. Buttons do not jump or change alignment when switching between Editor, Corkboard, Submissions, and Pacing.
- **Clear visual hierarchy:** Use the existing grayscale design system (black-700, carbon-600, elephant-500, cement-400, fashion-300, fog-200, polar-100) to create structure: clear primary vs secondary actions, grouped controls, and readable story titles (not raw UUIDs in the header). No new colors beyond the design system; no deprecated gray tokens.
- **Discoverability:** Tooltips (or equivalent) on main nav items and key actions so new writers can learn what Editor, Corkboard, Submissions, Pacing, Focus, "Add beat", and status filters do without leaving the app.

## Scope

### In scope

- **Layout:** Define and implement a stable story-page shell (e.g. persistent header + main nav + reserved area for view-specific toolbar) so that switching views does not shift horizontal alignment or cause controls to move. Include consistent placement of the Focus control relative to the main nav (e.g. in same bar or clearly grouped).
- **Visual hierarchy:** Apply grayscale tokens consistently across story header, nav, and toolbars; ensure active/inactive and primary/secondary states are visually distinct; display story title (or "Untitled") in the header instead of raw UUID.
- **Tooltips:** Add tooltips (or aria-describedby/short descriptions) for: Editor, Corkboard, Submissions, Pacing, Focus, "Add beat", and the status filter pills (All, Planned, Drafting, Done). Copy should be one short sentence per control, aimed at a new writer. Ensure keyboard and screen-reader accessible.
- **Design system:** Use only grayscale tokens; replace any remaining deprecated gray-* usage in touched files with the closest grayscale equivalent.

### Out of scope

- Backend or API changes.
- New feature behavior (only layout, styling, and tooltip content).
- Full onboarding flow or guided tours (tooltips only for this ticket).

## Acceptance criteria

1. **Layout:** Navigating between Editor, Corkboard, Submissions, and Pacing keeps the same header height, nav position, and horizontal alignment; no visible "jump" of buttons or bars.
2. **Story title:** Story header shows the story title (or "Untitled Story") instead of the raw UUID.
3. **Visual hierarchy:** Primary actions and active nav state use design tokens that read clearly (e.g. black-700 for active, carbon-600/elephant-500 for secondary); borders and backgrounds use fashion-300/fog-200/polar-100 where appropriate; no deprecated gray-* in changed files.
4. **Tooltips:** Each of Editor, Corkboard, Submissions, Pacing, Focus, "Add beat", and the status filters has a tooltip (or equivalent) with a one-sentence explanation for new writers; tooltips are keyboard- and screen-reader accessible.
5. **Accessibility:** Focus order, focus rings, and ARIA/labels remain correct for new and modified controls; contrast meets requirements for grayscale tokens.

## Handoff

After product/research approval:

- **Assign to:** Design (design brief: layout structure, visual direction, tooltip placement and tone).
- Then **Assign to:** Founding Engineer (step-by-step implementation plan).
- Then **Assign to:** Code Monkey (implement) → Code Reviewer (review).

Do not set status to `done` until Code Reviewer has approved and work is merged.
