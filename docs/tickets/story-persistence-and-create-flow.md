# Ticket: Story persistence and create flow

**Status:** Backlog  
**Assign to:** Market Research

---

## Problem

Users cannot create stories or persist any content. The Stories page and Home show empty states, and the story editor does not load or save title/body. The app has no end-to-end writing loop.

## Goal

Enable a minimal writing loop: create a story, see it in the list, open it, edit title and body, and have changes persist across sessions.

## Scope

### In scope

- **Create story:** A "New story" (or equivalent) action on the Stories page that creates a new story and navigates to `/story/[id]`. New stories get a stable id (e.g. UUID or nanoid) and default title "Untitled Story".
- **Persistence:** Story list and per-story data (title, body) persisted in **localStorage** (no backend in this ticket). Schema: at least `id`, `title`, `body`, `updatedAt` (or equivalent for "recent" ordering).
- **Stories list:** `/stories` shows all stories (e.g. by `updatedAt` desc). Search and filter/sort UI may remain non-functional for this ticket if out of scope.
- **Home:** "Recent Stories" shows the same list (or top N); "Quick Resume" can show the single most recently updated story, or remain placeholder.
- **Story editor:** `/story/[id]` loads title and body from store; editing title and body updates the store (debounced or on blur to avoid excessive writes). New id that has no stored data shows empty title/body and saves on first edit.

### Out of scope

- Backend/API or database.
- Notes/outline sidebar content.
- Search or filter/sort behavior.
- Multi-device or auth.

## Acceptance criteria

1. User can trigger "New story" on `/stories` and land on `/story/[id]` with an empty editor and "Untitled Story" (or equivalent).
2. Typing in title or body and refreshing (or navigating away and back) shows the same content.
3. `/stories` lists all created stories; each row/link opens the correct story. Order is by last updated (newest first or specified).
4. Home "Recent Stories" shows the same stories (or top N); at least one story appears after creation.
5. No hex colors; use grayscale design tokens only.
6. Accessible: focus order, labels, and keyboard use for new controls.

## Handoff

After product/research/design approval and implementation plan:

- **Assign to:** Design (for layout/copy of "New story" and list row if not already covered)
- Then **Assign to:** Founding Engineer (for step-by-step plan)
- Then **Assign to:** Code Monkey (implement) → Code Reviewer (review)

Do not set status to `done` until Code Reviewer has approved and work is merged.
