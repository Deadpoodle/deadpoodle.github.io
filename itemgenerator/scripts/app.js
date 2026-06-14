// app.js - theme toggle, clear card, default type images, clear-all, autosave, tabs, settings page, collapsible sections, hints, collections — part of split script.js; see index.html for load order
// ── THEME TOGGLE ──
function applyTheme(light) {
  document.body.classList.toggle('light', light);
  const _ti = $('themeToggle').querySelector('.theme-icon');
  const _tl = $('themeToggle').querySelector('.theme-label');
  if (_ti) _ti.textContent = light ? '☽' : '☀';
  if (_tl) _tl.textContent = light ? ' Dark' : ' Light';
  $('themeSettingsCheck').checked = light;
  $('themeSettingsLabel').textContent = light ? 'Dark mode' : 'Light mode';
  localStorage.setItem('dnd_theme', light ? 'light' : 'dark');
}
$('themeToggle').addEventListener('click', () => applyTheme(!document.body.classList.contains('light')));
$('themeSettingsCheck').addEventListener('change', e => applyTheme(e.target.checked));
applyTheme(localStorage.getItem('dnd_theme') === 'light');

// ── CLEAR CARD ──
const BLANK_STATE = {
  name: '', type: 'Weapon', subtype: '', rarity: 'common',
  bonus: '', damage: '', weight: '',
  bonusLabel: 'Bonus', damageLabel: 'Damage', weightLabel: 'Weight',
  savingThrow: '', range: '', saveLabel: 'Save', rangeLabel: 'Range',
  description: '',
  attunement: '', attunementCustom: '',
  cardColor: '#d4b87a', inkColor: '#2c1a0e',
  rarityColor: null, circleSize: 110, circleBorderColor: null, bgOpacity: 1,
  fontScale: 1, descFontScale: 1, headingFont: 'Cinzel', bodyFont: 'Crimson Pro',
  showImage: true, showStats: true, showCollection: false, showFrame: true, squareCorners: false,
  bgImage: null, itemImage: null,
  imageOffsetX: 0, imageOffsetY: 0, imageScale: 1,
  imgNaturalW: 0, imgNaturalH: 0,
  collectionId: null,
};

function getNewCardState() {
  const state = { ...BLANK_STATE };
  const defType   = localStorage.getItem('dnd_default_type');
  const defRarity = localStorage.getItem('dnd_default_rarity');
  if (defType)   state.type   = defType;
  if (defRarity) state.rarity = defRarity;
  return state;
}

function openNewCard() {
  // Save current card to history only if it is already tracked (has an id in history)
  if (activeHistoryId) {
    const current = collectCurrentState();
    current.id = activeHistoryId;
    const hist = getHistory();
    const idx = hist.findIndex(h => h.id === activeHistoryId);
    if (idx >= 0) {
      hist[idx] = current;
      saveHistory(hist);
    }
  }
  // Must be null BEFORE applyState so the registerNewCard() that fires inside
  // setDirty → syncCard registers exactly one card, not two.
  activeHistoryId = null;
  applyState(getNewCardState());
}

$('clearCardBtn').addEventListener('click', async () => {
  if (_undoBaseline) {
    if (!await showGenericConfirm('Undo Changes', 'Discard unsaved changes and reload this card from when you last opened or saved it?', 'Undo Changes')) return;
    applyState(_undoBaseline);
    return;
  }
  if (!await showGenericConfirm('Clear Card', 'Clear the current card? All fields will be reset to blank.', 'Clear')) return;
  applyState(getNewCardState());
  activeHistoryId = null;
  updateHistoryActiveClass();
});

// ── DEFAULT TYPE IMAGES ──
function getTypeDefaultSrc(type) {
  if (!type || type === 'Other') return null;
  return 'img/defaults/' + type.toLowerCase().replace(/\s+/g, '_') + '.svg';
}

function updateDefaultTypeImage() {
  const toggle  = $('defaultTypeImgToggle');
  const img     = $('cardItemImg');
  const ph      = $('imgPlaceholder');
  const enabled = toggle && toggle.checked;
  const hasUpload = itemImgNaturalW > 0;

  if (!enabled || hasUpload) {
    if (img.dataset.isDefault === 'true') {
      img.src = '';
      img.style.display = 'none';
      img.style.width = img.style.height = img.style.left = img.style.top = img.style.objectFit = '';
      img.removeAttribute('data-is-default');
      ph.style.display = 'block';
    }
    return;
  }

  const src = getTypeDefaultSrc($('itemType').value);
  if (!src) {
    if (img.dataset.isDefault === 'true') {
      img.src = '';
      img.style.display = 'none';
      img.removeAttribute('data-is-default');
      ph.style.display = 'block';
    }
    return;
  }

  const C    = parseInt($('circleSize').value) || 110;
  const size = Math.round(C * 0.78);
  const off  = Math.round((C - size) / 2);

  // Always update size/position so circle resize is reflected immediately
  img.dataset.isDefault = 'true';
  img.style.position  = 'absolute';
  img.style.width     = size + 'px';
  img.style.height    = size + 'px';
  img.style.left      = off  + 'px';
  img.style.top       = off  + 'px';
  img.style.transform = '';
  img.style.objectFit = 'contain';

  const fullSrc = new URL(src, location.href).href;
  if (img.src !== fullSrc) {
    img.onerror = () => {
      img.style.display = 'none';
      img.removeAttribute('data-is-default');
      ph.style.display = 'block';
    };
    img.onload = () => {
      img.style.display = 'block';
      ph.style.display  = 'none';
    };
    img.src = src;
  } else {
    img.style.display = 'block';
    ph.style.display  = 'none';
  }
}

// ── CLEAR ALL DATA ──
function doClearAllData() {
  $('clearAllDataModal').classList.add('active');
}
$('clearAllDataConfirm').addEventListener('click', () => {
  $('clearAllDataModal').classList.remove('active');
  localStorage.clear();

  // Reset card preview — sentinel prevents ghost card registration
  activeHistoryId = -1;
  applyState({ ...DEFAULT_STATE });
  activeHistoryId = null;
  renderHistoryBar();

  // Reset all Settings UI controls to their defaults
  // Theme → dark
  applyTheme(false);

  // Preferences
  $('suppressConfirmToggle').checked = false;
  $('persistScaleToggle').checked = true;
  $('compressImagesToggle').checked = false;
  const levelRow = $('compressLevelRow');
  levelRow.style.setProperty('--compress-opt-opacity', '0.4');
  levelRow.style.setProperty('--compress-opt-events', 'none');
  const bgStd = document.querySelector('input[name="compressBgLevel"][value="standard"]');
  if (bgStd) bgStd.checked = true;
  const itemStd = document.querySelector('input[name="compressItemLevel"][value="standard"]');
  if (itemStd) itemStd.checked = true;

  // Card scale → 100%
  $('scaleSlider').value = 100;
  applyCardScale(100);

  // Max history slider → 9, locked
  window._resetMaxHistory();

  // Defaults
  $('defaultTypeImgToggle').checked = false;
  $('defaultType').value = '';
  $('defaultRarity').value = '';

  // Export quality → standard (all groups)
  syncAllQualityUI('standard');

  // Share provider → disconnect
  clearShareConnection();
});
$('clearAllDataCancel').addEventListener('click', () => {
  $('clearAllDataModal').classList.remove('active');
});
$('clearAllDataBtnSettings').addEventListener('click', doClearAllData);

// ── AUTO-SAVE ──
let autoSaveTimer = null;

function doAutoSave() {
  if (!isDirty || !activeHistoryId) return;
  clearTimeout(autoSaveTimer);
  updateSaveChip('saving');
  const state = collectCurrentState();
  state.id = activeHistoryId;
  const hist = getHistory();
  const idx = hist.findIndex(h => h.id === activeHistoryId);
  if (idx >= 0) hist[idx] = state;
  else hist.unshift(state);
  saveHistory(hist);
  renderCollectionDropdown();
  renderHistoryBar();
  setDirty(false);
}

// Always-on auto-save: fires 800 ms after the last edit. The chip is the only save indicator.
function scheduleAutoSave() {
  if (!activeHistoryId) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(doAutoSave, 800);
}

// ── TABS ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  if (btn.id === 'openSettingsBtn') return; // settings opens a full-page overlay, not a tab panel
  btn.addEventListener('click', () => {
    doAutoSave();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-' + btn.dataset.tab).classList.add('active');
  });
});

// Refresh the Storage-group usage indicator (card count · MB used · backend).
async function updateStorageIndicator() {
  const label   = $('storageUsedLabel');
  const backend = $('storageBackend');
  const fill    = $('storageBarFill');
  const note    = $('storageUsedNote');
  // Left-rail mirror
  const railLine    = $('railStorageLine');
  const railFill    = $('railStorageFill');
  const railBackend = $('railStorageBackend');
  if (!label && !railLine) return;

  const n   = getHistory().length;
  const max = getMaxHistory();
  const backendStr = _idbReady ? 'INDEXEDDB' : 'LOCALSTORAGE';
  if (backend) backend.textContent = backendStr;
  if (railBackend) railBackend.textContent = backendStr;

  let usageStr = '', pct = 0, noteStr = '';
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const { usage, quota } = await navigator.storage.estimate();
      if (usage != null) usageStr = `${(usage / (1024 * 1024)).toFixed(1)} MB`;
      if (quota) pct = Math.min(100, Math.round((usage / quota) * 100));
      noteStr = pct > 0 ? `${pct}% used${pct < 60 ? ' — plenty of room' : ''}` : '';
    } catch { /* estimate unsupported */ }
  }
  const lineStr = `${n} of ${max} cards${usageStr ? ' · ' + usageStr : ''}`;
  if (label) label.textContent = lineStr;
  if (fill) fill.style.width = pct + '%';
  if (note) note.textContent = noteStr;
  if (railLine) railLine.textContent = lineStr;
  if (railFill) railFill.style.width = pct + '%';
}

// ── SETTINGS PAGE (full-page overlay) ──
(function () {
  const page = $('settingsPage');
  if (!page) return;
  // Lift the overlay out of .workspace (position:relative; z-index:1 traps its stacking
  // context under the top bar) so the fixed full-page overlay sits above everything.
  document.body.appendChild(page);
  function positionPanel() {
    // Constrain the slide-in panel to the left portion of the screen: it covers the
    // left rail + editor and stops at the left edge of the card-preview column. On
    // narrow layouts (the 3-column grid collapses below 861px) fall back to full width.
    const preview = document.querySelector('.preview-area');
    const edge = preview ? preview.getBoundingClientRect().left : 0;
    if (edge > 1 && window.matchMedia('(min-width: 861px)').matches) {
      page.style.width = edge + 'px';
      page.style.right = 'auto';
    } else {
      page.style.width = '';
      page.style.right = '';
    }
  }
  function open() { doAutoSave(); updateStorageIndicator(); positionPanel(); page.classList.add('active'); }
  function close() { page.classList.remove('active'); }
  window.openSettingsPage = open;   // entry point for the left-rail Settings button
  const obtn = $('openSettingsBtn');
  if (obtn) obtn.addEventListener('click', open);
  $('settingsBack').addEventListener('click', close);
  window.addEventListener('resize', () => { if (page.classList.contains('active')) positionPanel(); });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && page.classList.contains('active')) close();
  });
  window._openSettings = open;
  window._closeSettings = close;
})();

// ── COLLAPSIBLE SECTIONS ──
// Turn each section heading inside a panel into a ▾/▸ collapse toggle.
// opts.numbered       → prepend a 01/02/… index (used by the Edit panel).
// opts.defaultCollapsed(label, i) → whether a section starts collapsed.
function initCollapsibleSections(panel, opts = {}) {
  if (!panel) return;
  const { numbered = true, defaultCollapsed = () => false } = opts;
  let n = 0;
  panel.querySelectorAll(':scope > div > .section-title').forEach((title, i) => {
    const section = title.parentElement;
    if (section.hasAttribute('data-no-collapse')) return;   // e.g. About — always open
    n++;
    const label = (title.textContent || '').trim();
    section.classList.add('collapsible');

    if (numbered) {
      const num = document.createElement('span');
      num.className = 'section-num';
      num.textContent = String(n).padStart(2, '0');
      title.prepend(num);
    }

    const tog = document.createElement('span');
    tog.className = 'section-toggle';
    title.appendChild(tog);

    const startCollapsed = defaultCollapsed(label, i);
    section.classList.toggle('collapsed', startCollapsed);
    tog.textContent = startCollapsed ? '▸' : '▾';

    title.setAttribute('role', 'button');
    title.tabIndex = 0;
    const toggle = () => {
      const isCollapsed = section.classList.toggle('collapsed');
      tog.textContent = isCollapsed ? '▸' : '▾';
      title.setAttribute('aria-expanded', String(!isCollapsed));
    };
    title.setAttribute('aria-expanded', String(!startCollapsed));
    title.addEventListener('click', toggle);
    title.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
}
// Edit panel: numbered sections; appearance-oriented ones start collapsed.
initCollapsibleSections($('tab-edit'), {
  defaultCollapsed: label =>
    ['Images', 'Colours', 'Typography', 'Card Elements', 'Reset'].some(name => label.startsWith(name)),
});
// Settings page: one scrolling page. Desktop opens every section by default;
// mobile keeps the first open and the rest collapsed (matches the 860px breakpoint).
initCollapsibleSections($('settingsBody'), {
  numbered: false,
  defaultCollapsed: (label, i) => i > 0 && window.matchMedia('(max-width: 860px)').matches,
});

// ── PROPERTIES FIRST-USE HINT ──
(function initPropHint() {
  const hint = $('propHint');
  const dismiss = $('propHintDismiss');
  if (!hint || !dismiss) return;
  if (localStorage.getItem('dnd_props_hint_seen') === 'true') hint.style.display = 'none';
  dismiss.addEventListener('click', () => {
    hint.style.display = 'none';
    localStorage.setItem('dnd_props_hint_seen', 'true');
  });
})();

// ── UPLOAD HINT (card image circle click → open file picker) ──
$('imgUploadHint').addEventListener('click', () => {
  $('itemImgUpload').click();
});

// ── COLLECTIONS ──
const COLLECTIONS_KEY = 'dnd_collections';

function getCollections() {
  try { return JSON.parse(localStorage.getItem(COLLECTIONS_KEY)) || []; }
  catch { return []; }
}

function saveCollections(cols) {
  localStorage.setItem(COLLECTIONS_KEY, JSON.stringify(cols));
}

function getCollectionById(id) {
  return getCollections().find(c => c.id === id) || null;
}

function createCollection(name, description) {
  const cols = getCollections();
  const col = { id: Date.now(), name: name.trim(), description: (description || '').trim() };
  cols.push(col);
  saveCollections(cols);
  return col;
}

function updateCollection(id, name, description) {
  const cols = getCollections();
  const idx = cols.findIndex(c => c.id === id);
  if (idx < 0) return;
  cols[idx].name = name.trim();
  cols[idx].description = (description || '').trim();
  saveCollections(cols);
}

function deleteCollection(id) {
  // Remove collection and clear collectionId from all cards that referenced it
  saveCollections(getCollections().filter(c => c.id !== id));
  const hist = getHistory().map(h => h.collectionId === id ? { ...h, collectionId: null } : h);
  saveHistory(hist);
  if (_activeCollectionId === id) setActiveCollection(null);
}

