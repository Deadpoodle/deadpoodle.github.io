// history-ui.js - save chip, collectCurrentState/applyState/tryLoadItem, collection UI helpers, selection mode, left-rail accordion, dropdown events, collection modals, type filter — part of split script.js; see index.html for load order
// ── SAVE CHIP (single save indicator — replaces the Unsaved Changes modal) ──
// Number of card fields that differ from the snapshot taken when the card was loaded/saved.
function computeChangeCount() {
  if (!_undoBaseline) return null;
  const cur = collectCurrentState();
  let n = 0;
  for (const k in cur) {
    if (k === 'id') continue;
    if (JSON.stringify(cur[k]) !== JSON.stringify(_undoBaseline[k])) n++;
  }
  return n;
}

function updateSaveChip(state) {
  const chip = $('saveChip');
  if (!chip) return;
  chip.dataset.state = state;
  const txt = chip.querySelector('.save-chip-text');
  if (!txt) return;
  if (state === 'saving') { txt.textContent = 'saving…'; return; }
  if (state === 'unsaved') {
    const n = computeChangeCount();
    txt.textContent = (n && n > 0) ? `unsaved · ${n} change${n === 1 ? '' : 's'}` : 'unsaved changes';
    return;
  }
  txt.textContent = 'saved · the ink is dry';
}

function switchToEditTab() {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const editBtn = document.querySelector('.tab-btn[data-tab="edit"]');
  if (editBtn) editBtn.classList.add('active');
  $('tab-edit').classList.add('active');
}

function tryLoadItem(item) {
  const isDifferentItem = activeHistoryId !== item.id;
  // Always-on auto-save: commit any unsaved edits to the current card before switching away,
  // then load the requested one. No modal, no data loss.
  if (isDirty && isDifferentItem) doAutoSave();
  if (isDifferentItem) switchToEditTab();
  applyState(item);
}

function applyState(s) {
  _applyingState = true;
  $('itemName').value        = s.name        || '';
  $('itemType').value        = s.type        || 'Weapon';
  $('itemSubtype').value     = s.subtype     || '';
  $('itemRarity').value      = s.rarity      || 'common';
  $('itemBonus').value       = s.bonus       || '';
  $('itemDamage').value      = s.damage      || '';
  $('itemWeight').value      = s.weight      || '';
  $('bonusLabel').value      = s.bonusLabel  || 'Bonus';
  $('damageLabel').value     = s.damageLabel || 'Damage';
  $('weightLabel').value     = s.weightLabel || 'Weight';
  $('itemSave').value        = s.savingThrow || '';
  $('itemRange').value       = s.range       || '';
  $('saveLabel').value       = s.saveLabel   || 'Save';
  $('rangeLabel').value      = s.rangeLabel  || 'Range';
  $('showCollection').checked = s.showCollection === true;
  $('itemDescription').value = s.description || '';
  const knownAttuneModes = new Set(['', 'attunement', 'craftsman', 'resources', 'custom']);
  if (!knownAttuneModes.has(s.attunement || '')) {
    // Legacy card: attunement field holds display text — migrate to custom mode
    $('itemAttunement').value   = 'custom';
    $('attunementCustom').value = s.attunementCustom || s.attunement || '';
  } else {
    $('itemAttunement').value   = s.attunement  || '';
    $('attunementCustom').value = s.attunementCustom || '';
  }
  $('cardColorHex').value    = s.cardColor   || '#d4b87a';
  $('cardColor').value       = s.cardColor   || '#d4b87a';
  $('inkColorHex').value     = s.inkColor    || '#2c1a0e';
  $('inkColor').value        = s.inkColor    || '#2c1a0e';
  const rc = s.rarityColor || '';
  $('rarityColorHex').value  = rc;
  $('rarityColor').value     = /^#[0-9a-fA-F]{6}$/.test(rc) ? rc : getRarityDefaultColor();
  const cbc = s.circleBorderColor || '';
  $('circleBorderColorHex').value = cbc;
  $('circleBorderColor').value    = /^#[0-9a-fA-F]{6}$/.test(cbc) ? cbc : '#5a3c1e';
  $('circleSize').value      = s.circleSize  ?? 110;
  $('bgOpacity').value       = s.bgOpacity   ?? 1;
  const fs = s.fontScale ?? 1;
  $('fontScale').value       = fs;
  $('fontScaleLabel').textContent = Math.round(fs * 100) + '%';
  const dfs = s.descFontScale ?? 1;
  $('descFontScale').value       = dfs;
  $('descFontScaleLabel').textContent = Math.round(dfs * 100) + '%';
  $('headingFont').value     = s.headingFont || 'Cinzel';
  $('bodyFont').value        = s.bodyFont    || 'Crimson Pro';
  $('showImage').checked      = s.showImage     !== false;
  $('showStats').checked      = s.showStats     !== false;
  $('showFrame').checked      = s.showFrame     !== false;
  $('squareCorners').checked  = s.squareCorners  === true;
  $('allowOversized').checked = s.allowOversized === true;
  populateCollectionSelect(s.collectionId || null);

  // Background image
  if (s.bgImage) {
    $('cardBgImg').style.backgroundImage = `url('${s.bgImage}')`;
    $('bgPreview').src = s.bgImage;
    $('bgZone').classList.add('has-image');
    $('clearBg').style.display = 'inline-block';
    $('bgOpacityRow').style.display = 'block';
  } else {
    $('cardBgImg').style.backgroundImage = '';
    $('bgPreview').src = '';
    $('bgZone').classList.remove('has-image');
    $('clearBg').style.display = 'none';
    $('bgOpacityRow').style.display = 'none';
  }

  // Item image
  const img = $('cardItemImg');
  const ph  = $('imgPlaceholder');
  if (s.itemImage) {
    itemImgX        = s.imageOffsetX ?? 0;
    itemImgY        = s.imageOffsetY ?? 0;
    itemImgScale    = s.imageScale   ?? 1;
    itemImgNaturalW = s.imgNaturalW  ?? 0;
    itemImgNaturalH = s.imgNaturalH  ?? 0;
    if ($('itemImgZoom')) $('itemImgZoom').value = itemImgScale;
    const restoreTransform = () => {
      if (!itemImgNaturalW) {
        itemImgNaturalW = img.naturalWidth;
        itemImgNaturalH = img.naturalHeight;
      }
      updateItemImageTransform();
      showCropControls(true);
    };
    img.onload = null;
    img.onerror = null;
    if (img.src === s.itemImage && img.complete) {
      restoreTransform();
    } else {
      img.onload = restoreTransform;
      img.src = s.itemImage;
    }
    img.style.display = 'block';
    ph.style.display = 'none';
    $('itemImgPreview').src = s.itemImage;
    $('itemImgZone').classList.add('has-image');
    $('clearItem').style.display = 'inline-block';
  } else {
    img.onload = null;
    img.onerror = null;
    img.src = '';
    img.style.display = 'none';
    img.style.transform = '';
    ph.style.display = 'block';
    $('itemImgPreview').src = '';
    $('itemImgZone').classList.remove('has-image');
    $('clearItem').style.display = 'none';
    itemImgX = 0; itemImgY = 0; itemImgScale = 1;
    itemImgNaturalW = 0; itemImgNaturalH = 0;
    showCropControls(false);
  }

  _applyingState = false;
  if (s.id) {
    activeHistoryId = s.id;
    updateHistoryActiveClass();
    // Re-render the rail now so the "expand the active card's group" logic runs at
    // selection time (and syncs _lastAutoExpandedId). Otherwise the change is deferred
    // until the next unrelated render — e.g. a collection-head click — which would then
    // wrongly snap open the active card's group instead of the clicked one.
    renderLeftRail();
    _undoBaseline = JSON.parse(JSON.stringify(s));
  } else {
    _undoBaseline = null;
  }
  syncCard();
  setDirty(false);
}

function updateHistoryActiveClass() {
  document.querySelectorAll('.history-item, .history-dropdown-item').forEach(el => {
    const isActive = el.dataset.historyId === String(activeHistoryId);
    el.classList.toggle('history-active', isActive);
    const mark = el.querySelector('.item-dirty-mark');
    if (mark) mark.style.display = isActive && isDirty ? 'inline' : 'none';
  });
}

function makeHistoryThumb(item) {
  const thumb = document.createElement('div');
  thumb.className = 'history-thumb';
  if (item.itemImage) {
    const tImg = document.createElement('img');
    tImg.src = item.itemImage;
    tImg.alt = item.name;
    thumb.appendChild(tImg);
  } else {
    const fallback = document.createElement('img');
    fallback.src = 'img/brown_logo.png';
    fallback.alt = '';
    fallback.style.width = '65%';
    fallback.style.height = '65%';
    fallback.style.objectFit = 'contain';
    fallback.style.opacity = '0.55';
    thumb.style.display = 'flex';
    thumb.style.alignItems = 'center';
    thumb.style.justifyContent = 'center';
    thumb.appendChild(fallback);
  }
  return thumb;
}

let _historySearchQuery = '';

function _applyHistorySearch(query) {
  _historySearchQuery = query;
  const bar = $('historySearch');
  if (bar && bar.value !== query) bar.value = query;
  const barClear = $('historySearchClear');
  if (barClear) barClear.classList.toggle('visible', query.length > 0);

  const resultsEl = $('historySearchResults');
  if (resultsEl) {
    const q = query.trim().toLowerCase();
    if (q) {
      const matches = getHistory().filter(h => (h.name || '').toLowerCase().includes(q));
      resultsEl.innerHTML = '';
      matches.forEach(item => {
        const row = document.createElement('div');
        row.className = 'history-search-result-item';
        const name = document.createElement('span');
        name.className = 'history-search-result-name';
        name.textContent = item.name || 'Unnamed';
        row.appendChild(name);
        if (item.rarity) {
          const meta = document.createElement('span');
          meta.className = 'history-search-result-meta';
          meta.textContent = item.rarity;
          row.appendChild(meta);
        }
        row.addEventListener('click', () => { applyState(item); _applyHistorySearch(''); });
        resultsEl.appendChild(row);
      });
      resultsEl.classList.toggle('open', matches.length > 0);
    } else {
      resultsEl.innerHTML = '';
      resultsEl.classList.remove('open');
    }
  }

  renderHistoryBar();
}

// ── COLLECTION UI HELPERS ──

// Returns only the collections that are actually referenced by the given cards.
function collectionsForCards(cards) {
  const needed = new Set(cards.map(c => c.collectionId).filter(Boolean));
  return getCollections().filter(c => needed.has(c.id));
}

// Merges incoming collections into local storage, remapping IDs so cards
// with sender IDs end up pointing at the correct local collection IDs.
// Creates new collections for any that don't already exist by name.
// Returns the cards array with collectionId fields updated.
function mergeImportedCollections(sharedCollections, cards) {
  if (!sharedCollections || !sharedCollections.length) return cards;
  const existing = getCollections();
  const idMap    = new Map(); // senderCollectionId → localCollectionId
  const updated  = [...existing];
  sharedCollections.forEach((sc, i) => {
    const match = existing.find(c => c.name.toLowerCase() === sc.name.toLowerCase());
    if (match) {
      idMap.set(sc.id, match.id);
    } else {
      const newCol = { id: Date.now() + i, name: sc.name, description: sc.description || '' };
      updated.push(newCol);
      idMap.set(sc.id, newCol.id);
    }
  });
  saveCollections(updated);
  renderCollectionDropdown();
  return cards.map(card =>
    card.collectionId && idMap.has(card.collectionId)
      ? { ...card, collectionId: idMap.get(card.collectionId) }
      : card
  );
}

function buildExportFilename(item) {
  const safe = s => (s || '').replace(/[/\\:*?"<>|]/g, '').replace(/\s+/g, ' ').trim();
  const col  = item.collectionId ? getCollectionById(item.collectionId) : null;
  const mode = (item.cardMode || 'item');
  const modeLabel = mode.charAt(0).toUpperCase() + mode.slice(1) + 's';
  const name = safe(item.name) || 'Unnamed';
  if (col) return `${safe(col.name)} - ${modeLabel} - ${name}.png`;
  return `${modeLabel} - ${name}.png`;
}

function populateCollectionSelect(selectedId) {
  const sel = $('itemCollection');
  if (!sel) return;
  const cols = getCollections();
  sel.innerHTML = '<option value="">— None —</option>';
  cols.forEach(col => {
    const opt = document.createElement('option');
    opt.value = col.id;
    opt.textContent = col.name;
    if (col.id === selectedId) opt.selected = true;
    sel.appendChild(opt);
  });
}

function renderCollectionDropdown() {
  const container = $('collectionDropdownItems');
  if (!container) return;
  const cols = getCollections();
  const hist = getHistory();
  container.innerHTML = '';

  const allBtn = $('collectionFilterAll');
  if (allBtn) allBtn.classList.toggle('history-active', _activeCollectionId === null);

  if (cols.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'history-dropdown-empty';
    empty.style.cssText = 'padding:0.45rem 0.9rem;font-size:small;';
    empty.textContent = 'No collections yet';
    container.appendChild(empty);
    return;
  }

  cols.forEach(col => {
    const count = hist.filter(h => h.collectionId === col.id).length;
    const el = document.createElement('div');
    el.className = 'history-dropdown-item collection-dropdown-item' +
      (_activeCollectionId === col.id ? ' history-active' : '');
    el.innerHTML = `<span class="collection-dd-name">${col.name}</span>
                    <span class="collection-dd-count">${count}</span>`;
    el.addEventListener('click', () => {
      setActiveCollection(col.id);
      $('collectionDropdown').classList.remove('open');
    });
    container.appendChild(el);
  });
}

function renderCollectionsManageModal() {
  const list = $('collectionsList');
  if (!list) return;
  const cols = getCollections();
  const hist = getHistory();
  list.innerHTML = '';

  if (cols.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-style:italic;text-align:center;margin:0.5rem 0;">No collections yet. Create one below.</p>';
    return;
  }

  cols.forEach(col => {
    const count = hist.filter(h => h.collectionId === col.id).length;
    const row = document.createElement('div');
    row.className = 'collections-manage-row';
    row.innerHTML = `
      <div class="collections-manage-info">
        <span class="collections-manage-name">${col.name}</span>
        <span class="collections-manage-count">${count} card${count !== 1 ? 's' : ''}</span>
      </div>
      <div class="collections-manage-actions">
        <button class="btn-icon" title="Rename">✏</button>
        <button class="btn-icon btn-icon-danger" title="Delete">✕</button>
      </div>`;
    const [renameBtn, deleteBtn] = row.querySelectorAll('.btn-icon');
    renameBtn.addEventListener('click', () => openCollectionEditModal(col));
    deleteBtn.addEventListener('click', async () => {
      const confirmed = await showGenericConfirm(
        'Delete Collection',
        `Delete "<strong>${col.name}</strong>"? The ${count} card${count !== 1 ? 's' : ''} in it will become uncollected.`,
        'Delete'
      );
      if (!confirmed) return;
      deleteCollection(col.id);
      renderCollectionsManageModal();
      renderCollectionDropdown();
      populateCollectionSelect($('itemCollection') ? (parseInt($('itemCollection').value, 10) || null) : null);
      renderHistoryBar();
    });
    list.appendChild(row);
  });
}

let _collectionEditTarget = null;

function openCollectionEditModal(existing) {
  _collectionEditTarget = existing || null;
  $('collectionEditTitle').textContent = existing ? 'Rename Collection' : 'New Collection';
  $('collectionEditName').value  = existing ? existing.name : '';
  $('collectionEditDesc').value  = existing ? existing.description : '';
  $('collectionEditModal').classList.add('active');
  setTimeout(() => $('collectionEditName').focus(), 60);
}

// ── SELECTION MODE (cards strip → Export & Share acts on the selection) ──
let _selectionMode = false;
const _selection = new Set();

function updateSelectButton() {
  const label = _selectionMode
    ? (_selection.size ? `✕ Done (${_selection.size})` : '✕ Done')
    : 'Select…';
  ['selectModeBtn', 'railSelectBtn'].forEach(id => {
    const btn = $(id);
    if (!btn) return;
    btn.classList.toggle('active', _selectionMode);
    btn.textContent = label;
  });
}

function toggleCardSelection(id, el) {
  if (_selection.has(id)) { _selection.delete(id); el.classList.remove('selected'); }
  else { _selection.add(id); el.classList.add('selected'); }
  updateSelectButton();
}

function enterSelectionMode() {
  _selectionMode = true;
  _selection.clear();
  const track = $('historyTrack'); if (track) track.classList.add('selection-mode');
  const railList = $('railCollectionList'); if (railList) railList.classList.add('selection-mode');
  updateSelectButton();
  renderHistoryBar();
}

function exitSelectionMode() {
  _selectionMode = false;
  _selection.clear();
  const track = $('historyTrack'); if (track) track.classList.remove('selection-mode');
  const railList = $('railCollectionList'); if (railList) railList.classList.remove('selection-mode');
  updateSelectButton();
  renderHistoryBar();
}

$('selectModeBtn').addEventListener('click', () => {
  if (_selectionMode) exitSelectionMode(); else enterSelectionMode();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && _selectionMode) exitSelectionMode();
});

// Shared builder for a card row (used by the legacy cards-strip and the left rail).
function makeHistoryItemEl(item) {
  const rarityLabel = rarityLabels[item.rarity] || item.rarity || '';
  const el = document.createElement('div');
  el.className = 'history-item';
  el.dataset.historyId = item.id;
  el.title = `Load: ${item.name || 'Unnamed Item'}`;
  if (activeHistoryId === item.id) el.classList.add('history-active');

  const meta = document.createElement('div');
  meta.className = 'history-meta';
  meta.innerHTML = `<span class="history-name">${item.name || 'Unnamed'}</span>
                    <span class="history-rarity rarity-${item.rarity}">${rarityLabel}</span>`;

  const del = document.createElement('button');
  del.className = 'history-delete';
  del.title = 'Remove from history';
  del.textContent = '✕';
  del.addEventListener('click', e => {
    e.stopPropagation();
    const wasActive = activeHistoryId === item.id;
    const updated = getHistory().filter(h => h.id !== item.id);
    saveHistory(updated);
    if (wasActive) {
      if (updated.length > 0) applyState(updated[0]);
      else { activeHistoryId = null; applyState(getNewCardState()); }
    }
    renderHistoryBar();
  });

  const barMark = document.createElement('span');
  barMark.className = 'item-dirty-mark';
  barMark.textContent = '*';
  barMark.style.display = 'none';

  const check = document.createElement('span');
  check.className = 'history-check';
  check.setAttribute('aria-hidden', 'true');

  el.appendChild(check);
  el.appendChild(makeHistoryThumb(item));
  el.appendChild(meta);
  el.appendChild(barMark);
  el.appendChild(del);
  if (_selectionMode && _selection.has(item.id)) el.classList.add('selected');
  el.addEventListener('click', () => {
    if (_selectionMode) { toggleCardSelection(item.id, el); return; }
    tryLoadItem(item);
    requestAnimationFrame(scrollHistoryActiveToCenter);
  });
  return el;
}

// ── LEFT RAIL — collections accordion (each collection expands to its cards) ──
const _expandedCollections = new Set();
let _lastAutoExpandedId = null;

function renderLeftRail() {
  const list = $('railCollectionList');
  if (!list) return;

  let items = getHistory();
  if (_activeTypeFilter !== 'all') {
    items = items.filter(h => (h.cardMode || 'item') === _activeTypeFilter);
  }
  const cols = getCollections();

  // Auto-expand the group holding the active card when the selection changes.
  const activeItem = activeHistoryId != null
    ? getHistory().find(h => h.id === activeHistoryId) : null;
  const activeKey = activeItem
    ? (activeItem.collectionId != null ? 'col-' + activeItem.collectionId : 'uncat')
    : null;
  if (activeItem && activeHistoryId !== _lastAutoExpandedId) {
    _expandedCollections.add(activeKey);
    _lastAutoExpandedId = activeHistoryId;
  }

  // Real collections + an "Uncategorised" bucket for cards without a collection.
  const groups = [];
  cols.forEach(col => groups.push({
    key: 'col-' + col.id, name: col.name, colId: col.id,
    items: items.filter(h => h.collectionId === col.id),
  }));
  const uncategorised = items.filter(h => h.collectionId == null);
  if (uncategorised.length) {
    groups.push({ key: 'uncat', name: 'Uncategorised', items: uncategorised });
  }

  list.innerHTML = '';

  // "Expand All / Collapse All" toggle (replaces the old all-cards row).
  if (groups.length > 0) {
    const allKeys = groups.map(g => g.key);
    const allExpanded = allKeys.every(k => _expandedCollections.has(k));
    const toggle = document.createElement('button');
    toggle.className = 'rail-expand-all';
    toggle.textContent = allExpanded ? '▾ Collapse All' : '▸ Expand All';
    toggle.addEventListener('click', () => {
      if (allExpanded) allKeys.forEach(k => _expandedCollections.delete(k));
      else allKeys.forEach(k => _expandedCollections.add(k));
      renderLeftRail();
    });
    list.appendChild(toggle);
  } else {
    const empty = document.createElement('div');
    empty.className = 'history-empty';
    empty.textContent = 'No cards yet';
    list.appendChild(empty);
  }

  groups.forEach(g => {
    const wrap = document.createElement('div');
    wrap.className = 'rail-collection';
    const expanded = _expandedCollections.has(g.key);
    if (expanded) wrap.classList.add('expanded');
    if (activeItem && g.colId != null && g.colId === activeItem.collectionId) {
      wrap.classList.add('active-collection');
    }

    const head = document.createElement('button');
    head.className = 'rail-collection-head';
    head.innerHTML =
      `<span class="rail-caret">${expanded ? '▾' : '▸'}</span>` +
      `<span class="rail-col-name"></span>` +
      `<span class="rail-col-count">${g.items.length}</span>`;
    head.querySelector('.rail-col-name').textContent = g.name;
    head.addEventListener('click', () => {
      if (_expandedCollections.has(g.key)) _expandedCollections.delete(g.key);
      else _expandedCollections.add(g.key);
      renderLeftRail();
    });

    const cardsWrap = document.createElement('div');
    cardsWrap.className = 'rail-collection-cards';
    if (g.items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'history-empty';
      empty.textContent = 'No cards here yet';
      cardsWrap.appendChild(empty);
    } else {
      g.items.forEach(item => cardsWrap.appendChild(makeHistoryItemEl(item)));
    }

    wrap.appendChild(head);
    wrap.appendChild(cardsWrap);
    list.appendChild(wrap);
  });

  requestAnimationFrame(updateHistoryActiveClass);
}

function renderHistoryBar() {
  // The left rail is the primary card browser; keep it (and the storage meter)
  // in sync on every refresh, including the empty-state early returns below.
  renderLeftRail();
  updateStorageIndicator();

  const allItems   = getHistory();
  const q          = _historySearchQuery.trim().toLowerCase();
  let items = allItems;
  if (_activeCollectionId !== null) {
    items = items.filter(h => h.collectionId === _activeCollectionId);
  }
  if (_activeTypeFilter !== 'all') {
    items = items.filter(h => (h.cardMode || 'item') === _activeTypeFilter);
  }
  if (q) items = items.filter(h => (h.name || '').toLowerCase().includes(q));
  const container  = $('historyItems');
  const emptyMsg   = $('historyEmpty');
  const ddContainer = $('historyDropdownItems');
  const ddEmpty     = $('historyDropdownEmpty');
  container.innerHTML = '';
  ddContainer.innerHTML = '';

  if (allItems.length === 0) {
    emptyMsg.textContent = 'No saved items yet — click Save to History below';
    emptyMsg.style.display = 'flex';
    ddEmpty.textContent = 'No saved items yet';
    ddEmpty.style.display = 'block';
    return;
  }
  if (items.length === 0) {
    const col = _activeCollectionId ? getCollectionById(_activeCollectionId) : null;
    const msg = q ? 'No items match your search'
              : col ? `No cards in "${col.name}" yet`
              : 'No items match your search';
    emptyMsg.textContent = msg;
    emptyMsg.style.display = 'flex';
    ddEmpty.textContent = msg;
    ddEmpty.style.display = 'block';
    return;
  }
  emptyMsg.style.display = 'none';
  ddEmpty.style.display = 'none';

  items.forEach(item => {
    const rarityLabel = rarityLabels[item.rarity] || item.rarity || '';

    // ── Bar item ──
    container.appendChild(makeHistoryItemEl(item));

    // ── Dropdown item ──
    const ddEl = document.createElement('div');
    ddEl.className = 'history-dropdown-item';
    ddEl.dataset.historyId = item.id;

    const ddMeta = document.createElement('div');
    ddMeta.className = 'history-meta';
    ddMeta.innerHTML = `<span class="history-name">${item.name || 'Unnamed'}</span>
                        <span class="history-rarity rarity-${item.rarity}">${rarityLabel}</span>`;

    const ddDel = document.createElement('button');
    ddDel.className = 'history-delete';
    ddDel.title = 'Remove from history';
    ddDel.textContent = '✕';
    ddDel.addEventListener('click', e => {
      e.stopPropagation();
      const wasActive = activeHistoryId === item.id;
      const updated = getHistory().filter(h => h.id !== item.id);
      saveHistory(updated);
      if (wasActive) {
        if (updated.length > 0) {
          applyState(updated[0]);
        } else {
          activeHistoryId = null;
          applyState(getNewCardState());
        }
      }
      renderHistoryBar();
    });

    const ddMark = document.createElement('span');
    ddMark.className = 'item-dirty-mark';
    ddMark.textContent = '*';
    ddMark.style.display = 'none';

    ddEl.appendChild(makeHistoryThumb(item));
    ddEl.appendChild(ddMeta);
    ddEl.appendChild(ddMark);
    ddEl.appendChild(ddDel);
    ddEl.addEventListener('click', () => {
      tryLoadItem(item);
      $('historyDropdown').classList.remove('open');
      requestAnimationFrame(scrollHistoryActiveToCenter);
    });
    ddContainer.appendChild(ddEl);
  });

  // Refresh the active-card highlight after the DOM has updated
  requestAnimationFrame(updateHistoryActiveClass);
}

// ── COLLECTION DROPDOWN EVENTS ──
$('collectionDropdownBtn').addEventListener('click', e => {
  e.stopPropagation();
  $('historyDropdown').classList.remove('open');
  $('collectionDropdown').classList.toggle('open');
  if ($('collectionDropdown').classList.contains('open')) renderCollectionDropdown();
});

$('collectionFilterAll').addEventListener('click', () => {
  setActiveCollection(null);
  $('collectionDropdown').classList.remove('open');
});

$('collectionDropdownNew').addEventListener('click', () => {
  $('collectionDropdown').classList.remove('open');
  openCollectionEditModal(null);
});

$('collectionDropdownManage').addEventListener('click', () => {
  $('collectionDropdown').classList.remove('open');
  renderCollectionsManageModal();
  $('collectionsModal').classList.add('active');
});

// ── COLLECTION MANAGEMENT MODAL ──
$('collectionsClose').addEventListener('click', () => $('collectionsModal').classList.remove('active'));
$('collectionsAddNew').addEventListener('click', () => {
  $('collectionsModal').classList.remove('active');
  openCollectionEditModal(null);
});

// ── COLLECTION EDIT MODAL ──
$('collectionEditSave').addEventListener('click', () => {
  const name = $('collectionEditName').value.trim();
  if (!name) { $('collectionEditName').focus(); return; }
  const desc = $('collectionEditDesc').value;
  if (_collectionEditTarget) {
    updateCollection(_collectionEditTarget.id, name, desc);
  } else {
    createCollection(name, desc);
  }
  $('collectionEditModal').classList.remove('active');
  renderCollectionDropdown();
  populateCollectionSelect(parseInt($('itemCollection').value, 10) || null);
  renderHistoryBar();
  // If manage modal is open, refresh it
  if ($('collectionsModal').classList.contains('active')) renderCollectionsManageModal();
});

$('collectionEditCancel').addEventListener('click', () => $('collectionEditModal').classList.remove('active'));
$('collectionEditName').addEventListener('keydown', e => { if (e.key === 'Enter') $('collectionEditSave').click(); });

// ── COLLECTION SELECT IN DETAILS TAB ──
$('itemCollection').addEventListener('change', () => {
  if (_applyingState) return;
  setDirty(true);
  syncCard();
});

// ── TYPE FILTER ──
document.querySelectorAll('.type-filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if (btn.classList.contains('type-filter-disabled')) return;
    document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    _activeTypeFilter = btn.dataset.type;
    renderHistoryBar();
  });
});

// Dropdown toggle
$('historyDropdownBtn').addEventListener('click', e => {
  e.stopPropagation();
  $('collectionDropdown').classList.remove('open');
  $('historyDropdown').classList.toggle('open');
});

$('historyDropdownNew').addEventListener('click', () => {
  $('historyDropdown').classList.remove('open');
  openNewCard();
});

// Duplicate the current card into a new, untracked card named "… - Copy".
function duplicateCurrentCard() {
  // Save current card first if it is tracked, so the original keeps its edits.
  if (activeHistoryId) {
    const current = collectCurrentState();
    current.id = activeHistoryId;
    const hist = getHistory();
    const idx = hist.findIndex(h => h.id === activeHistoryId);
    if (idx >= 0) { hist[idx] = current; saveHistory(hist); }
  }
  const copy = collectCurrentState();
  copy.name = (copy.name || '').trim() + ' - Copy';
  delete copy.id;
  activeHistoryId = null;
  applyState(copy);
}

// ＋ New → start a fresh blank card directly (no menu).
$('newCardBtn').addEventListener('click', e => {
  e.stopPropagation();
  $('collectionDropdown').classList.remove('open');
  $('historyDropdown').classList.remove('open');
  openNewCard();
});

// ⧉ → duplicate the current card.
$('duplicateCardBtn').addEventListener('click', e => {
  e.stopPropagation();
  duplicateCurrentCard();
});

// Center-strip new-card / duplicate (desktop primary surface, mirrors the bar buttons).
{
  const newC = $('newCardBtnCenter');
  const dupC = $('duplicateCardBtnCenter');
  if (newC) newC.addEventListener('click', () => openNewCard());
  if (dupC) dupC.addEventListener('click', () => duplicateCurrentCard());
}

// Left-rail buttons: ＋ New (collection), ⚙ Settings.
// (Card picking for export now lives in the Export & Share sheet's checklist.)
{
  const newCol = $('railNewCollection');
  if (newCol) newCol.addEventListener('click', () => openCollectionEditModal(null));
  const railSettings = $('railSettingsBtn');
  if (railSettings) railSettings.addEventListener('click', () => {
    if (window.openSettingsPage) window.openSettingsPage();
  });
  const mobileSettings = $('mobileSettingsBtn');
  if (mobileSettings) mobileSettings.addEventListener('click', () => {
    if (window.openSettingsPage) window.openSettingsPage();
  });
}

// Card action dock (under the preview) — proxies to the existing single-card actions.
// Save/PNG/Print buttons still exist (hidden) in the edit panel / former Share tab;
// Share opens the unified Export & Share sheet.
{
  const proxy = (dockId, targetId) => {
    const d = $(dockId), t = $(targetId);
    if (d && t) d.addEventListener('click', () => t.click());
  };
  proxy('dockSaveBtn',  'historySaveBtn');
  proxy('dockPngBtn',   'exportPng');
  proxy('dockPrintBtn', 'exportPrint');
  proxy('dockShareBtn', 'exportShareBtn');
  // Settings → Backup (JSON): reuse the former Share-tab handlers.
  proxy('settingsExportJson', 'exportJsonBtn');
  proxy('settingsImportJson', 'importJsonBtn');
}

// Top-bar cloud avatar → open Settings on the Cloud & sharing group.
{
  const cloud = $('cloudAvatar');
  if (cloud) cloud.addEventListener('click', () => {
    if (window.openSettingsPage) window.openSettingsPage();
    const sec = document.getElementById('settingsCloudSection');
    if (sec) {
      // Expand the Share Provider section (if collapsed) and scroll it into view.
      if (sec.classList.contains('collapsed')) sec.querySelector('.section-title').click();
      requestAnimationFrame(() => sec.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    }
  });
}

document.addEventListener('click', e => {
  $('historyDropdown').classList.remove('open');
  $('collectionDropdown').classList.remove('open');
  const wrap = document.querySelector('.history-search-wrap');
  if (wrap && !wrap.contains(e.target)) {
    $('historySearchResults').classList.remove('open');
  }

});

