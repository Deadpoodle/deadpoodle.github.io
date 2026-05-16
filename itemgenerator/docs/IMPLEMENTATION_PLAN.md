# IMPLEMENTATION_PLAN.md — Artifex Arcanum

## Context

This plan consolidates all remaining work from `SHARE_UPGRADE.md` (Phase 4 only — Phases 1–3 are complete), `TODO.md` (all unchecked items), and `FUTURE_FEATURES.md` (Monster Card Mode, all phases). Items are grouped into logical phases ordered from lowest to highest complexity. Phases within each group are independently shippable.

---

## Phase 1 — OneDrive Integration ⏸ Deferred
*Completes the multi-provider share feature. Follows the established Dropbox/GDrive pattern.*
*Deferred — Azure subscription access issues. Full implementation plan archived at `docs/archive/onedrive-implementation-plan.md`.*

**Files:** `script.js`, `docs/cloudflare-worker.js`, `index.html`
**Reference:** `docs/SHARE_UPGRADE.md` Steps 17–21 + Lessons Learned section

<details>
<summary>Steps</summary>

- [x] **Step 17** — Azure Portal app registration (external, one-time): register SPA client type, set redirect URI to `oauth.html`, add `Files.ReadWrite` permission, note `ONEDRIVE_CLIENT_ID`
- [x] **Step 18** — Implement `connectOneDrive()`: attempt PKCE flow first (`https://login.microsoftonline.com/common/oauth2/v2.0/authorize`); if token exchange fails with a network error, fall back to implicit flow (same pattern as Dropbox/GDrive); store token via `setShareConnection('onedrive', token, refreshToken)`
- [x] **Step 19** — Implement `_shareOneDrive(states, hash)`: PUT to `/me/drive/root:/Artifex Arcanum/<filename>.json:/content`, POST to `.../createLink` (`type: 'view'`, `scope: 'anonymous'`), GET item metadata to retrieve `@microsoft.graph.downloadUrl`, encode as `#share=onedrive:<encodeURIComponent(downloadUrl)>`
- [x] **Step 20** — Wire `fetchSharedCard('onedrive', encodedUrl)`: decode URL, route through `DROPBOX_PROXY` (add Microsoft download hostname to `ALLOWED_HOSTS` in Cloudflare Worker), parse JSON
- [x] **Step 21** — Auto-refresh on 401 (if PKCE succeeded and refresh token exists); disconnect clears tokens; update `clearShareConnection()` for any cached OneDrive keys
- [x] Add `onedrive:` case to `shareCurrentCard()` dispatch and `fetchSharedCard()` switch
- [x] Redeploy Cloudflare Worker with updated `ALLOWED_HOSTS`

</details>

---

## Phase 2 — Share Feature Polish
*Small UX improvements on top of the working three-provider share.*

**Files:** `script.js`, `index.html`, `style.css`
**Reference:** `docs/SHARE_UPGRADE.md` Phase 5 Steps 22–24

<details>
<summary>Steps</summary>

- [x] **Step 22 — Shared file management**: add a link that opens the users connected cloud storage to the Artifex Arcanum directory so they can see the files stored by the app
- [x] **Step 23 — Expired/deleted file handling**: show clear modal ("This shared card is no longer available — the owner may have deleted it.") on 404 or non-JSON recipient fetch, rather than a generic error

</details>

---

## Phase 3 — Bug Fixes & Quick UI Wins
*Targeted fixes and small enhancements, no architectural dependencies.*

**Files:** `script.js`, `style.css`, `index.html`

<details open>
<summary>Steps</summary>

- [x] **Dropbox token expiry fix**: investigate `localStorage.getItem('dnd_share_token')` token lifetime; verify `token_access_type=legacy` is being sent correctly in the auth URL; fix so users do not need to reconnect daily (known issue in `HANDOVER_V4.md`)
- [x] **Text auto-resize for long field values**: fields like Type/Damage/Value should reduce font size when text overflows rather than shoving adjacent elements (e.g. "Type: Transmutation" → `0.65rem`)
- [ ] **Font size preference in Appearance tab  ⏸ Deferred**: add Default (Auto) / slider or preset options; note that some fields already auto-resize — the preference should apply to the description area and override-able fields
- [x] **Mobile swipe to change card**: swipe left/right on the card preview to navigate between saved cards; or ensure previous/next buttons are visible and tappable in the mobile top bar

</details>

---

## Phase 4 — Multi-Card Share
*Extends the share feature to support sharing multiple cards at once.*

**Files:** `script.js`, `index.html`, `style.css`
**Reference:** `docs/SHARE_UPGRADE.md` Phase 5 Step 25; `TODO.md` Selective Sharing

<details>
<summary>Steps</summary>

- [x] **Allow Print Selection and Download Selection across different collections** (prerequisite: Phase 5 Collections must exist; stub this step until then)

</details>

---

## Phase 5 — Collections System
*Grouping system for saved entries. This is the prerequisite for Navbar Overhaul.*

**Files:** `script.js`, `index.html`, `style.css`
**Reference:** `TODO.md` — Collection System section

<details>
<summary>Steps</summary>

- [x] **Collection data model**: add `collectionId` field to card state; collection objects stored in `localStorage` with `id`, `name`, `description`; flat storage, cards grouped by `collectionId`
- [x] **Collection management UI**: create, rename, delete collections; assign cards to a collection
- [x] **Bulk Actions**: update Share, Print, and Download selection modals to allow selecting an entire collection or drilling down to individual cards within it
- [x] **Export filename convention**: exported filenames use `<CollectionName>_<CardType>_<CardName>` format (e.g. `The_Breaking_Items_Flashpoint.png`)
- [x] **Advanced Filtering**: filter history bar by entry type (Item, Spell, Monster) — *requires Monster Card Mode to be partially complete for the Monster filter to be meaningful*

</details>

---

## Phase 6 — Navigation & Layout Overhaul
*Depends on Phase 5 (Collections) being complete.*

**Files:** `script.js`, `index.html`, `style.css`
**Reference:** `TODO.md` — UI/UX Refactor section

<details open>
<summary>Steps</summary>

- [ ] **Retire Carousel**: replace the carousel component with a scalable grid or list view to accommodate large libraries
- [ ] **Navbar Overhaul**: redesign navigation to reflect the collection hierarchy (Collections → Types → Items)
- [ ] **Cloud storage as primary store** *(exploratory — confirm scope before implementing)*: if cloud storage is connected, save/load cards directly from cloud (one file per card, folder per collection); use card `id` as the unique key; soft-delete via `toDelete=true` flag with 3-day grace period; must work for Google Drive and Dropbox; confirm whether new Dropbox/Google Drive permissions are needed

</details>

---

## Phase 7 — Monster Card Mode
*Large standalone feature. Zero regression on item cards throughout.*

**Files:** `script.js`, `index.html`, `style.css`
**Reference:** `docs/FUTURE_FEATURES.md` — full document

<details open>
<summary>Steps</summary>

### Phase 7a — Foundation & Mode Toggle
*Scaffolding. No visible card changes.*

- [ ] Add `cardMode: 'item' | 'monster'` to `DEFAULT_STATE`, `BLANK_STATE`, `collectCurrentState()`, `applyState()` (default to `'item'` for old saves)
- [ ] Add segmented `[ Item Card ] [ Monster Card ]` toggle to top of Details tab
- [ ] Implement `applyCardMode(mode)`: toggle `monster-mode` CSS class on container; hide/show item vs monster control panels
- [ ] Update history bar and `applyState()` to call `applyCardMode()` when switching between saved cards of different types

### Phase 7b — Compact Monster Card (first shippable milestone)
*Working monster card: portrait, name, type, core stats, description, PNG export.*

- [ ] Fix `compressImage()` to accept `preserveTransparency` flag; output PNG when source has alpha and flag is set; add toggle to compression settings UI
- [ ] Add `.monster-card` CSS section: rectangular portrait (full width, ~200px, `object-fit: cover`), name, creature type line, AC · HP · Speed strip, CR badge, description, source footer; dynamic height (no 580px cap)
- [ ] Add monster input fields to `<div id="monsterFields">`: Size, Creature Type, Alignment, AC, HP, Speed, CR (with CR→XP lookup table), XP (read-only/override), reuse `#itemDescription` and `#itemSource`
- [ ] Implement `syncMonsterCard()`: branch at top of `syncCard()`; populates all compact monster fields in live preview; fires `setDirty(true)` and `scheduleAutoSave()`
- [ ] Add monster portrait upload (rectangular zone, vertical drag-to-reposition); reuse `bindUpload()`; store as `monsterPortrait` in state
- [ ] Implement `buildMonsterCardNode(s)`: self-contained HTML builder for compact monster card; branch in `buildCardNode(s)` on `s.cardMode`

### Phase 7c — Full Stat Block
*Extends compact card with ability scores, saves/skills, immunities, and named action sections.*

- [ ] Add 6 ability score inputs (STR/DEX/CON/INT/WIS/CHA) with live modifier calculation (`Math.floor((score - 10) / 2)`); render as 6-column grid on card
- [ ] Add freeform Saving Throws and Skills text fields; render as labelled lines when non-empty
- [ ] Add freeform Damage Immunities, Resistances, Vulnerabilities, Condition Immunities, Senses, Languages fields; group in collapsible "Additional Properties" section; render conditionally
- [ ] Replace single Description field (in monster mode) with 5 separate markdown text areas: Traits, Actions, Bonus Actions (conditional), Reactions (conditional), Legendary Actions (conditional); store as `monsterTraits`, `monsterActions`, etc.
- [ ] Add estimated print size indicator (warn if card exceeds ~1000px); no hard char limit in monster mode
- [ ] Extend `syncMonsterCard()` and `buildMonsterCardNode()` to render all Phase 7c fields

### Phase 7d — Image Handling
- [ ] Full portrait drag/reposition: vertical drag, zoom slider, "Reset crop"; store `monsterPortraitOffsetY`, `monsterPortraitScale` in state
- [ ] Update Appearance tab in monster mode: hide item-specific controls (circle border, rarity colour, type image toggle), show portrait height slider, portrait style options (full/inset/none)

### Phase 7e — Compatibility & Settings
- [ ] Print and download selection modals: use `buildMonsterCardNode()` for monster thumbnails; show creature type label instead of rarity badge
- [ ] JSON export/import: add `minAppVersion` field to exported JSON so older app versions can warn about monster card state they can't render
- [ ] Add "Monster Card Defaults" section to Settings tab (default size, alignment, source)
- [ ] Extend "Clear All Data" reset handler to cover all monster-specific fields and defaults

### Phase 7f — Polish
- [ ] Add SVG type icons for monster types (Beast, Undead, Dragon, etc.) to `img/defaults/`; show in history bar
- [ ] Add compact/full stat block toggle within monster mode; store in state
- [ ] Print layout options for tall monster cards: A4 portrait (one per page), A5 (two per page)

</details>

---

## Phase 8 — Spell Card Mode
*Large standalone feature. Zero regression on item cards or monster cards throughout.*

**Files:** `script.js`, `index.html`, `style.css`

<details open>
<summary>Steps</summary>

### Phase 8a — Foundation & Mode Toggle
*Scaffolding. No visible card changes. Extends Phase 7a's toggle if Monster mode is implemented; lays the full 3-way foundation if Phase 7 has not yet shipped.*

- [ ] Extend `cardMode` in `DEFAULT_STATE`, `BLANK_STATE`, `collectCurrentState()`, `applyState()` to `'item' | 'monster' | 'spell'` (default `'item'` for all existing saves)
- [ ] Extend the Details-tab segmented toggle from `[ Item Card ] [ Monster Card ]` to `[ Item Card ] [ Monster Card ] [ Spell Card ]`
- [ ] Extend `applyCardMode(mode)`: toggle `spell-mode` CSS class on the card container; show `#spellFields`, hide `#itemFields` and `#monsterFields` when mode is `'spell'`
- [ ] Update history bar and `applyState()` to call `applyCardMode('spell')` when loading a saved spell card

### Phase 8b — Compact Spell Card *(first shippable milestone)*
*Working spell card: school icon, core stat strip, components, description, PNG export.*

- [ ] Add `.spell-card` CSS section with the following layout (dynamic height, same 380px width as item cards):
  - **Header**: name (Cinzel, same size as item card), level badge (e.g. `◈ 3rd-Level ◈`) + school label in place of rarity, no rarity row
  - **Stat strip**: Casting Time | Range | Duration — reuses `.card-stats` / `.card-stat` / `.stat-value` pattern and auto-shrink
  - **Components line**: V / S / M shown as small inline chips; material description in italics below when M is checked
  - **Circular icon zone**: reuses `.card-image-wrap` grid; shows spell school icon by default (see Phase 8c); Save/Range side-stats replaced by Concentration indicator (left) and Ritual indicator (right) when applicable
  - **Body**: description text (markdown, reuses `.card-description`); *At Higher Levels* as a conditional italic section with a thin rule above it
  - **Footer**: class list (e.g. `Wizard · Sorcerer`) on left, source on right — reuses `.card-footer` / `.card-source`
- [ ] Add spell input fields in `<div id="spellFields">` in the Details tab:
  - Spell Level — dropdown: Cantrip, 1st – 9th
  - School — dropdown: Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, Transmutation
  - Casting Time — text field (e.g. `1 action`, `1 bonus action`, `1 reaction`)
  - Range — text field (e.g. `60 feet`, `Self (60-foot cone)`, `Touch`)
  - Duration — text field (e.g. `Instantaneous`, `Concentration, up to 1 minute`)
  - Concentration — checkbox
  - Ritual — checkbox
  - Components — V / S / M checkboxes; Material text field (visible only when M is checked)
  - At Higher Levels — optional textarea (hidden/collapsed when empty)
  - Class list — text field (e.g. `Wizard, Sorcerer`)
  - Reuse `#itemDescription` and `#itemSource` for Description and Source
- [ ] Implement `syncSpellCard()`: branch at top of `syncCard()` when `cardMode === 'spell'`; populates all spell preview elements; fires `setDirty(true)` and `scheduleAutoSave()`
- [ ] Implement `buildSpellCardNode(s)`: self-contained HTML builder for the compact spell card; branch in `buildCardNode(s)` on `s.cardMode === 'spell'`

### Phase 8c — Image & School Icons
*Spell school icons as default art; optional custom image upload.*

- [ ] Add PNG or SVG school icons to `img/defaults/` for all 8 schools: Abjuration, Conjuration, Divination, Enchantment, Evocation, Illusion, Necromancy, Transmutation
- [ ] Add `getSpellSchoolIconSrc(school)` lookup function (mirrors `getTypeDefaultSrc()` pattern for item cards)
- [ ] Show school icon in the circular image area by default when no custom image is uploaded; falls back to a generic magic icon (⟡) if school has no icon yet
- [ ] Add optional custom image upload for spell cards: reuse `bindUpload()` and the existing item image drag/crop/zoom pipeline; store as `spellImage`, `spellImageOffsetX`, `spellImageOffsetY`, `spellImageScale` in state
- [ ] Update the Appearance tab in spell mode: show/hide school icon toggle, replace item-specific controls (rarity colour, circle border, type image toggle) with spell-appropriate ones (school icon toggle, portrait style)
- [ ] Show school icon in the history bar `.history-thumb` for spell cards (mirrors item type icon pattern)

### Phase 8d — Compatibility & Settings
*Export pipeline, history bar, and settings wired up for spell cards.*

- [ ] Print and download selection modals: use `buildSpellCardNode()` for spell thumbnails; show school name + level label instead of rarity badge in the modal list
- [ ] JSON export/import: existing `minAppVersion` / unknown `cardMode` handling gracefully ignores unrecognised modes — verify and add a warning if a save file contains `cardMode: 'spell'` and the app doesn't support it yet
- [ ] Add "Spell Card Defaults" section to Settings tab: default School, default Casting Time, default Class list
- [ ] Extend "Clear All Data" reset handler to cover all spell-specific state fields and defaults

### Phase 8e — Polish
*Visual refinements and print options.*

- [ ] Level badge colour: Cantrip → silver/grey; 1st–5th → graduated gold tones; 6th–9th → deep violet/crimson to signal high-level magic
- [ ] Components chips: render V / S / M as small styled inline badges rather than plain text (e.g. a faint bordered pill per component)
- [ ] Concentration indicator: render a subtle pulsing or outlined ⟳ icon on the card when Concentration is checked; shown in the left side-stat position
- [ ] Ritual indicator: show `ℜ` or `[R]` glyph in the right side-stat position when Ritual is checked
- [ ] *At Higher Levels* section: distinct italic style, separated from main description by a thin rule, with a small `✦ At Higher Levels` header label
- [ ] Print layout: for text-heavy spell cards, add an "Allow Oversized" option mirroring the item card's existing `allowOversized` toggle so long descriptions are not clipped

</details>

---

## Phase 9 — Collaborative Editing (Exploratory) ⏸ Deferred
*Requires research before scoping. No implementation tasks defined yet.*

<details open>
<summary>Steps</summary>

- [ ] Research whether cross-user collaboration is achievable using only the user's own cloud storage (e.g. shared Drive folder, OneDrive shared folder) without a central database
- [ ] If cloud-storage-only isn't viable: evaluate minimal backend options (Cloudflare Workers KV, Supabase free tier) for shared collection state
- [ ] Define scope and break into implementation tasks once research is complete

</details>

---

## Phase 10 — Print Enhancements
*Upgrades the print pipeline with bleed, cut marks, double-sided layout, and per-print-run options.*

**Files:** `script.js`, `index.html`, `style.css`

<details>
<summary>Steps</summary>

**Bleed colour strategy:** Bleed is a CSS padding border on each card slot — the card image is never stretched. Front card slots use each card's own `state.cardColor` (e.g. `#d4b87a`) as the inline background, so bleed matches the card's actual base colour. Back card slots use `#1b180f` (the dark border colour of the default back image). The `printEntries` array is extended to carry `cardColor` alongside `url` and `oversized`.

- [x] Step 1 — `printOptions` state object
- [x] Step 2 — Print options UI in `printSelectModal`
- [x] Step 3 — `singlePrintModal`
- [x] Step 4 — CSS for print options UI
- [x] Step 5 — Multi-card confirm handler
- [x] Step 6 — Single-card print handler
- [x] Step 7 — Extend `printImagesInPopup(entries, mode, opts)`

**Card back persistence & JSON round-trip**

- [x] Step 8 — Card back file input + reset handler
- [x] Step 9 — `setCardBack()` helper + localStorage persistence
- [x] Step 10 — JSON export/import round-trip

**Scale control & card flip preview**

- [x] Step 11 — Scale control UI (`index.html`): `[↺ Reset] [slider] [label] [🔄 Flip]`
- [x] Step 12 — Card flip DOM (`index.html`): `.card-flip-container` + `.card-flip-back`
- [x] Step 13 — Flip CSS (`style.css`)
- [x] Step 14 — Flip JS (`script.js`): flip toggle, scale reset, flip-resets-on-navigation

</details>

---

## Phase 11 — Auto Sync Cards
*Add a settings toggle visible when a cloud provider is connected that auto-syncs the active card to Dropbox or Google Drive on the same cadence as autosave, and checks for newer versions in cloud storage before loading.*

**Files:** `script.js`, `index.html`
**Reference:** `docs/cloud_sync.md`

<details open>
<summary>Steps</summary>

- [ ] **Settings toggle** — add `Auto Sync Cards` control to the Settings tab, visible only when `getShareProvider()` reports a connected provider; persist to `localStorage` as `dnd_auto_sync_cards`
- [ ] **Card metadata** — extend each saved card with cloud sync fields: `cloudSyncProvider`, `cloudSyncFileId` (or `cloudSyncPath`), and `cloudSyncModifiedAt`
- [ ] **Upload flow** — create a cloud sync upload path separate from the existing share link flow:
  - For Dropbox: upload to `Artifex Arcanum/cards` using a stable filename (`card-${historyId}.json`)
  - For Google Drive: upload to `Artifex Arcanum/cards`; keep the returned file ID
  - If a sync file already exists for the card, overwrite it; do not create duplicates
  - After upload, store the cloud file identity and modified timestamp in local card metadata
- [ ] **Wire into autosave** — when `scheduleAutoSave()` fires and the toggle is enabled, save local history as normal then upload the active card; skip when there is no `activeHistoryId`
- [ ] **Cloud-to-local detection** — on card activate or app startup with provider connected, query cloud file metadata and compare remote modified time to local `updatedAt`/`cloudSyncModifiedAt`; if remote is newer, prompt the user before overwriting
- [ ] **Newer-version modal** — show a selection-style modal with the current card and the cloud timestamp; let the user accept or reject the update
- [ ] **UI wiring** — add the `Auto Sync Cards` toggle into the `shareProviderConnected` area or settings page; keep existing `discoverShareFilesBtn` label logic intact; visibility is controlled by provider connection state
- [ ] **Reuse API wrappers** — `_dbx()` and `_gdrive()` handle authenticated calls and token refresh; add metadata-only helper functions for Cloud API calls if needed (Dropbox metadata/listing, Google Drive metadata queries)
- [ ] **Error / edge case handling**:
  - Upload fails → keep local changes, show a non-fatal message
  - Provider disconnects → disable auto-sync, preserve toggle state
  - Cloud file missing → fall back to creating a new sync file
  - Card name changes → keep same file ID/path if possible; update metadata if not
- [ ] **Discovery modal filters** — add "Shared Bundles" / "Individual Cards" filter checkboxes (matching the Print Selection modal style); limit bundle imports to one at a time
- [ ] **Unified folder structure** — update folder creation and listing logic: `Artifex Arcanum/cards` for auto-sync files, `Artifex Arcanum/shared-bundles` for explicit shares

**Decisions**
- Current-card sync only.
- Prompt the user before replacing local data with a newer cloud version.
- One cloud file per card, stable filename: `card-${historyId}.json`.
- Cloud sync metadata stored on each card object (not a separate lookup table).
- Unified folder structure: `Artifex Arcanum` top-level, `cards` and `shared-bundles` subfolders.
- Explicit shares are single-card bundles; auto-sync is per-card files.
- Discovery modal: "Shared Bundles" and "Individual Cards" filter checkboxes; bundle imports limited to one at a time.

**Verification**
- Confirm toggle appears only after provider is connected
- Confirm active-card changes trigger sync uploads on autosave
- Confirm newer cloud versions are detected and prompt before overwrite
- Confirm Dropbox and Google Drive both use the worker proxy and CORS-safe routes
- Confirm discovery modal filters work and bundle imports are limited to one at a time

</details>


---

## Phase 12 — TODO List
*Catch-all remaining work and UX polish items from the current `TODO` notes.*

**Files:** `script.js`, `index.html`, `style.css`

<details>
<summary>Tasks</summary>

- [ ] Warn users before overwrite: prompt clearly when an import or action would overwrite existing cards, and offer to increase max storage safely.
- [ ] Investigate undo/autosave interaction: autosave is currently too aggressive and may make undo unreliable.
- [ ] Fix import limit edge case: if importing cards increases the limit from 25 to 26, preserve existing cards correctly and avoid accidental overwrites; support prompts for unlocking storage beyond 50 when needed.
- [ ] Clear share cache on provider change: disconnecting a cloud provider should clear cached share URLs so reconnecting with a different provider generates a fresh link.
- [ ] Stabilise collections dropdown width: keep the collections selector from changing size when its label updates, preventing header bar layout shifts.
- [ ] Widen the cards dropdown: make the current card name display wider (with the dropdown arrow still present) so long names do not truncate awkwardly.
- [ ] Replace carousel with card controls: remove the carousel and add clearer per-card actions in the header bar, including a delete button with confirmation.

</details>