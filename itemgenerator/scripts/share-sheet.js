// share-sheet.js - share provider UI events, share selection/discovery modal, Export & Share sheet open/close + wiring — part of split script.js; see index.html for load order
// ── SHARE PROVIDER UI EVENTS ──
$('connectDropboxBtn').addEventListener('click', () => connectDropbox());
$('connectGdriveBtn').addEventListener('click', () => connectGoogleDrive());
$('disconnectShareBtn').addEventListener('click', () => {
  clearShareConnection();
});
$('discoverShareFilesBtn').addEventListener('click', () => openShareDiscoveryModal());

// ── Share selection modal ──

function updateShareDiscoveryUI() {
  const checked = $('shareDiscoveryList').querySelectorAll('input[type="checkbox"]:checked').length;
  $('shareDiscoveryImport').disabled = checked === 0;
  $('shareDiscoveryDownload').disabled = checked === 0;
}

function formatShareFileDetails(file) {
  const parts = [];
  if (file.modifiedTime) {
    const dt = new Date(file.modifiedTime);
    if (!Number.isNaN(dt)) {
      parts.push(dt.toLocaleString([], { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }));
    }
  }
  if (file.size != null) {
    const size = Number(file.size);
    if (!Number.isNaN(size)) {
      const units = ['B','KB','MB'];
      let value = size;
      let index = 0;
      while (value >= 1024 && index < units.length - 1) {
        value /= 1024;
        index += 1;
      }
      parts.push(`${value.toFixed(index ? 1 : 0)} ${units[index]}`);
    }
  }
  return parts.join(' • ');
}

function buildShareDiscoveryList(files) {
  const listEl = $('shareDiscoveryList');
  listEl.innerHTML = '';
  if (!files.length) {
    listEl.innerHTML = '<p style="color:var(--text-muted);font-style:italic;text-align:center;margin:0.5rem 0;">No JSON exports found.</p>';
    return;
  }

  files.forEach(file => {
    const row = document.createElement('label');
    row.className = 'print-select-item';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.dataset.fileId = file.id || '';
    if (file.path) checkbox.dataset.filePath = file.path;
    checkbox.addEventListener('change', updateShareDiscoveryUI);

    const name = document.createElement('span');
    name.className = 'print-select-name';
    name.textContent = file.name;

    const meta = document.createElement('span');
    meta.className = 'print-select-rarity';
    meta.textContent = formatShareFileDetails(file);

    row.appendChild(checkbox);
    row.appendChild(name);
    row.appendChild(meta);
    listEl.appendChild(row);
  });

  updateShareDiscoveryUI();
}

async function listSharedJsonFiles() {
  const provider = getShareProvider();
  if (!provider || !getShareToken()) throw new Error('Not connected');
  if (provider === 'dropbox') return _listDropboxShareFiles();
  if (provider === 'gdrive') return _listGDriveShareFiles();
  return [];
}

async function _listDropboxShareFiles() {
  const files = [];
  let cursor = null;
  while (true) {
    const url = cursor
      ? 'https://api.dropboxapi.com/2/files/list_folder/continue'
      : 'https://api.dropboxapi.com/2/files/list_folder';
    const resp = await _dbx(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ path: DROPBOX_FOLDER, recursive: false, include_media_info: false, include_deleted: false, include_non_downloadable_files: false }),
    });
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({}));
      if (err.error && err.error['.tag'] === 'path' && err.error.path['.tag'] === 'not_found') return [];
      throw new Error('Dropbox file list failed');
    }
    const data = await resp.json();
    data.entries.filter(entry => entry['.tag'] === 'file' && entry.name.toLowerCase().endsWith('.json')).forEach(entry => {
      files.push({
        id: entry.id,
        path: entry.path_lower || entry.path_display,
        name: entry.name,
        modifiedTime: entry.server_modified,
        size: entry.size,
      });
    });
    if (!data.has_more) break;
    cursor = data.cursor;
  }
  return files.sort((a, b) => new Date(b.modifiedTime) - new Date(a.modifiedTime));
}

async function _downloadDropboxJson(path) {
  const resp = await _dbx('https://content.dropboxapi.com/2/files/download', {
    method: 'POST',
    headers: { 'Dropbox-API-Arg': JSON.stringify({ path }) },
  });
  if (!resp.ok) throw new Error('Dropbox download failed');
  return resp.json();
}

async function _listGDriveShareFiles() {
  const folderId = await _gdriveGetOrCreateFolder();
  if (!folderId) return [];
  const q = encodeURIComponent(`'${folderId}' in parents and trashed=false and mimeType='application/json'`);
  const url = `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name,modifiedTime,size)&orderBy=modifiedTime desc&pageSize=100`;
  const resp = await _gdrive(url, { method: 'GET', headers: {} });
  if (!resp.ok) throw new Error('Google Drive file list failed');
  const data = await resp.json();
  return (data.files || []).map(file => ({
    id: file.id,
    name: file.name,
    modifiedTime: file.modifiedTime,
    size: file.size,
  }));
}

async function _downloadGDriveJson(fileId) {
  const resp = await _gdrive(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media`, { method: 'GET', headers: {} });
  if (!resp.ok) throw new Error('Google Drive download failed');
  return resp.json();
}

function _normalizeImportSource(data) {
  const items = Array.isArray(data)
    ? data
    : (Array.isArray(data.items) ? data.items : (Array.isArray(data.cards) ? data.cards : []));
  const collections = Array.isArray(data) ? [] : (Array.isArray(data.collections) ? data.collections : []);
  return { items: items.filter(item => item && typeof item === 'object'), collections, cardBack: data.cardBack };
}

function importJsonObject(data) {
  const parsed = _normalizeImportSource(data);
  if (!parsed.items.length) {
    showInfoModal('Nothing to Import', 'No items found in that JSON export.');
    return;
  }
  if (parsed.cardBack) setCardBack(parsed.cardBack);

  const existing = getHistory();
  const { newCards, skipCount } = _deduplicateCards(parsed.items, existing);
  if (!newCards.length) {
    const s = parsed.items.length !== 1 ? 's' : '';
    showInfoModal('Nothing New to Import', `All ${parsed.items.length} card${s} in this file are already in your collection.`);
    return;
  }

  const newNames = new Set(newCards.map(c => c.name));
  const existingToKeep = existing.filter(e => !newNames.has(e.name));
  const totalMerged = newCards.length + existingToKeep.length;
  const s = n => n !== 1 ? 's' : '';
  const skipNote = skipCount > 0 ? ` (${skipCount} duplicate${s(skipCount)} skipped)` : '';

  function doImport(limit) {
    const remapped = mergeImportedCollections(parsed.collections, newCards);
    saveHistory([...remapped, ...existingToKeep].slice(0, limit));
    renderCollectionDropdown();
    renderHistoryBar();
    applyState(remapped[0]);
    showInfoModal('Import Complete', `Imported ${remapped.length} card${s(remapped.length)}${skipNote}.`);
  }

  const wouldDrop = Math.max(0, totalMerged - getMaxHistory());
  if (wouldDrop > 0) {
    const currentMax = getMaxHistory();
    const newMax = totalMerged;
    $('importOverflowMsg').innerHTML =
      `You're importing <strong>${newCards.length} card${s(newCards.length)}</strong>${skipNote}, but your current storage limit is <strong>${currentMax}</strong>. ` +
      `Keeping everything would need a limit of <strong>${newMax}</strong> — or continue as-is and the oldest <strong>${wouldDrop} card${s(wouldDrop)}</strong> will be removed.`;
    $('importOverflowExpand').textContent = `↑ Increase limit to ${newMax}`;
    $('importOverflowContinue').textContent = `Import anyway (drop ${wouldDrop})`;
    $('importOverflowExpand').onclick = () => {
      hideImportOverflowModal();
      window._setMaxHistoryFromImport(newMax);
      doImport(newMax);
    };
    $('importOverflowContinue').onclick = () => {
      hideImportOverflowModal();
      doImport(currentMax);
    };
    $('importOverflowModal').classList.add('active');
  } else {
    doImport(getMaxHistory());
  }
}

async function importSelectedDiscoveryFiles() {
  const checked = [...$('shareDiscoveryList').querySelectorAll('input[type="checkbox"]:checked')];
  if (!checked.length) return;
  try {
    const provider = getShareProvider();
    const payloads = await Promise.all(checked.map(async cb => {
      const id = cb.dataset.fileId;
      const path = cb.dataset.filePath;
      return provider === 'dropbox' ? await _downloadDropboxJson(path) : await _downloadGDriveJson(id);
    }));
    const merged = payloads.reduce((acc, data) => {
      const normalized = _normalizeImportSource(data);
      acc.items.push(...normalized.items);
      acc.collections.push(...normalized.collections);
      if (normalized.cardBack && !acc.cardBack) acc.cardBack = normalized.cardBack;
      return acc;
    }, { items: [], collections: [], cardBack: null });
    $('shareDiscoveryModal').classList.remove('active');
    importJsonObject(merged);
  } catch (err) {
    console.error('[share] discovery import failed', err);
    showInfoModal('Import Failed', 'Unable to download or import the selected shared JSON files.');
  }
}

async function downloadSelectedDiscoveryFiles() {
  const checked = [...$('shareDiscoveryList').querySelectorAll('input[type="checkbox"]:checked')];
  if (!checked.length) return;
  try {
    const provider = getShareProvider();
    await Promise.all(checked.map(async cb => {
      const id = cb.dataset.fileId;
      const path = cb.dataset.filePath;
      const data = provider === 'dropbox' ? await _downloadDropboxJson(path) : await _downloadGDriveJson(id);
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cb.nextSibling?.textContent || 'shared'}.json`;
      a.click();
      URL.revokeObjectURL(url);
    }));
  } catch (err) {
    console.error('[share] discovery download failed', err);
    showInfoModal('Download Failed', 'Unable to download the selected shared JSON files.');
  }
}

async function openShareDiscoveryModal() {
  const modal = $('shareDiscoveryModal');
  const status = $('shareDiscoveryStatus');
  const listEl = $('shareDiscoveryList');
  status.textContent = 'Loading shared JSON files…';
  listEl.innerHTML = '';
  $('shareDiscoveryImport').disabled = true;
  $('shareDiscoveryDownload').disabled = true;
  modal.classList.add('active');
  try {
    const files = await listSharedJsonFiles();
    if (!files.length) {
      status.textContent = 'No shared JSON files were found in your connected cloud storage.';
      buildShareDiscoveryList([]);
      return;
    }
    status.textContent = `${files.length} file${files.length === 1 ? '' : 's'} found. Select one or more to import or download.`;
    buildShareDiscoveryList(files);
  } catch (err) {
    modal.classList.remove('active');
    console.error('[share] discovery failed', err);
    showInfoModal('Unable to Browse Files', err.message || 'Could not retrieve shared JSON files.');
  }
}

// "Share Dropbox Link to Selection" button — opens the selection modal
// Superseded by the Export & Share sheet's Share-link row + selection mode.
$('copyShareLinkBtn').addEventListener('click', () => {
  if (window._openExportSheet) window._openExportSheet();
});

$('shareDiscoveryAll').addEventListener('click', () => {
  $('shareDiscoveryList').querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
  updateShareDiscoveryUI();
});
$('shareDiscoveryNone').addEventListener('click', () => {
  $('shareDiscoveryList').querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  updateShareDiscoveryUI();
});
$('shareDiscoveryCancel').addEventListener('click', () => {
  $('shareDiscoveryModal').classList.remove('active');
});
$('shareDiscoveryImport').addEventListener('click', async () => {
  await importSelectedDiscoveryFiles();
});
$('shareDiscoveryDownload').addEventListener('click', async () => {
  await downloadSelectedDiscoveryFiles();
});

// Click the URL box to copy its contents
$('shareLinkUrlBox').addEventListener('click', async () => {
  const urlBox = $('shareLinkUrlBox');
  if (!urlBox.value) return;
  try {
    await navigator.clipboard.writeText(urlBox.value);
    urlBox.select();
    setShareFeedback('✓ Link copied!', 'rgba(100,200,100,0.9)');
  } catch {
    urlBox.select();
  }
});

// ── EXPORT & SHARE SHEET (Phase 4b) ──────────────────────────────────────────
// One outbound surface operating on the current "selection".
// 4b-1: selection = the current card (multi-select arrives with selection mode).

// The cards ticked in the Export & Share sheet's checklist. The active card uses
// its live (unsaved-edits-included) state; others use their saved history state.
// Falls back to the current card when nothing is ticked.
function getExportSelection() {
  const list = $('exportPickList');
  if (list) {
    const ids = [...list.querySelectorAll('input[type="checkbox"][value]:checked')].map(cb => Number(cb.value));
    if (ids.length) {
      const hist = getHistory();
      return ids
        .map(id => (id === activeHistoryId ? collectCurrentState() : hist.find(h => h.id === id)))
        .filter(Boolean);
    }
  }
  return [collectCurrentState()];
}

// Render each state and trigger a PNG download.
async function downloadPngs(states) {
  if (!states.length) return;
  const multi = states.length > 1;
  showProgress(multi ? 'Rendering items…' : 'Rendering card…', multi);
  let done = 0;
  for (let i = 0; i < states.length; i++) {
    if (_exportCancelled) break;
    const item = states[i];
    updateProgress(i, states.length, `Rendering "${item.name || 'Unnamed'}"${multi ? ` (${i + 1}/${states.length})` : ''}…`);
    try {
      const canvas = await renderStateToCanvas(item);
      if (_exportCancelled) break;
      const link = document.createElement('a');
      link.download = buildExportFilename(item);
      link.href = canvas.toDataURL('image/png');
      link.click();
      done++;
      if (multi) await new Promise(r => setTimeout(r, 400));
    } catch (e) { console.error('Failed to render', item.name, e); }
  }
  updateProgress(states.length, states.length, _exportCancelled ? `Cancelled — ${done} downloaded.` : 'Done!');
  await new Promise(r => setTimeout(r, 500));
  hideProgress();
}

// Render each state and open the print popup (single card or A4 sheet).
async function printStates(states, opts) {
  if (!states.length) return;
  const o = Object.assign(
    { squareCorners: false, bleed: true, doubleSided: false, cardBackUrl: printOptions.cardBackUrl },
    opts || {}
  );
  printOptions.squareCorners = o.squareCorners;
  printOptions.bleed         = o.bleed;
  printOptions.doubleSided   = o.doubleSided;
  const multi = states.length > 1;
  showProgress('Preparing print…', multi);
  const entries = [];
  for (let i = 0; i < states.length; i++) {
    if (_exportCancelled) break;
    updateProgress(i, states.length, `Rendering "${states[i].name || 'Unnamed'}"${multi ? ` (${i + 1}/${states.length})` : ''}…`);
    try {
      const sp = o.squareCorners ? { ...states[i], squareCorners: true } : states[i];
      const canvas = await renderStateToCanvas(sp);
      if (_exportCancelled) break;
      entries.push({
        url:       canvas.toDataURL('image/png'),
        oversized: !!states[i].allowOversized,
        cardColor: states[i].cardColor || '#d4b87a',
      });
    } catch (e) { console.error('Failed to render', states[i].name, e); }
  }
  if (_exportCancelled || !entries.length) { hideProgress(); return; }
  updateProgress(states.length, states.length, 'Opening print dialog…');
  await new Promise(r => setTimeout(r, 200));
  hideProgress();
  printImagesInPopup(entries, multi ? 'all' : 'single', o);
}

// Export the given states as a JSON file.
function exportJsonStates(states) {
  const payload = { version: 2, collections: collectionsForCards(states), items: states };
  if (_cardBackData) payload.cardBack = _cardBackData;
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  const stamp = new Date().toISOString().slice(0, 19).replace('T', '-').replace(/:/g, '-');
  a.download = `artifex-arcanum-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Sheet open/close + wiring ──
(function () {
  const sheet = $('exportSheet');
  const scrim = $('exportSheetScrim');
  if (!sheet || !scrim) return;
  const count    = $('exportSheetCount');
  const feedback = $('exportSheetFeedback');

  function setSheetFeedback(msg, color) {
    feedback.textContent = msg || '';
    feedback.style.color = color || 'var(--arc-muted)';
  }

  function syncQuality() {
    const q = localStorage.getItem('dnd_export_quality') || 'standard';
    $('exportQStepper').querySelectorAll('button').forEach(b =>
      b.classList.toggle('active', b.dataset.q === q));
  }

  function updateCount() {
    const n = $('exportPickList').querySelectorAll('input[type="checkbox"][value]:checked').length;
    count.textContent = n === 0 ? 'Current card' : n === 1 ? '1 card' : `${n} cards`;
  }

  // Collection-grouped, collapsible card checklist (ported from the pre-overhaul
  // selection modal). All saved cards start ticked.
  function buildPickList() {
    const listEl = $('exportPickList');
    if (!listEl) return;
    const items = getHistory();
    const cols  = getCollections();
    listEl.innerHTML = '';

    if (!items.length) {
      const empty = document.createElement('div');
      empty.className = 'export-pick-empty';
      empty.textContent = 'No saved cards yet — this exports the current card.';
      listEl.appendChild(empty);
      updateCount();
      return;
    }

    const byCollection = new Map();
    const uncollected  = [];
    items.forEach(item => {
      if (item.collectionId && cols.find(c => c.id === item.collectionId)) {
        if (!byCollection.has(item.collectionId)) byCollection.set(item.collectionId, []);
        byCollection.get(item.collectionId).push(item);
      } else uncollected.push(item);
    });

    function syncGroupToggle(groupToggle, body) {
      const cbs = [...body.querySelectorAll('input[type="checkbox"]')];
      const n = cbs.filter(cb => cb.checked).length;
      groupToggle.indeterminate = n > 0 && n < cbs.length;
      groupToggle.checked = n === cbs.length;
    }

    function addGroupHeader(name, groupItems) {
      const header = document.createElement('div');
      header.className = 'select-group-header';
      const caret = document.createElement('span');
      caret.className = 'select-group-caret';
      caret.textContent = '▾';
      const selectToggle = document.createElement('input');
      selectToggle.type = 'checkbox';
      selectToggle.checked = true;
      selectToggle.className = 'select-group-toggle';
      const label = document.createElement('span');
      label.className = 'select-group-name';
      label.textContent = name;
      const cnt = document.createElement('span');
      cnt.className = 'select-group-count';
      cnt.textContent = `(${groupItems.length})`;
      header.append(caret, selectToggle, label, cnt);
      listEl.appendChild(header);
      const body = document.createElement('div');
      body.className = 'select-group-body';
      listEl.appendChild(body);
      selectToggle.addEventListener('change', () => {
        body.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = selectToggle.checked; });
        selectToggle.indeterminate = false;
        updateCount();
      });
      caret.addEventListener('click', () => {
        const collapsed = body.classList.toggle('collapsed');
        caret.textContent = collapsed ? '▸' : '▾';
      });
      return { body, selectToggle };
    }

    function addItemRow(item, isChild, body, groupToggle) {
      const row = document.createElement('label');
      row.className = 'print-select-item' + (isChild ? ' collection-child' : '');
      const rarityLabel = rarityLabels[item.rarity] || item.rarity || '';
      row.innerHTML = `<input type="checkbox" value="${item.id}" checked>
        <span class="print-select-name">${item.name || 'Unnamed'}</span>
        <span class="history-rarity rarity-${item.rarity}" style="margin-left:auto;flex-shrink:0;">${rarityLabel}</span>`;
      row.querySelector('input').addEventListener('change', () => {
        if (groupToggle) syncGroupToggle(groupToggle, body);
        updateCount();
      });
      (body || listEl).appendChild(row);
    }

    cols.forEach(col => {
      const group = byCollection.get(col.id);
      if (!group || !group.length) return;
      const { body, selectToggle } = addGroupHeader(col.name, group);
      group.forEach(item => addItemRow(item, true, body, selectToggle));
    });
    if (uncollected.length) {
      if (byCollection.size > 0) {
        const { body, selectToggle } = addGroupHeader('Uncollected', uncollected);
        uncollected.forEach(item => addItemRow(item, true, body, selectToggle));
      } else {
        uncollected.forEach(item => addItemRow(item, false, null, null));
      }
    }
    updateCount();
  }

  function openSheet() {
    buildPickList();
    const provider = (typeof getShareProvider === 'function') ? getShareProvider() : null;
    $('exportRowShareSub').textContent = provider ? '' : 'connect a provider in Settings';
    $('exportRowShare').classList.toggle('export-row-disabled', !provider);
    setSheetFeedback('');
    syncQuality();
    scrim.classList.add('active');
    sheet.classList.add('active');
  }

  function closeSheet() {
    scrim.classList.remove('active');
    sheet.classList.remove('active');
  }
  window._openExportSheet  = openSheet;
  window._closeExportSheet = closeSheet;

  $('exportShareBtn').addEventListener('click', openSheet);
  $('exportSheetCancel').addEventListener('click', closeSheet);
  scrim.addEventListener('click', closeSheet);

  $('exportPickAll').addEventListener('click', () => {
    $('exportPickList').querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = true; cb.indeterminate = false; });
    updateCount();
  });
  $('exportPickNone').addEventListener('click', () => {
    $('exportPickList').querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = false; cb.indeterminate = false; });
    updateCount();
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && sheet.classList.contains('active')) closeSheet();
  });

  $('exportQStepper').querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      localStorage.setItem('dnd_export_quality', btn.dataset.q);
      syncAllQualityUI(btn.dataset.q);
      syncQuality();
    });
  });

  $('exportRowPng').addEventListener('click', async () => {
    const sel = getExportSelection();
    closeSheet();
    try { await downloadPngs(sel); }
    catch (e) { showInfoModal('Export Failed', 'Export failed. If you used external images, try uploading them directly.'); }
  });

  $('exportRowPrint').addEventListener('click', async () => {
    const sel = getExportSelection();
    const opts = {
      squareCorners: $('exportOptSquareCorners').checked,
      bleed:         $('exportOptBleed').checked,
      doubleSided:   $('exportOptDoubleSided').checked,
    };
    closeSheet();
    try { await printStates(sel, opts); }
    catch (e) { hideProgress(); showInfoModal('Print Failed', 'Print failed: ' + (e && e.message || e)); }
  });

  $('exportRowShare').addEventListener('click', async () => {
    const provider = (typeof getShareProvider === 'function') ? getShareProvider() : null;
    if (!provider) { setSheetFeedback('Connect a cloud provider in Settings to share a link.', 'var(--arc-warn)'); return; }
    const sel = getExportSelection();
    setSheetFeedback('⏳ Uploading…', 'var(--arc-muted)');
    try {
      const url = await shareCurrentCard(sel);
      if (url) {
        await navigator.clipboard.writeText(url).catch(() => {});
        setSheetFeedback(`✓ Link copied! (${sel.length} card${sel.length !== 1 ? 's' : ''})`, 'var(--arc-good)');
      }
    } catch (err) {
      if (err.message === 'network_error') setSheetFeedback('Could not reach your cloud provider — check your connection.', 'var(--arc-danger)');
      else if (err.message === 'auth_expired') { /* auth modal shown by the share layer */ }
      else setSheetFeedback('Failed to share — please try again.', 'var(--arc-danger)');
      console.error('[share] export sheet error:', err);
    }
  });

  $('exportRowJson').addEventListener('click', () => {
    const sel = getExportSelection();
    closeSheet();
    exportJsonStates(sel);
  });
})();

// Helper — sets share feedback text.
// isError=true: message stays permanently so the user can read it.
// isError=false (default): fades out after 3 s.
let _shareFeedbackTimer = null;
function setShareFeedback(msg, color, isError) {
  const feedback = $('shareLinkFeedback');
  clearTimeout(_shareFeedbackTimer);
  // Snap opacity back to visible before changing text
  feedback.style.transition = 'none';
  feedback.style.opacity = '1';
  feedback.textContent = msg;
  feedback.style.color = color || '';
  if (msg && !isError) {
    _shareFeedbackTimer = setTimeout(() => {
      feedback.style.transition = 'opacity 0.6s ease';
      feedback.style.opacity = '0';
      // Clear text after the fade so the space stays reserved
      setTimeout(() => { feedback.textContent = ''; feedback.style.color = ''; }, 650);
    }, 3000);
  }
}

// Share import modal buttons (Step 6)
$('shareImportDismiss').addEventListener('click', () => {
  $('shareImportModal').classList.remove('active');
});

