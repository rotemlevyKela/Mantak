# Figma Ingest Notes (Node 322:170)

Design source: `Lidar` file, node `322:170`.

Applied tokens and layout mapping:

- Top bar height: `46px`
- Left detections panel width: `416px`
- Primary panel background: `#0f1211`
- Border color: `#2b2e2d`
- Body background: near-black (`#060707`)
- Card/action glass style: translucent white fill with thin white border
- Detection emphasis palette:
  - critical: dark red (`#650706`) / bright red (`#e0212f`)
  - warning: amber (`#f08f1e`)
  - neutral text: `#dedede` / `#757575`

Fallback strategy:

- If design token extraction changes or is incomplete, `src/styles/tokens.css` is the canonical fallback token source.
- All dimensions in CSS use named variables (`--sidebar-width`, `--topbar-height`) to keep token replacement low-risk.
