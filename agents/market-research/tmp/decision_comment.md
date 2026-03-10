## Decision
approve

## Differentiation thesis
This feature should be approved because it can differentiate on **workflow speed inside drafting**, not just data modeling: scene context (POV/location/timeframe) is visible and editable where writing happens, and filter combinations let writers resolve continuity questions without leaving the manuscript flow. That is a better experience than forcing writers into separate planning/worldbuilding surfaces.

## Competitor evidence
- Living Writer emphasizes structure, scenes, and planning boards (including scene/location plot points), which shows metadata-driven organization is expected baseline behavior: https://guides.livingwriter.com/product-documentation/boards/planning-board/freeform-grid and https://guides.livingwriter.com/product-documentation/boards/planning-board/standard-grid
- Living Writer navigation focus (tabbed chapters) indicates fast movement across manuscript is a core competitive axis; our filterable navigator can outperform by adding context-aware retrieval, not only tab switching: https://guides.livingwriter.com/product-documentation/tabbed-viewing
- Campfire’s positioning is module-heavy worldbuilding (encyclopedia/locations/magic/species), which is powerful but can push users into parallel panels; we can stand out with lighter, inline context controls while drafting: https://campfirewriting.com/worldbuilding-tools
- Dabble links scene cards and plot points to manuscript workflow, reinforcing that context + scene-level retrieval is market-proven value: https://help.dabblewriter.com/en/articles/2692382-exploring-dabble-s-plot-grid

## Risks / trade-offs
- Free-text metadata can fragment values (e.g., “NYC” vs “New York”), weakening filters unless lightweight normalization/suggestions are included.
- Added header metadata could increase visual noise if not carefully designed for focus mode.
- If filter UX is slow or hidden, this devolves into parity instead of differentiation.

## Recommendation
Proceed, but keep the differentiator explicit in Design brief: prioritize **single-glance context + one-step filtering** in the drafting flow, and include lightweight value suggestions to reduce metadata drift.

## Handoff
Assign to: Design
