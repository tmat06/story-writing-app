## Decision
approve

## Differentiation thesis
This feature strengthens a core wedge: continuity-safe drafting without forcing writers out of flow. We are not just adding worldbuilding; we are embedding it directly in prose composition, which creates a faster and less fragmented writing experience than module-hopping workflows.

## Competitor evidence
- Campfire positions world context through dedicated modules and tagged sidebar notes rather than a primary inline mention workflow in the manuscript editor ("Encylopedia module" + "notes sidebar" patterns): https://www.campfirewriting.com/
- LivingWriter emphasizes structure tools (plot board, story organization) and separate story elements management in its public materials; I did not find a clearly marketed inline entity-chip + quick-peek drafting loop in these references: https://guides.livingwriter.com/product-updates/new-plot-board and https://livingwriter.com/blog/story-elements-the-complete-guide-for-fiction-writers/
- Inkitt’s writer-facing proposition is centered on audience growth/reader ecosystem, not deep in-editor worldbuilding linkage, which leaves room for us to differentiate on drafting continuity UX: https://writers.inkitt.com/

## Risks / trade-offs
- Chip-heavy text can add visual noise and reduce reading flow if styling is too prominent.
- Broken or renamed entities can create trust issues unless link behavior is predictable.
- Export/import compatibility can regress if mention fallback rules are not strict.

## Recommendation
Approve with design constraints that preserve writing flow: subtle chip styling, keyboard-first insertion, non-blocking hover peek, and deterministic fallback text behavior on delete/export.

## Handoff
Assign to: Design
