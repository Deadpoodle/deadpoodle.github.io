# Artifex Arcanum — project guide

D&D item-card generator. **Vanilla HTML/CSS/JS, GitHub Pages — no framework, no build step.**
Live at artifexarcanum.ie; this is the `itemgenerator/` subdir of `Deadpoodle/deadpoodle.github.io`.

## Files
- `index.html` — all markup (top bar, left rail, editor, preview, settings overlay, modals).
- `style.css` — almost all styling. Desktop is `min-width: 861px`; mobile is `max-width: 860px`.
- `tokens.css` — `--arc-*` design tokens (dark) + a `body.light` override block. Loaded **before**
  `style.css`. New chrome should consume `--arc-*` so light/dark theming is automatic.
- `script.js` — all logic (state, save/load, export, rail, dock, settings).
- `utils.js` — share helpers. `indexeddb.js` — `window.idbBlobs` blob adapter. `oauth.html` — cloud OAuth.
- `IMPLEMENTATION_PLAN.md` — phased history of the UX overhaul. `plans/design_handoff_ux_revision/`
  — the design source of truth (README + `.jsx` mockups + screenshots).

## Architecture notes (non-obvious)
- **Card art is LOCKED.** The parchment card (frame, circle, stats strip, 63×88 mm print size) must
  not change visually. Only chrome around it evolves.
- **Scrollbars are unified** by a global `* { scrollbar-width: thin; scrollbar-color: ... }` rule
  near the top of `style.css` (+ a `body.light *` variant), matching the cards dropdown. Don't add
  per-element `::-webkit-scrollbar` rules — they'd diverge. The only exception is `.history-track`
  (`scrollbar-width: none`, intentionally hidden).
- **Layout.** Desktop = 3-col `.workspace`: `#leftRail` (filter pills · collections accordion ·
  storage · settings) | `.controls` (a `card-strip-head` of New/name + the static `#tab-edit`) |
  `.preview-area` (card + `.card-action-dock`). Slim top bar = `#historyBar`. There are **no tabs**
  anymore — `#tab-edit` is always shown. Mobile hides the rail/dock/center-strip and uses the bar
  dropdowns + a card-hero bottom sheet.
- **Storage.** Card metadata → localStorage; image blobs (`bgImage`, `itemImage`, `cardBack`) →
  IndexedDB via `window.idbBlobs`. History cap 200. Auto-save fires 800 ms after edits; the save
  chip is the only save indicator (no modal).
- **Export render is NOT a DOM clone.** `buildCardNode(state)` rebuilds the card from state for
  `renderStateToCanvas`. **Keep `buildCardNode` in sync with `syncCard`** whenever card rendering
  changes, or PNG/print output will drift from the live preview.
- **Settings** = overlay `#settingsPage` (reparented to `<body>`). Desktop: **slides in from the
  left**, width-capped at the card-preview's left edge so it covers only rail + editor
  (`positionPanel()` measures `.preview-area` on open/resize; full-width below 861px). It's **one
  scrolling page of collapsible sections** (`#settingsBody`) — the old four-group sub-nav is gone.
  First section open, the rest collapsed; a section tagged `data-no-collapse` (About) stays open.
  `.settings-page-head` is 48px to line its divider up with the top bar. "← Back to editor" sits
  bottom-left in `.settings-page-foot`, aligned over the rail's Settings button. Entry points (all
  call `window.openSettingsPage()`): left-rail Settings button (desktop), `#mobileSettingsBtn` under
  Undo in the editor (mobile, since the rail is hidden), top-bar cloud avatar (also expands +
  scrolls `#settingsCloudSection`).
- **Collapsible sections** are wired by `initCollapsibleSections(panel, opts)` (turns each
  `:scope > div > .section-title` into a ▾/▸ toggle). Used for `#tab-edit` (numbered) and
  `#settingsBody` (un-numbered, first open). `data-no-collapse` opts a section out.
- **Left-rail collections accordion.** Collection-head names are bold gold UPPERCASE by default; the
  active collection is shown by a highlighted background bar, not a font change. Clicking a head
  toggles only that group. `applyState()` re-renders the rail so the active card's group auto-expands
  at selection time (state in `_expandedCollections` / `_lastAutoExpandedId`) — don't move that
  auto-expand back into a generic render path or unrelated re-renders will hijack the open group.
- **Font sizes:** mixed-case reading text uses CSS keywords (`small`≈13px / `medium`≈16px); the
  small-caps display labels (uppercase, letter-spaced) keep their `rem` values; card-render text
  stays `rem` (multiplied by the font-scale sliders, and locked). Don't convert caps labels or card
  text to keywords.
- **Hidden `#tab-export` is load-bearing.** The old Share tab is hidden but still in the DOM; the
  card dock and Settings → Backup buttons **proxy clicks** into its buttons (`exportPng`,
  `exportPrint`, `exportJsonBtn`, `importJsonBtn`). Don't delete it without rewiring those to call
  the underlying functions directly.
- **Export card-picking** lives in the Export & Share sheet itself: a **collection-grouped,
  collapsible checklist** (`#exportPickList`, ported from the pre-overhaul selection modal — group
  header = caret + group-toggle + name + count; "Uncollected" bucket last; all cards ticked by
  default). `getExportSelection()` reads the ticked `[value]` checkboxes from the DOM (active card
  uses live state), falling back to the current card when none are ticked. The sheet also holds the
  quality stepper (PNG/Print scale) and a **Print options** section (square corners / bleed /
  double-sided, `#exportOpt*`) passed to `printStates()`. (No rail "Select" mode — the old
  `_selectionMode`/`_selection` infra is dormant/unused.)

## Deliberately skipped / won't-do (do not re-propose)
- **Custom properties** — ❌ won't do. Extra properties take too much space on the locked card; the
  5 renamable slots (Bonus/Damage/Weight + Save/Range) are the full capacity. (User decision.)
- **`style.css` literal → `--arc-*` migration** — skipped: pure refactor, zero visual change, high
  churn / colour-drift risk. New code should use tokens, but don't mass-convert the old literals.
- **Physical removal of hidden `#tab-export` / `#shareDiscoveryModal` DOM + dead JS** — skipped:
  it's load-bearing via the click proxies above; cleanup only, not worth the rewire risk.
- **Sticky manual save bar + swipe-dot indicator** — skipped: always-on autosave + save chip make
  them redundant, and a dot doesn't scale to 200 cards.

## Testing
Serve with `python -m http.server` and verify in a **real browser**. Headless Edge on this machine
is unreliable: virtual-time hangs, screenshots usually fail, and even `--dump-dom` of `index.html`
often times out because the page defers `marked` + `html2canvas` from jsdelivr and fonts from Google
— a fresh headless profile has no cache and the `load` event waits on those CDNs. (A lighter page
like `privacy.html` dumps fine, which is the tell that a timeout is network/CDN, not a code hang.)
Trust `node --check script.js` + static review for logic; do visual/behaviour checks in a real
browser. `python -m http.server` is single-threaded — restart it if it gets gummed up by stuck
headless connections.
