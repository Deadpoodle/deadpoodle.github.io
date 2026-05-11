## Plan: Auto Sync Cards feature

TL;DR: Add a settings toggle visible when a cloud provider is connected that auto-syncs the active card to Dropbox or Google Drive on the same cadence as autosave, and checks for newer versions in cloud storage before loading.

**Steps**
1. Add a new settings control in the Settings tab called `Auto Sync Cards` that is only visible when `getShareProvider()` reports a connected provider. This control should store its value in localStorage, e.g. `dnd_auto_sync_cards`.
2. Extend card metadata so each saved card can track cloud sync state. This should include fields like `cloudSyncProvider`, `cloudSyncFileId` or `cloudSyncPath`, and `cloudSyncModifiedAt`.
3. Create a cloud sync upload flow separate from the existing share link flow:
   - For Dropbox: upload to a managed path inside `DROPBOX_FOLDER`, using a stable filename derived from the local card ID and maybe item name.
   - For Google Drive: upload to the `Artifex Arcanum` folder using a stable filename and keep the returned file ID.
   - If a cloud sync file already exists for the card, overwrite it instead of creating a new file each time.
   - After upload, store the cloud file identity and modified timestamp in local metadata.
4. Wire auto-sync into the existing autosave cadence:
   - When `scheduleAutoSave()` fires and `Auto Sync Cards` is enabled, save local history as usual and then upload the active card.
   - Avoid uploading when there is no activeHistoryId or when the card is not cloud-sync eligible.
5. Implement cloud-to-local sync detection for the current item:
   - When a card becomes active or on app startup with provider connected, check the card’s cloud metadata.
   - Query cloud file metadata and compare remote modified time to local `updatedAt`/`cloudSyncModifiedAt`.
   - If the remote version is newer, show a prompt rather than silently overwriting, as requested.
6. Build a user prompt/modal for pulling newer cloud versions:
   - Use a selection-style modal or prompt that can show the current card plus the cloud timestamp.
   - Let the user accept or reject the update.
7. Update UI text and provider logic:
   - Keep the existing `discoverShareFilesBtn` label logic, and add the new `Auto Sync Cards` toggle into the `shareProviderConnected` area or settings page.
   - Ensure provider connection state controls visibility.
8. Reuse existing API wrappers:
   - `_dbx()` and `_gdrive()` should already handle authenticated calls and token refresh.
   - Add helper functions for metadata-only Cloud API calls if needed (Dropbox metadata/listing, Google Drive metadata queries).
9. Add failures/edge cases handling:
   - If cloud upload fails, keep local changes and show a non-fatal message.
   - If provider disconnects, disable auto-sync and preserve the toggle state.
   - If the cloud file is missing, fall back to creating a new sync file.
   - If the card name changes, keep the same file ID/path if possible; if not, update metadata.
10. Verification:
   - Confirm toggle appears only after connect.
   - Confirm active-card changes cause sync uploads on autosave.
   - Confirm newer cloud versions are detected and prompt before overwrite.
   - Confirm Dropbox and Google Drive both use the worker proxy and CORS-safe routes.

**Relevant files**
- `itemgenerator/index.html` — add the new settings toggle and conditional visibility.
- `itemgenerator/script.js` — implement local metadata, auto-sync toggle persistence, upload/download sync code, and provider-specific file mapping.
- `itemgenerator/docs/cloudflare-worker.js` — no changes needed beyond existing proxy support, but verify Drive and Dropbox API host access remains correct.

**Decisions**
- Use current-card sync only, per your preference.
- Ask before replacing local data with newer cloud versions.
- Use one cloud file per card, with a stable filename based on the local history ID (`card-${historyId}.json`).
- Store cloud sync metadata on every card object rather than using a separate sync lookup table.
- Unify folder structure across providers: use "Artifex Arcanum" as the top-level folder, with subfolders `cards` for auto-sync files and `shared-bundles` for explicit shares.

**Why one file per card is better**
- It gives stable identity for each card and makes version checks easy.
- It avoids rewriting the whole dataset and reduces merge complexity.
- The current share flow already works with separate JSON files, so this extends the same pattern.
- A single file could still work, but it would require full-file reconciliation, which is more fragile and less efficient.

**Why sync state belongs on each card**
- It keeps implementation simple and avoids a separate lookup layer.
- Each card carries its own sync metadata, so state is available whenever the card is loaded.
- This is easier to maintain for the current scope and avoids unnecessary complexity.

**Next step**
- Once you approve, I can add it as a new phase at the end of `itemgenerator/docs/IMPLEMENTATION_PLAN.md`.


Paste the below to implementation_plan.md

## Implementation Plan

### Phase 1: Auto Sync Cards feature

TL;DR: Add a settings toggle visible when a cloud provider is connected that auto-syncs the active card to Dropbox or Google Drive on the same cadence as autosave, and checks for newer versions in cloud storage before loading.

**Steps**
1. Add a new settings control in the Settings tab called `Auto Sync Cards` that is only visible when `getShareProvider()` reports a connected provider. This control should store its value in localStorage, e.g. `dnd_auto_sync_cards`.
2. Extend card metadata so each saved card can track cloud sync state. This should include fields like `cloudSyncProvider`, `cloudSyncFileId` or `cloudSyncPath`, and `cloudSyncModifiedAt`.
3. Create a cloud sync upload flow separate from the existing share link flow:
   - For Dropbox: upload to "Artifex Arcanum/cards", using a stable filename derived from the local card ID and maybe item name.
   - For Google Drive: upload to the "Artifex Arcanum/cards" folder using a stable filename and keep the returned file ID.
   - If a cloud sync file already exists for the card, overwrite it instead of creating a new file each time.
   - After upload, store the cloud file identity and modified timestamp in local metadata.
4. Wire auto-sync into the existing autosave cadence:
   - When `scheduleAutoSave()` fires and `Auto Sync Cards` is enabled, save local history as usual and then upload the active card.
   - Avoid uploading when there is no activeHistoryId or when the card is not cloud-sync eligible.
5. Implement cloud-to-local sync detection for the current item:
   - When a card becomes active or on app startup with provider connected, check the card’s cloud metadata.
   - Query cloud file metadata and compare remote modified time to local `updatedAt`/`cloudSyncModifiedAt`.
   - If the remote version is newer, show a prompt rather than silently overwriting, as requested.
6. Build a user prompt/modal for pulling newer cloud versions:
   - Use a selection-style modal or prompt that can show the current card plus the cloud timestamp.
   - Let the user accept or reject the update.
7. Update UI text and provider logic:
   - Keep the existing `discoverShareFilesBtn` label logic, and add the new `Auto Sync Cards` toggle into the `shareProviderConnected` area or settings page.
   - Ensure provider connection state controls visibility.
8. Reuse existing API wrappers:
   - `_dbx()` and `_gdrive()` should already handle authenticated calls and token refresh.
   - Add helper functions for metadata-only Cloud API calls if needed (Dropbox metadata/listing, Google Drive metadata queries).
9. Add failures/edge cases handling:
   - If cloud upload fails, keep local changes and show a non-fatal message.
   - If provider disconnects, disable auto-sync and preserve the toggle state.
   - If the cloud file is missing, fall back to creating a new sync file.
   - If the card name changes, keep the same file ID/path if possible; if not, update metadata.
10. Update the discovery modal to include filters like the Print Selection modal, with checkboxes for "Shared Bundles" and "Individual Cards", and limit bundle imports to one at a time.
11. Update folder creation and listing logic to use the unified folder structure: "Artifex Arcanum" top-level with "cards" and "shared-bundles" subfolders.
12. Verification:
   - Confirm toggle appears only after connect.
   - Confirm active-card changes cause sync uploads on autosave.
   - Confirm newer cloud versions are detected and prompt before overwrite.
   - Confirm Dropbox and Google Drive both use the worker proxy and CORS-safe routes.
   - Confirm discovery modal filters work and bundle imports are limited.

**Relevant files**
- `itemgenerator/index.html` — add the new settings toggle and conditional visibility, update discovery modal with filters.
- `itemgenerator/script.js` — implement local metadata, auto-sync toggle persistence, upload/download sync code, provider-specific file mapping, update discovery listing and import logic.
- `itemgenerator/docs/cloudflare-worker.js` — no changes needed beyond existing proxy support, but verify Drive and Dropbox API host access remains correct.

**Decisions**
- Use current-card sync only, per your preference.
- Ask before replacing local data with newer cloud versions.
- Use one cloud file per card (recommended), rather than trying to sync a single big list file.
- Unify folder structure across providers: Use "Artifex Arcanum" as the top-level folder, with subfolders "cards" for auto-sync files and "shared-bundles" for explicit shares.
- Explicit shares are bundles (single JSON files), while auto-sync is per-card files.
- Limit bundle imports to one at a time in the discovery modal.
- Add filters in the discovery modal like the Print Selection modal, with checkboxes for "Shared Bundles" and "Individual Cards".

**Why one file per card is better**
- It gives stable identity for each card and makes version checks easy.
- It avoids rewriting the whole dataset and reduces merge complexity.
- The current share flow already works with separate JSON files, so this extends the same pattern.
- A single file could still work, but it would require full-file reconciliation, which is more fragile and less efficient.

**Further considerations**
1. Should the sync file use the local history ID in its filename, or a neutral `card-${historyId}.json` pattern? This will affect file lookup and rename behavior.
2. Use "cards" subfolder for auto-sync files and "shared-bundles" for explicit shares to keep them distinct.
3. Should the sync state be stored on every card object, or in a separate lookup table keyed by card ID? The latter is more flexible but more code.