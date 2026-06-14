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
// Settings page: one scrolling page; first section open, the rest collapsed.
initCollapsibleSections($('settingsBody'), {
  numbered: false,
  defaultCollapsed: (label, i) => i > 0,
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

// ── HISTORY + STORAGE ──
// Card metadata lives in localStorage (fast, synchronous); image blobs live in
// IndexedDB when available (window.idbBlobs). getHistory()/saveHistory() operate
// on an in-memory hydrated array (_hist) so the 46 call sites stay unchanged and
// synchronous. Boot waits on window.__storageReady before rendering the history.
const HISTORY_KEY        = 'dnd_item_history';
const HISTORY_BACKUP_KEY = 'dnd_item_history_backup'; // pre-migration safety copy
const STORAGE_FLAG_KEY   = 'dnd_storage_backend';     // 'indexeddb' once migrated
const MAX_HISTORY_DEFAULT = 200;                      // raised from 30 (IndexedDB headroom)
const BLOB_FIELDS = ['bgImage', 'itemImage'];

let _hist = [];           // in-memory hydrated history (full states incl. blobs)
let _idbReady = false;    // true once IndexedDB is the active blob backend
let _idbWriteChain = Promise.resolve();  // serialises async blob writes
let _pendingMigrationToast = null;       // card count to announce after boot

function getMaxHistory() {
  const v = parseInt(localStorage.getItem('dnd_max_history'), 10);
  return (isNaN(v) || v < 1) ? MAX_HISTORY_DEFAULT : v;
}

// Returns a shallow copy of the in-memory history so callers can mutate the array
// (unshift/splice/[idx]=) and saveHistory() it without accidentally persisting an
// unsaved change to _hist. Element objects are shared, matching the prior pattern
// of "mutate an entry, then saveHistory".
function getHistory() { return _hist.slice(); }

// A shallow copy with image blobs removed — what we persist to localStorage.
function _stripBlobs(s) {
  const copy = { ...s };
  BLOB_FIELDS.forEach(f => { copy[f] = null; });
  return copy;
}

function _showStorageFull() {
  showInfoModal('Storage Full',
    'Your browser\'s storage limit has been reached.<br><br>' +
    'Cards with uploaded images use a lot of space. To free up room:<br>' +
    '&bull; Export your items as JSON first (Share tab) to back them up<br>' +
    '&bull; Then delete some cards from history, or clear their images<br><br>' +
    'This save was not completed — your previous history is unchanged.'
  );
}

function saveHistory(items) {
  _hist = items;
  if (_idbReady && window.idbBlobs) {
    // Metadata → localStorage (tiny, sync, reliable); blobs → IndexedDB (async).
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items.map(_stripBlobs))); }
    catch (e) { _showStorageFull(); return; }
    _persistBlobsToIdb(items);
  } else {
    // Fallback: no IndexedDB — keep the legacy behaviour (full states incl. blobs).
    try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); }
    catch (e) { _showStorageFull(); }
  }
}

// Writes each card's blobs to IndexedDB and prunes blobs for deleted cards.
// Serialised through _idbWriteChain so rapid successive saves can't interleave.
function _persistBlobsToIdb(items) {
  _idbWriteChain = _idbWriteChain.then(async () => {
    const liveIds = new Set(items.map(i => String(i.id)));
    for (const it of items) {
      const rec = { bgImage: it.bgImage || null, itemImage: it.itemImage || null };
      if (rec.bgImage || rec.itemImage) await window.idbBlobs.set(it.id, rec);
      else await window.idbBlobs.delete(it.id);
    }
    const keys = await window.idbBlobs.keys();
    for (const k of keys) if (!liveIds.has(k)) await window.idbBlobs.delete(k);
  }).catch(e => console.warn('[storage] IndexedDB blob write failed:', e));
  return _idbWriteChain;
}

// One-shot boot: hydrate _hist from localStorage metadata + IndexedDB blobs,
// migrating legacy inline-blob histories on first run. Never rejects.
async function initStorage() {
  let stored = [];
  try { stored = JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; } catch { stored = []; }
  if (!Array.isArray(stored)) stored = [];

  const idbOk = window.idbBlobs ? await window.idbBlobs.available().catch(() => false) : false;

  // Fallback mode — keep legacy localStorage-blob behaviour, no migration.
  if (!idbOk) { _idbReady = false; _hist = stored; return; }

  const migrated = localStorage.getItem(STORAGE_FLAG_KEY) === 'indexeddb';

  try {
    if (!migrated) {
      // First run with IndexedDB: localStorage may hold inline blobs → migrate.
      const inlineCount = stored.filter(s => s.bgImage || s.itemImage).length;
      if (inlineCount > 0) {
        try { localStorage.setItem(HISTORY_BACKUP_KEY, JSON.stringify(stored)); } catch {}
        for (const s of stored) {
          const rec = { bgImage: s.bgImage || null, itemImage: s.itemImage || null };
          if (rec.bgImage || rec.itemImage) await window.idbBlobs.set(s.id, rec);
        }
        _pendingMigrationToast = inlineCount;
      }
      _hist = stored; // already carries blobs in memory
      _idbReady = true;
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(stored.map(_stripBlobs))); } catch {}
      localStorage.setItem(STORAGE_FLAG_KEY, 'indexeddb');
    } else {
      // Already migrated: localStorage is metadata-only → hydrate blobs from IndexedDB.
      let backup = null;
      try { backup = JSON.parse(localStorage.getItem(HISTORY_BACKUP_KEY)); } catch {}
      const backupById = {};
      if (Array.isArray(backup)) backup.forEach(b => { backupById[String(b.id)] = b; });

      for (const s of stored) {
        let rec = null;
        try { rec = await window.idbBlobs.get(s.id); } catch {}
        if (rec) {
          if (rec.bgImage)   s.bgImage   = rec.bgImage;
          if (rec.itemImage) s.itemImage = rec.itemImage;
        } else if (backupById[String(s.id)]) {
          // Safety net: recover any blob a failed migration left behind.
          const b = backupById[String(s.id)];
          if (b.bgImage)   s.bgImage   = b.bgImage;
          if (b.itemImage) s.itemImage = b.itemImage;
          await window.idbBlobs.set(s.id, { bgImage: s.bgImage || null, itemImage: s.itemImage || null }).catch(() => {});
        }
      }
      _hist = stored;
      _idbReady = true;
      // A clean IndexedDB boot succeeded — the pre-migration backup is no longer needed.
      localStorage.removeItem(HISTORY_BACKUP_KEY);
    }
  } catch (e) {
    console.warn('[storage] initStorage failed, falling back to localStorage:', e);
    _idbReady = false;
    _hist = stored;
  }
}

window.__storageReady = initStorage();

// ── SHARE: TOKEN STORAGE HELPERS (Step 2) ──
function getShareProvider()  { return localStorage.getItem('dnd_share_provider'); }
function getShareToken()     { return localStorage.getItem('dnd_share_token'); }
function setShareConnection(provider, token, refreshToken) {
  localStorage.setItem('dnd_share_provider', provider);
  localStorage.setItem('dnd_share_token', token);
  if (refreshToken) localStorage.setItem('dnd_share_refresh_token', refreshToken);
  else localStorage.removeItem('dnd_share_refresh_token');
  updateShareUI();
}
function clearShareConnection() {
  localStorage.removeItem('dnd_share_provider');
  localStorage.removeItem('dnd_share_token');
  localStorage.removeItem('dnd_share_refresh_token');
  localStorage.removeItem('dnd_gdrive_folder_id');
  updateShareUI();
}

// ── SHARE: UI SYNC ──
const SHARE_PROVIDER_LABELS = {
  dropbox:  { name: 'Dropbox',      icon: '📦' },
  gdrive:   { name: 'Google Drive', icon: '📂' },
};
function updateShareUI() {
  const provider = getShareProvider();
  const connected = !!provider && !!getShareToken();
  // Top-bar cloud avatar reflects connection status.
  const avatar = $('cloudAvatar');
  if (avatar) {
    avatar.classList.toggle('connected', connected);
    avatar.title = connected ? 'Connected · Cloud & sharing' : 'Cloud & sharing';
  }
  const connectedEl  = $('shareProviderConnected');
  const btnsEl       = $('shareProviderBtns');
  const noProviderEl = $('shareNoProviderMsg');
  const hasProviderEl= $('shareHasProviderUI');
  if (!connectedEl) return;

  if (connected) {
    const info = SHARE_PROVIDER_LABELS[provider] || { name: provider, icon: '☁' };
    $('shareProviderIcon').textContent = info.icon;
    $('shareProviderName').textContent = info.name;
    const browseLink = $('shareProviderBrowseLink');
    if (browseLink) {
      if (provider === 'dropbox') {
        browseLink.href = 'https://www.dropbox.com/home/Apps/Artifex%20Arcanum/Artifex%20Arcanum%20Cards';
      } else if (provider === 'gdrive') {
        const folderId = localStorage.getItem('dnd_gdrive_folder_id');
        browseLink.href = folderId
          ? `https://drive.google.com/drive/folders/${folderId}`
          : 'https://drive.google.com/drive/my-drive';
      } else {
        browseLink.href = '#';
      }
    }

    const discoverBtn = $('discoverShareFilesBtn');
    if (discoverBtn) {
      if (provider === 'dropbox') {
        discoverBtn.textContent = '⬇ Import from Dropbox';
      } else if (provider === 'gdrive') {
        discoverBtn.textContent = '⬇ Import from Drive';
      } else {
        discoverBtn.textContent = '🔎 Discover shared JSON';
      }
    }

    connectedEl.style.display  = 'block';
    btnsEl.style.display       = 'none';
    noProviderEl.style.display = 'none';
    hasProviderEl.style.display= 'block';
  } else {
    connectedEl.style.display  = 'none';
    btnsEl.style.display       = 'flex';
    noProviderEl.style.display = 'block';
    hasProviderEl.style.display= 'none';
  }
}

// ── SHARE: collectShareState (Step 3) ──
function collectShareState() {
  const state = collectCurrentState();
  state.sharedAt   = new Date().toISOString();
  state.appVersion = '1.0';
  return state;
}

// ══════════════════════════════════════════════════════
// PHASE 2 — DROPBOX
// ══════════════════════════════════════════════════════

const DROPBOX_APP_KEY    = 'wkyp9ljfobrkt85';
const DROPBOX_REDIRECT   = 'https://www.artifexarcanum.ie/oauth.html';
const DROPBOX_FOLDER     = '/Artifex Arcanum Cards';
// Cloudflare Worker proxy — routes recipient fetches through a non-tracked domain so
// Firefox Enhanced Tracking Protection doesn't block dl.dropboxusercontent.com.
// Deploy the worker from SHARE_UPGRADE.md and replace the placeholder URL below.
const DROPBOX_PROXY      = 'https://artifex-arcanum.joefahey87.workers.dev';

// ── PKCE helpers ──
function _pkceVerifier() {
  const arr = new Uint8Array(32);
  crypto.getRandomValues(arr);
  return btoa(String.fromCharCode(...arr))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function _pkceChallenge(verifier) {
  const data   = new TextEncoder().encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── Dropbox OAuth — PKCE flow via Cloudflare Worker ──
// Dropbox's /oauth2/token endpoint has no CORS headers, so the code exchange is
// proxied through the Worker (POST /dropbox-token). No client secret is needed —
// PKCE uses a code_verifier instead. token_access_type=offline gets a refresh token
// so the user never needs to manually reconnect after the initial authorisation.
async function connectDropbox() {
  const verifier   = _pkceVerifier();
  const challenge  = await _pkceChallenge(verifier);
  sessionStorage.setItem('dnd_oauth_verifier', verifier);

  const params = new URLSearchParams({
    client_id:             DROPBOX_APP_KEY,
    redirect_uri:          DROPBOX_REDIRECT,
    response_type:         'code',
    code_challenge:        challenge,
    code_challenge_method: 'S256',
    token_access_type:     'offline',
  });

  const popup = window.open(
    'https://www.dropbox.com/oauth2/authorize?' + params,
    'dropbox_auth', 'width=600,height=720,left=200,top=100'
  );
  if (!popup) {
    showInfoModal('Popup Blocked', 'Please allow pop-ups for this page and try again.');
    sessionStorage.removeItem('dnd_oauth_verifier');
    return;
  }

  try {
    await new Promise((resolve, reject) => {
      let done = false;
      function onMsg(e) {
        if (e.origin !== window.location.origin || !e.data || e.data.type !== 'oauth_callback') return;
        window.removeEventListener('message', onMsg);
        clearInterval(poll);
        done = true;
        const { code, error } = e.data.payload;
        if (error) { reject(new Error(error)); return; }
        if (!code)  { reject(new Error('no_code')); return; }

        const storedVerifier = sessionStorage.getItem('dnd_oauth_verifier');
        sessionStorage.removeItem('dnd_oauth_verifier');

        const body = new URLSearchParams({
          grant_type:    'authorization_code',
          code,
          code_verifier: storedVerifier,
          client_id:     DROPBOX_APP_KEY,
          redirect_uri:  DROPBOX_REDIRECT,
        });

        fetch(`${DROPBOX_PROXY}/dropbox-token`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    body.toString(),
        })
          .then(r => r.json())
          .then(data => {
            if (data.error || !data.access_token) {
              reject(new Error(data.error || 'no_token'));
              return;
            }
            console.log('[dropbox] PKCE exchange succeeded. refresh_token present:', !!data.refresh_token);
            setShareConnection('dropbox', data.access_token, data.refresh_token || null);
            resolve();
          })
          .catch(reject);
      }
      window.addEventListener('message', onMsg);
      const poll = setInterval(() => {
        if (!done && popup.closed) {
          clearInterval(poll);
          setTimeout(() => {
            if (!done) {
              window.removeEventListener('message', onMsg);
              reject(new Error('closed'));
            }
          }, 800);
        }
      }, 500);
    });
    updateShareUI();
  } catch (err) {
    sessionStorage.removeItem('dnd_oauth_verifier');
    if (err.message !== 'closed') {
      showInfoModal('Connection Failed', 'Could not connect to Dropbox — please try again.');
      console.error('[dropbox] connect error:', err);
    }
  }
}

// ── Dropbox silent token refresh ──
// Uses the stored refresh_token to get a new access_token via the Worker.
// Returns true on success (new token stored), false if refresh is unavailable or fails.
async function _refreshDropboxToken() {
  const refreshToken = localStorage.getItem('dnd_share_refresh_token');
  if (!refreshToken) return false;
  try {
    const body = new URLSearchParams({
      grant_type:    'refresh_token',
      refresh_token: refreshToken,
      client_id:     DROPBOX_APP_KEY,
    });
    const resp = await fetch(`${DROPBOX_PROXY}/dropbox-token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    body.toString(),
    });
    const data = await resp.json();
    if (data.error || !data.access_token) return false;
    localStorage.setItem('dnd_share_token', data.access_token);
    console.log('[dropbox] access token silently refreshed.');
    return true;
  } catch {
    return false;
  }
}

// ── Dropbox fetch wrapper — auto-refreshes on 401, then prompts reconnect ──
async function _dbx(url, options) {
  const proxyUrl = `${DROPBOX_PROXY}?url=${encodeURIComponent(url)}`;
  const doFetch = token => fetch(proxyUrl, {
    ...options,
    headers: { ...options.headers, Authorization: 'Bearer ' + token },
  });

  let resp = await doFetch(getShareToken());

  if (resp.status === 401) {
    const refreshed = await _refreshDropboxToken();
    if (refreshed) {
      resp = await doFetch(getShareToken());
      if (resp.status !== 401) return resp;
    }
    clearShareConnection();
    showInfoModal('Dropbox Disconnected', 'Your Dropbox session has expired or been revoked. Please reconnect in Settings → Share Provider.');
    throw new Error('auth_expired');
  }

  return resp;
}

// Pure utility functions (SHARE_CACHE_KEY, _getShareCache, _setShareCache,
// _stableStringify, _cardFingerprint, _deduplicateCards, ATTUNE_PREFIXES,
// ATTUNE_KNOWN_MODES, _resolveAttunement, _shareContentHash) are defined in utils.js,
// which is loaded before this file.

// ══════════════════════════════════════════════════════
// PHASE 3 — GOOGLE DRIVE
// ══════════════════════════════════════════════════════

const GDRIVE_CLIENT_ID = '33952755898-n2ce7raec9995di0s0coplgrbn4d3g49.apps.googleusercontent.com';
const GDRIVE_REDIRECT  = 'https://www.artifexarcanum.ie/oauth.html';
const GDRIVE_SCOPE     = 'https://www.googleapis.com/auth/drive.file';
const GDRIVE_PROXY     = 'https://artifex-arcanum.joefahey87.workers.dev';

// ── Google Drive OAuth — authorization code + PKCE flow ──
// Switched from implicit flow: PKCE + access_type=offline + prompt=consent
// ensures a refresh token is issued. The client_secret is injected server-side
// by the Cloudflare Worker's POST /google-token route.
async function connectGoogleDrive() {
  const verifier  = _pkceVerifier();
  const challenge = await _pkceChallenge(verifier);
  sessionStorage.setItem('dnd_gdrive_oauth_verifier', verifier);

  const params = new URLSearchParams({
    client_id:             GDRIVE_CLIENT_ID,
    redirect_uri:          GDRIVE_REDIRECT,
    response_type:         'code',
    scope:                 GDRIVE_SCOPE,
    access_type:           'offline',
    prompt:                'consent',
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  });

  const popup = window.open(
    'https://accounts.google.com/o/oauth2/v2/auth?' + params,
    'gdrive_auth', 'width=600,height=720,left=200,top=100'
  );
  if (!popup) {
    showInfoModal('Popup Blocked', 'Please allow pop-ups for this page and try again.');
    sessionStorage.removeItem('dnd_gdrive_oauth_verifier');
    return;
  }

  try {
    await new Promise((resolve, reject) => {
      let done = false;
      function onMsg(e) {
        if (e.origin !== window.location.origin || !e.data || e.data.type !== 'oauth_callback') return;
        window.removeEventListener('message', onMsg);
        clearInterval(poll);
        done = true;
        const { code, error } = e.data.payload;
        if (error)  { reject(new Error(error));    return; }
        if (!code)  { reject(new Error('no_code')); return; }

        const storedVerifier = sessionStorage.getItem('dnd_gdrive_oauth_verifier');
        sessionStorage.removeItem('dnd_gdrive_oauth_verifier');

        fetch(`${GDRIVE_PROXY}/google-token`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    new URLSearchParams({
            grant_type:    'authorization_code',
            code,
            code_verifier: storedVerifier,
            client_id:     GDRIVE_CLIENT_ID,
            redirect_uri:  GDRIVE_REDIRECT,
          }).toString(),
        })
          .then(r => r.json())
          .then(data => {
            if (data.error || !data.access_token) {
              reject(new Error(data.error || 'no_token'));
              return;
            }
            setShareConnection('gdrive', data.access_token, data.refresh_token || null);
            resolve();
          })
          .catch(reject);
      }
      window.addEventListener('message', onMsg);
      const poll = setInterval(() => {
        if (!done && popup.closed) {
          clearInterval(poll);
          setTimeout(() => {
            if (!done) {
              window.removeEventListener('message', onMsg);
              reject(new Error('closed'));
            }
          }, 800);
        }
      }, 500);
    });
    updateShareUI();
  } catch (err) {
    sessionStorage.removeItem('dnd_gdrive_oauth_verifier');
    if (err.message !== 'closed') {
      showInfoModal('Connection Failed', 'Could not connect to Google Drive — please try again.');
      console.error('[gdrive] connect error:', err);
    }
  }
}

async function _refreshGoogleToken() {
  const refreshToken = localStorage.getItem('dnd_share_refresh_token');
  if (!refreshToken) return false;
  try {
    const resp = await fetch(`${GDRIVE_PROXY}/google-token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
        client_id:     GDRIVE_CLIENT_ID,
      }).toString(),
    });
    const data = await resp.json();
    if (data.error || !data.access_token) return false;
    localStorage.setItem('dnd_share_token', data.access_token);
    return true;
  } catch {
    return false;
  }
}

// ── Google Drive fetch wrapper — auto-refreshes on 401, then prompts reconnect ──
async function _gdrive(url, options) {
  const proxyUrl = `${GDRIVE_PROXY}?url=${encodeURIComponent(url)}`;
  const doFetch = token => fetch(proxyUrl, {
    ...options,
    headers: { ...options.headers, Authorization: 'Bearer ' + token },
  });

  let resp = await doFetch(getShareToken());

  if (resp.status === 401) {
    const refreshed = await _refreshGoogleToken();
    if (refreshed) {
      resp = await doFetch(getShareToken());
      if (resp.status !== 401) return resp;
    }
    clearShareConnection();
    showInfoModal('Google Drive Disconnected', 'Your Google Drive session has expired or been revoked. Please reconnect in Settings → Share Provider.');
    throw new Error('auth_expired');
  }

  return resp;
}

// ── Google Drive folder helper ──
// Finds the "Artifex Arcanum" folder in the user's Drive, creating it if absent.
// Caches the folder ID in localStorage so only one API call is made per session.
async function _gdriveGetOrCreateFolder() {
  const cached = localStorage.getItem('dnd_gdrive_folder_id');
  if (cached) return cached;

  const q = encodeURIComponent(`name='Artifex Arcanum' and mimeType='application/vnd.google-apps.folder' and trashed=false`);
  const searchResp = await _gdrive(`https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id)`, { method: 'GET', headers: {} });
  if (searchResp.ok) {
    const data = await searchResp.json();
    if (data.files && data.files.length > 0) {
      localStorage.setItem('dnd_gdrive_folder_id', data.files[0].id);
      return data.files[0].id;
    }
  }

  const createResp = await _gdrive('https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'Artifex Arcanum', mimeType: 'application/vnd.google-apps.folder' }),
  });
  if (!createResp.ok) throw new Error('folder_create_failed');
  const folder = await createResp.json();
  localStorage.setItem('dnd_gdrive_folder_id', folder.id);
  return folder.id;
}

// ── Google Drive upload + share (Step 14) ──
function _buildSharePayload(states) {
  const now = new Date().toISOString();
  return {
    version: 2,
    collections: collectionsForCards(states),
    cards: states.map(s => ({ ...s, sharedAt: now, appVersion: '1.0' })),
  };
}

async function _shareGDrive(states, hash) {
  const payload  = _buildSharePayload(states);
  const json     = JSON.stringify(payload);
  const slugBase = states.length === 1
    ? (states[0].name || 'card').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
    : `selection-${states.length}-cards`;
  const filename = `artifex-arcanum-${slugBase}-${Date.now()}.json`;

  const folderId = await _gdriveGetOrCreateFolder().catch(() => null);

  // Multipart upload: metadata + file body in one request
  const boundary = 'aa_b_' + Math.random().toString(36).slice(2);
  const meta     = JSON.stringify({ name: filename, mimeType: 'application/json', ...(folderId ? { parents: [folderId] } : {}) });
  const body     = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${meta}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${json}\r\n--${boundary}--`;

  const upResp = await _gdrive(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id',
    { method: 'POST', headers: { 'Content-Type': `multipart/related; boundary=${boundary}` }, body }
  ).catch(err => { console.error('[gdrive] upload fetch error:', err); throw new Error('network_error'); });

  if (!upResp.ok) {
    const errBody = await upResp.json().catch(() => ({}));
    throw new Error('upload_failed: ' + (errBody.error?.message || upResp.status));
  }
  const { id: fileId } = await upResp.json();

  // Set permission: anyone with the link can read
  const permResp = await _gdrive(
    `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ role: 'reader', type: 'anyone' }) }
  ).catch(err => { console.error('[gdrive] permission fetch error:', err); throw new Error('network_error'); });

  if (!permResp.ok) throw new Error('permission_failed: ' + permResp.status + '. permissionsResponse: ' + JSON.stringify(await permResp.json().catch(() => ({}))));

  const shareUrl = `${location.origin}${location.pathname}#share=gdrive:${fileId}`;
  _setShareCache(hash, shareUrl);
  return shareUrl;
}

// ── shareCurrentCard ───────────────────────────────────────────────────────────
// states: array of card state objects (from history). Each will have sharedAt / appVersion
// added. Always uploaded as a JSON array so the recipient handles single or multi uniformly.
async function shareCurrentCard(states) {
  const provider = getShareProvider();
  if (!provider || !getShareToken()) {
    showInfoModal('Not Connected', 'Connect a cloud provider in Settings → Share Provider first.');
    return null;
  }

  // ── Deduplication check ──
  // Hash the content before adding volatile fields. If we've already uploaded this
  // exact selection, return the cached URL without touching Dropbox at all.
  const hash   = await _shareContentHash(states);
  const cached = _getShareCache()[hash];
  if (cached) {
    console.log('[share] cache hit — skipping upload');
    return cached;
  }

  if (provider === 'gdrive') return _shareGDrive(states, hash);

  // ── Dropbox ──
  if (provider !== 'dropbox') {
    showInfoModal('Not Connected', 'Connect a cloud provider in Settings → Share Provider first.');
    return null;
  }

  const payload = _buildSharePayload(states);
  const json    = JSON.stringify(payload);

  // Build a descriptive filename
  const slugBase = states.length === 1
    ? (states[0].name || 'card').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40)
    : `selection-${states.length}-cards`;
  const filename = `artifex-arcanum-${slugBase}-${Date.now()}.json`;
  const path     = `${DROPBOX_FOLDER}/${filename}`;

  // 1 — Upload file
  const upResp = await _dbx('https://content.dropboxapi.com/2/files/upload', {
    method:  'POST',
    headers: {
      'Content-Type':    'application/octet-stream',
      'Dropbox-API-Arg': JSON.stringify({ path, mode: 'overwrite', autorename: false, mute: true }),
    },
    body: json,
  }).catch(err => {
    console.error('[share] upload fetch error:', err);
    throw new Error('network_error');
  });
  if (!upResp.ok) {
    const err = await upResp.json().catch(() => ({}));
    throw new Error('upload_failed: ' + (err.error_summary || upResp.status));
  }

  // 2 — Create shared link (handle "already exists" gracefully)
  const linkResp = await _dbx('https://api.dropboxapi.com/2/sharing/create_shared_link_with_settings', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ path, settings: { requested_visibility: 'public' } }),
  }).catch(err => {
    console.error('[share] create_shared_link fetch error:', err);
    throw new Error('network_error');
  });

  let sharedUrl;
  if (linkResp.status === 409) {
    const body = await linkResp.json();
    if (body.error && body.error['.tag'] === 'shared_link_already_exists') {
      sharedUrl = body.error.metadata.url;
    } else {
      throw new Error('share_link_error: ' + JSON.stringify(body));
    }
  } else if (!linkResp.ok) {
    throw new Error('share_link_failed: ' + linkResp.status);
  } else {
    sharedUrl = (await linkResp.json()).url;
  }

  // 3 — Convert to a CORS-friendly direct download URL.
  // Dropbox's new /scl/fi/ links are served from www.dropbox.com which returns a 302
  // redirect without CORS headers. Swapping the host to dl.dropboxusercontent.com skips
  // the redirect and serves the raw file with Access-Control-Allow-Origin: *.
  // The rlkey parameter (if present) must be preserved — it authenticates the link.
  // Remove any dl=0 param (redundant on the content domain) but do not add dl=1
  // since dl.dropboxusercontent.com always serves raw content.
  const directUrl = sharedUrl
    .replace('www.dropbox.com', 'dl.dropboxusercontent.com')
    .replace(/[?&]dl=0/, '')
    .replace(/[?&]dl=1/, '')
    .replace(/\?$/, '')
    .replace(/&$/, '');

  // 4 — Build and return full share URL, caching it against the content hash
  const shareUrl = `${location.origin}${location.pathname}#share=dropbox:${encodeURIComponent(directUrl)}`;
  _setShareCache(hash, shareUrl);
  return shareUrl;
}

// ── fetchSharedCard — recipient download (Step 10) ──
async function fetchSharedCard(provider, id) {
  if (provider === 'dropbox') {
    const directUrl = decodeURIComponent(id);
    // Route through the Cloudflare Worker proxy so Firefox Enhanced Tracking Protection
    // doesn't block the direct fetch to dl.dropboxusercontent.com (classified as a tracker).
    // Falls back to a direct fetch if the proxy constant hasn't been configured yet.
    let fetchUrl = directUrl;
    if (DROPBOX_PROXY && !DROPBOX_PROXY.includes('YOUR-WORKER')) {
      fetchUrl = `${DROPBOX_PROXY}?url=${encodeURIComponent(directUrl)}`;
    }
    const resp = await fetch(fetchUrl);
    if (resp.status === 404) throw new Error('not_found');
    if (!resp.ok) throw new Error('fetch_' + resp.status);
    try { return await resp.json(); } catch { throw new Error('not_found'); }
  }
  if (provider === 'gdrive') {
    const downloadUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download`;
    // Route through the Cloudflare Worker proxy — drive.usercontent.google.com returns no CORS
    // headers, which blocks the fetch in Firefox and Edge. The legacy drive.google.com/uc endpoint
    // now returns 403 for unauthenticated requests.
    let fetchUrl = downloadUrl;
    if (DROPBOX_PROXY && !DROPBOX_PROXY.includes('YOUR-WORKER')) {
      fetchUrl = `${DROPBOX_PROXY}?url=${encodeURIComponent(downloadUrl)}`;
    }
    const resp = await fetch(fetchUrl);
    if (resp.status === 404) throw new Error('not_found');
    if (!resp.ok) throw new Error('fetch_' + resp.status);
    try { return await resp.json(); } catch { throw new Error('not_found'); }
  }
  // Other providers added in later phases
  return null;
}

function collectCurrentState() {
  return {
    id: Date.now(),
    name:        $('itemName').value,
    type:        $('itemType').value,
    subtype:     $('itemSubtype').value,
    rarity:      $('itemRarity').value,
    bonus:       $('itemBonus').value,
    damage:      $('itemDamage').value,
    weight:      $('itemWeight').value,
    bonusLabel:  $('bonusLabel').value  || 'Bonus',
    damageLabel: $('damageLabel').value || 'Damage',
    weightLabel: $('weightLabel').value || 'Weight',
    savingThrow: $('itemSave').value,
    range:       $('itemRange').value,
    saveLabel:   $('saveLabel').value   || 'Save',
    rangeLabel:  $('rangeLabel').value  || 'Range',
    showCollection: $('showCollection').checked,
    description: $('itemDescription').value,
    attunement:  $('itemAttunement').value,
    attunementCustom: $('attunementCustom').value,
    cardColor:   $('cardColorHex').value,
    inkColor:    $('inkColorHex').value,
    rarityColor: $('rarityColorHex').value || null,
    circleSize:  parseInt($('circleSize').value) || 110,
    circleBorderColor: $('circleBorderColorHex').value || null,
    bgOpacity:   parseFloat($('bgOpacity').value) ?? 1,
    fontScale:     parseFloat($('fontScale').value)     || 1,
    descFontScale: parseFloat($('descFontScale').value) || 1,
    headingFont: $('headingFont').value || 'Cinzel',
    bodyFont:    $('bodyFont').value    || 'Crimson Pro',
    showImage:     $('showImage').checked,
    showStats:     $('showStats').checked,
    showFrame:     $('showFrame').checked,
    squareCorners: $('squareCorners').checked,
    allowOversized: $('allowOversized').checked,
    bgImage:     $('cardBgImg').style.backgroundImage
                   ? $('cardBgImg').style.backgroundImage.replace(/^url\(['"]?/, '').replace(/['"]?\)$/, '')
                   : null,
    itemImage:   $('cardItemImg').src && $('cardItemImg').style.display !== 'none'
                   ? $('cardItemImg').src
                   : null,
    imageOffsetX: itemImgX,
    imageOffsetY: itemImgY,
    imageScale:   itemImgScale,
    imgNaturalW:  itemImgNaturalW,
    imgNaturalH:  itemImgNaturalH,
    collectionId: $('itemCollection').value ? parseInt($('itemCollection').value, 10) : null,
  };
}

let activeHistoryId = null;
let isDirty = false;
let _applyingState = false;
let _undoBaseline = null; // snapshot of state at load time, never touched by autosave
let _activeCollectionId = null;
let _activeTypeFilter = 'all';

function setActiveCollection(id) {
  _activeCollectionId = id;
  const label = $('collectionDropdownLabel');
  if (!label) return;
  if (id === null) {
    label.textContent = 'Collections';
  } else {
    const col = getCollectionById(id);
    label.textContent = col ? col.name : 'Collections';
  }
  renderCollectionDropdown();
  renderHistoryBar();
}

function registerNewCard() {
  if (activeHistoryId !== null) return;
  activeHistoryId = Date.now();
  const state = collectCurrentState();
  state.id = activeHistoryId;
  const hist = getHistory();
  hist.unshift(state);
  saveHistory(hist.slice(0, getMaxHistory()));
  renderHistoryBar();
}

function setDirty(val) {
  isDirty = val;
  if (val && activeHistoryId === null) registerNewCard();
  updateSaveChip(val ? 'unsaved' : 'saved');
  updateHistoryActiveClass();
  if (val) scheduleAutoSave();
}

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

// ── HISTORY SEARCH ──
$('historySearch').addEventListener('input', e => _applyHistorySearch(e.target.value));
$('historySearch').addEventListener('keydown', e => { if (e.key === 'Escape') _applyHistorySearch(''); });
$('historySearchClear').addEventListener('click', () => _applyHistorySearch(''));


$('historySaveBtn').addEventListener('click', () => {
  const state   = collectCurrentState();
  if (activeHistoryId) state.id = activeHistoryId;
  const history = getHistory().filter(h => h.id !== state.id && h.name !== state.name);
  history.unshift(state);
  saveHistory(history.slice(0, getMaxHistory()));
  renderCollectionDropdown();
  renderHistoryBar();
  setDirty(false);
  _undoBaseline = JSON.parse(JSON.stringify(state));

  // Flash feedback
  const btn = $('historySaveBtn');
  btn.classList.add('flash');
  btn.textContent = '✓ Saved';
  setTimeout(() => { btn.classList.remove('flash'); btn.textContent = '＋ Save'; }, 1500);
});

// ── HISTORY BAR SCROLL HELPER ──
// Centres the active history item in the track.
// applyState calls updateHistoryActiveClass() (not renderHistoryBar), so the
// .history-active class is already set by the time a requestAnimationFrame fires.
function scrollHistoryActiveToCenter() {
  const track    = $('historyTrack');
  const activeEl = $('historyItems').querySelector('.history-active');
  if (!track || !activeEl) return;
  const trackRect = track.getBoundingClientRect();
  const elRect    = activeEl.getBoundingClientRect();
  // Convert the element's viewport-relative position into an absolute scroll offset,
  // then subtract half the track width to centre it.
  const elAbsLeft    = track.scrollLeft + (elRect.left - trackRect.left);
  const targetScroll = elAbsLeft + elRect.width / 2 - track.clientWidth / 2;
  track.scrollTo({ left: Math.max(0, targetScroll), behavior: 'smooth' });
}

// ── CARDS STRIP NAVIGATION ──
// The « Prev / Next » buttons were replaced by the scrollable cards strip; navigateHistory
// is kept because the mobile card-swipe gesture (below) drives it.
(function() {
  // Navigate to the adjacent history item with wraparound, then centre it in the track.
  function navigateHistory(dir) {
    const items = getHistory();
    if (items.length < 2) return;
    let idx = items.findIndex(h => h.id === activeHistoryId);
    if (idx === -1) idx = dir === 1 ? -1 : items.length;
    const targetIdx = ((idx + dir) + items.length) % items.length;
    resetFlip();
    tryLoadItem(items[targetIdx]);
    // applyState (called synchronously inside tryLoadItem for the common case) sets
    // .history-active before returning, so one rAF is enough to read layout.
    requestAnimationFrame(scrollHistoryActiveToCenter);
  }

  window._navigateHistory = navigateHistory;
})();

// ── MOBILE SWIPE TO CHANGE CARD ──
(function () {
  const preview   = document.querySelector('.preview-area');
  const hint      = $('swipeHint');
  const hintIcon  = $('swipeHintIcon');
  const hintLabel = $('swipeHintLabel');
  if (!preview || !hint) return;

  let startX = 0, startY = 0, previewRect = null, hintVisible = false, hideTimer = null, ignored = false;

  function showHint(dir) {
    if (getHistory().length < 2 || !previewRect) return;
    clearTimeout(hideTimer);

    hintIcon.textContent = dir < 0 ? '←' : '→';
    hintLabel.innerHTML  = dir < 0 ? 'Swipe for<br>Previous' : 'Swipe for<br>Next';

    // Position the fixed overlay to cover the left or right 30% of the preview pane.
    // Using inline styles avoids any CSS-class-swap flicker.
    const w = Math.round(previewRect.width * 0.30);
    hint.style.top    = previewRect.top + 'px';
    hint.style.height = previewRect.height + 'px';
    hint.style.width  = w + 'px';
    if (dir < 0) {
      hint.style.left  = previewRect.left + 'px';
      hint.style.right = 'auto';
    } else {
      hint.style.right = (window.innerWidth - previewRect.right) + 'px';
      hint.style.left  = 'auto';
    }

    hint.classList.add('visible');
    hintVisible = true;
  }

  function hideHint() {
    hint.classList.remove('visible');
    hintVisible = false;
    clearTimeout(hideTimer);
    // Clear inline position styles after the opacity transition finishes
    hideTimer = setTimeout(() => {
      hint.style.cssText = '';
    }, 200);
  }

  preview.addEventListener('touchstart', e => {
    ignored = e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'BUTTON';
    if (ignored) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    previewRect = preview.getBoundingClientRect();
  }, { passive: true });

  preview.addEventListener('touchmove', e => {
    if (ignored) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dx) > 22 && Math.abs(dx) > Math.abs(dy)) {
      showHint(dx < 0 ? 1 : -1);
    } else if (hintVisible) {
      hideHint();
    }
  }, { passive: true });

  preview.addEventListener('touchend', e => {
    if (ignored) { ignored = false; return; }
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    hideHint();
    if (Math.abs(dx) >= 50 && Math.abs(dx) > Math.abs(dy)) {
      if (window._navigateHistory) window._navigateHistory(dx < 0 ? 1 : -1);
    }
  }, { passive: true });

  preview.addEventListener('touchcancel', () => { ignored = false; hideHint(); }, { passive: true });
})();

// ── DEFAULT TYPE IMAGE PERSISTENCE ──
$('defaultTypeImgToggle').checked = localStorage.getItem('dnd_default_type_img') === 'true';
$('defaultTypeImgToggle').addEventListener('change', e => {
  localStorage.setItem('dnd_default_type_img', e.target.checked);
  updateDefaultTypeImage();
});

// ── SUPPRESS CONFIRMATIONS ──
$('suppressConfirmToggle').checked = localStorage.getItem('dnd_no_confirm') === 'true';
$('suppressConfirmToggle').addEventListener('change', e => localStorage.setItem('dnd_no_confirm', e.target.checked));

// ── COMPRESS IMAGES ──
(function () {
  const toggle = $('compressImagesToggle');
  const levelRow = $('compressLevelRow');

  function applyCompressEnabled(enabled) {
    levelRow.style.setProperty('--compress-opt-opacity', enabled ? '1' : '0.4');
    levelRow.style.setProperty('--compress-opt-events',  enabled ? 'auto' : 'none');
  }

  toggle.checked = localStorage.getItem('dnd_compress_images') === 'true';
  applyCompressEnabled(toggle.checked);
  toggle.addEventListener('change', e => {
    localStorage.setItem('dnd_compress_images', e.target.checked);
    applyCompressEnabled(e.target.checked);
  });

  // Compression level radios — background
  const savedBg = localStorage.getItem('dnd_compress_bg_level') || 'standard';
  const savedBgRadio = document.querySelector(`input[name="compressBgLevel"][value="${savedBg}"]`);
  if (savedBgRadio) savedBgRadio.checked = true;
  document.querySelectorAll('input[name="compressBgLevel"]').forEach(r => {
    r.addEventListener('change', () => { if (r.checked) localStorage.setItem('dnd_compress_bg_level', r.value); });
  });

  // Compression level radios — item image
  const savedItem = localStorage.getItem('dnd_compress_item_level') || 'standard';
  const savedItemRadio = document.querySelector(`input[name="compressItemLevel"][value="${savedItem}"]`);
  if (savedItemRadio) savedItemRadio.checked = true;
  document.querySelectorAll('input[name="compressItemLevel"]').forEach(r => {
    r.addEventListener('change', () => { if (r.checked) localStorage.setItem('dnd_compress_item_level', r.value); });
  });
})();

// ── PERSIST CARD SCALE ──
$('persistScaleToggle').checked = localStorage.getItem('dnd_persist_scale') !== 'false';
$('persistScaleToggle').addEventListener('change', e => {
  localStorage.setItem('dnd_persist_scale', e.target.checked);
  if (!e.target.checked) localStorage.removeItem('dnd_card_scale');
});
if ($('persistScaleToggle').checked) {
  const savedScale = localStorage.getItem('dnd_card_scale');
  if (savedScale) { $('scaleSlider').value = savedScale; applyCardScale(savedScale); }
}

// ── EXPORT QUALITY ──
(function() {
  const saved = localStorage.getItem('dnd_export_quality') || 'standard';
  syncAllQualityUI(saved);
  document.querySelectorAll('input[name="exportQuality"]').forEach(r =>
    r.addEventListener('change', e => {
      localStorage.setItem('dnd_export_quality', e.target.value);
      syncAllQualityUI(e.target.value);
    })
  );
  document.querySelectorAll('input[name="shareQuality"]').forEach(r =>
    r.addEventListener('change', e => {
      localStorage.setItem('dnd_export_quality', e.target.value);
      syncAllQualityUI(e.target.value);
    })
  );
})();

// ── DEFAULT CARD VALUES ──
(function() {
  const savedType   = localStorage.getItem('dnd_default_type');
  const savedRarity = localStorage.getItem('dnd_default_rarity');
  if (savedType)   $('defaultType').value   = savedType;
  if (savedRarity) $('defaultRarity').value = savedRarity;

  $('defaultType').addEventListener('change', e => {
    if (e.target.value) localStorage.setItem('dnd_default_type', e.target.value);
    else localStorage.removeItem('dnd_default_type');
  });
  $('defaultRarity').addEventListener('change', e => {
    if (e.target.value) localStorage.setItem('dnd_default_rarity', e.target.value);
    else localStorage.removeItem('dnd_default_rarity');
  });
})();

// ── MAX HISTORY SETTING ──
(function() {
  const slider       = $('maxHistorySetting');
  const label        = $('maxHistoryValue');
  const sliderRow    = $('maxHistorySliderRow');
  const unlockedRow  = $('maxHistoryUnlockedRow');
  const unlockedInput= $('maxHistoryUnlockedInput');
  const unlockToggle = $('unlockMaxHistory');
  const note         = $('maxHistoryNote');

  const LOCKED_MAX = 200;

  function applyMax(v) {
    localStorage.setItem('dnd_max_history', v);
    const hist = getHistory();
    if (hist.length > v) {
      saveHistory(hist.slice(0, v));
      renderHistoryBar();
    }
  }

  function getPreUnlockValue() {
    const v = parseInt(localStorage.getItem('dnd_max_history_pre_unlock'), 10);
    return (isNaN(v) || v < 1) ? LOCKED_MAX : Math.min(v, LOCKED_MAX);
  }

  function setUnlocked(on) {
    unlockToggle.checked = on;
    $('unlockMaxHistoryLabel').textContent = on ? 'Revert card history' : 'Unlock card history';
    localStorage.setItem('dnd_max_history_unlocked', on ? 'true' : 'false');
    if (on) {
      // Save the current slider value so we can restore it on revert
      localStorage.setItem('dnd_max_history_pre_unlock', slider.value);
      sliderRow.style.display = 'none';
      unlockedRow.style.display = 'block';
      unlockedInput.value = getMaxHistory();
      note.textContent = 'No upper limit. Be careful — very large histories with big images may exceed browser storage.';
    } else {
      sliderRow.style.display = 'block';
      unlockedRow.style.display = 'none';
      note.textContent = 'Max 200. Cards with large images use more browser storage — if history fills up, the oldest cards are dropped automatically.';
      const revertTo = getPreUnlockValue();
      slider.value = revertTo;
      label.textContent = revertTo;
      applyMax(revertTo);
    }
  }

  function suppressConfirms() {
    return $('suppressConfirmToggle') && $('suppressConfirmToggle').checked;
  }

  // Slider events — keep pre-unlock snapshot in sync as the user adjusts the slider
  slider.addEventListener('input', () => { label.textContent = slider.value; });
  slider.addEventListener('change', () => {
    const v = parseInt(slider.value, 10);
    const prevMax = getMaxHistory(); // capture before any async
    const wouldTrim = Math.max(0, getHistory().length - v);
    if (wouldTrim > 0 && !suppressConfirms()) {
      showTrimModal(v, wouldTrim,
        () => { localStorage.setItem('dnd_max_history_pre_unlock', v); applyMax(v); },
        () => { slider.value = prevMax; label.textContent = prevMax; }
      );
    } else {
      localStorage.setItem('dnd_max_history_pre_unlock', v);
      applyMax(v);
    }
  });

  // Unlocked text input
  unlockedInput.addEventListener('change', () => {
    let v = parseInt(unlockedInput.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    unlockedInput.value = v;
    const prevMax = getMaxHistory(); // capture before any async
    const wouldTrim = Math.max(0, getHistory().length - v);
    if (wouldTrim > 0 && !suppressConfirms()) {
      showTrimModal(v, wouldTrim,
        () => applyMax(v),
        () => { unlockedInput.value = prevMax; }
      );
    } else {
      applyMax(v);
    }
  });

  // Toggle
  unlockToggle.addEventListener('change', () => {
    if (!unlockToggle.checked) {
      const revertTo = getPreUnlockValue();
      const wouldTrim = Math.max(0, getHistory().length - revertTo);
      if (wouldTrim > 0 && !suppressConfirms()) {
        showTrimModal(revertTo, wouldTrim,
          () => setUnlocked(false),
          () => { unlockToggle.checked = true; }
        );
        return;
      }
    }
    setUnlocked(unlockToggle.checked);
  });

  // Exposed so Clear All Data can reset the history UI without calling applyMax
  // (localStorage is already cleared at that point — no need to write back)
  window._resetMaxHistory = function() {
    unlockToggle.checked = false;
    $('unlockMaxHistoryLabel').textContent = 'Unlock card history';
    sliderRow.style.display = 'block';
    unlockedRow.style.display = 'none';
    slider.value = 25;
    label.textContent = '25';
    note.textContent = 'Max 200. Cards with large images use more browser storage — if history fills up, the oldest cards are dropped automatically.';
  };

  // Exposed so the import handler can increase the limit and keep the Settings UI in sync
  window._setMaxHistoryFromImport = function(v) {
    localStorage.setItem('dnd_max_history', v);
    if (v > LOCKED_MAX) {
      localStorage.setItem('dnd_max_history_unlocked', 'true');
      localStorage.setItem('dnd_max_history_pre_unlock', LOCKED_MAX);
      unlockToggle.checked = true;
      $('unlockMaxHistoryLabel').textContent = 'Revert card history';
      sliderRow.style.display = 'none';
      unlockedRow.style.display = 'block';
      unlockedInput.value = v;
      note.textContent = 'No upper limit. Be careful — very large histories with big images may exceed browser storage.';
    } else {
      localStorage.setItem('dnd_max_history_pre_unlock', v);
      slider.value = v;
      label.textContent = v;
    }
  };

  // Init — read stored max directly; do NOT call applyMax here or it would
  // overwrite dnd_max_history with the pre-unlock snapshot if the two ever diverged.
  const wasUnlocked = localStorage.getItem('dnd_max_history_unlocked') === 'true';
  unlockToggle.checked = wasUnlocked;
  $('unlockMaxHistoryLabel').textContent = wasUnlocked ? 'Revert card history' : 'Unlock card history';
  if (wasUnlocked) {
    sliderRow.style.display = 'none';
    unlockedRow.style.display = 'block';
    unlockedInput.value = getMaxHistory();
    note.textContent = 'No upper limit. Be careful — very large histories with big images may exceed browser storage.';
  } else {
    sliderRow.style.display = 'block';
    unlockedRow.style.display = 'none';
    const currentMax = Math.min(getMaxHistory(), LOCKED_MAX);
    slider.value = currentMax;
    label.textContent = currentMax;
    // Keep pre-unlock snapshot in sync with the actual stored max
    localStorage.setItem('dnd_max_history_pre_unlock', currentMax);
  }
})();

// ── MOBILE DRAG HANDLE ──
(function() {
  const handle = $('mobileDragHandle');
  if (!handle) return;

  const workspace  = document.querySelector('.workspace');
  const previewEl  = document.querySelector('.preview-area');
  const STORAGE_KEY = 'dnd_mobile_preview_h';

  // Restore saved split position
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) workspace.style.setProperty('--mobile-preview-h', saved + 'px');

  let dragStartY = 0;
  let dragStartH = 0;
  let dragging   = false;
  let dragMoved  = false;

  function startDrag(clientY) {
    dragging   = true;
    dragMoved  = false;
    dragStartY = clientY;
    dragStartH = previewEl.offsetHeight;
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
  }

  function moveDrag(clientY) {
    if (!dragging) return;
    const delta  = clientY - dragStartY;
    if (Math.abs(delta) > 6) dragMoved = true;
    // Clamp within the workspace itself: preview + drag handle + min tab area must all fit
    const maxH   = workspace.offsetHeight - handle.offsetHeight - 60;
    const newH   = Math.max(80, Math.min(maxH, dragStartH + delta));
    workspace.style.setProperty('--mobile-preview-h', newH + 'px');
  }

  // Bottom-sheet snap targets, expressed as the preview (card-hero) height:
  //   peek     → large card, small form (sheet "peek")
  //   expanded → small card, large form (sheet "expanded")
  function snapTargets() {
    const wsH  = workspace.offsetHeight;
    const maxH = wsH - handle.offsetHeight - 60;
    return {
      expanded: Math.max(80, Math.round(wsH * 0.30)),
      peek:     Math.min(maxH, Math.round(wsH * 0.62)),
    };
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';

    const { expanded, peek } = snapTargets();
    const cur = previewEl.offsetHeight;
    const nearestIsPeek = Math.abs(cur - peek) <= Math.abs(cur - expanded);
    // A tap (no real drag) toggles to the OTHER state; a drag snaps to the nearest.
    const target = dragMoved ? (nearestIsPeek ? peek : expanded)
                             : (nearestIsPeek ? expanded : peek);

    workspace.classList.add('mobile-snapping');
    workspace.style.setProperty('--mobile-preview-h', target + 'px');
    setTimeout(() => workspace.classList.remove('mobile-snapping'), 240);
    localStorage.setItem(STORAGE_KEY, target);
  }

  // Touch events
  handle.addEventListener('touchstart', e => {
    startDrag(e.touches[0].clientY);
  }, { passive: true });
  document.addEventListener('touchmove', e => {
    if (!dragging) return;
    e.preventDefault();
    moveDrag(e.touches[0].clientY);
  }, { passive: false });
  document.addEventListener('touchend', endDrag);

  // Mouse events (for desktop testing of mobile layout)
  handle.addEventListener('mousedown', e => {
    e.preventDefault();
    startDrag(e.clientY);
  });
  document.addEventListener('mousemove', e => { if (dragging) moveDrag(e.clientY); });
  document.addEventListener('mouseup', endDrag);
})();

// ── MODAL BACKDROP CLOSE ──
// Clicking the dark backdrop (the .confirm-modal element itself, not the box inside)
// closes the modal as though the user clicked Cancel.
document.querySelectorAll('.confirm-modal').forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target !== modal) return;
    // Prefer an explicit cancel/dismiss/close button; avoid meta-buttons like Select All/None
    const cancelBtn = modal.querySelector('.btn-cancel:not(.print-select-meta-btn)') ||
                      modal.querySelector('button[id$="Close"]') ||
                      modal.querySelector('button[id$="Cancel"]');
    if (cancelBtn) cancelBtn.click();
    else modal.classList.remove('active');
  });
});

// ── INITIAL RENDER ──
// Snapshot the HTML default values before any localStorage state is applied.
const DEFAULT_STATE = collectCurrentState();
renderCollectionDropdown();
populateCollectionSelect(null);
// Gate the initial data render on storage being ready (IndexedDB hydration / migration).
// Storage falls back to localStorage if IndexedDB is unavailable, so this always resolves.
window.__storageReady.then(() => {

renderHistoryBar();
// Set default card scale based on screen size
if (window.innerWidth >= 861) {
  $('scaleSlider').value = 150;
  applyCardScale(150);
}
const _initialHistory = getHistory();
if (_initialHistory.length > 0) {
  applyState(_initialHistory[0]);
} else {
  syncCard();
}

// Announce the one-time IndexedDB migration, if it just happened.
if (_pendingMigrationToast != null) {
  const n = _pendingMigrationToast;
  showToast(`✦ Upgraded to IndexedDB · ${n} card${n === 1 ? '' : 's'} moved · plenty of room`);
}

// Web fonts load asynchronously; re-run shrink once they're ready so stat values
// aren't measured against a fallback font that's narrower than Cinzel.
document.fonts.ready.then(() => {
  _applyStatShrink($('itemCard'), parseFloat($('fontScale').value) || 1);
});

// ── DEFAULT CARD IMAGE ──
// Load img/brown_logo.png and inject it into the welcome card shown to first-time visitors.
// Mirrors the upload handler exactly to avoid applyState side-effects.
// Also patches the history entry that registerNewCard() already created (without the image)
// and updates DEFAULT_STATE so factory reset restores it too.
// Not included in getNewCardState() — blank new cards remain logo-free.
(function loadDefaultCardImage() {
  if (_initialHistory.length > 0) return; // returning visitor — leave their card alone

  const cardImg     = $('cardItemImg');
  const placeholder = $('imgPlaceholder');

  cardImg.onload = () => {
    itemImgNaturalW = cardImg.naturalWidth;
    itemImgNaturalH = cardImg.naturalHeight;
    itemImgX = 0; itemImgY = 0; itemImgScale = 1;
    if ($('itemImgZoom')) $('itemImgZoom').value = 1;
    updateItemImageTransform();
    showCropControls(true);

    // Convert to data URL via canvas (same-origin PNG — no CORS issue).
    // This ensures the image is embedded when saved to history or exported.
    // Skip on file:// protocol due to browser security restrictions.
    if (location.protocol !== 'file:') {
      try {
        const canvas = document.createElement('canvas');
        canvas.width  = itemImgNaturalW;
        canvas.height = itemImgNaturalH;
        canvas.getContext('2d').drawImage(cardImg, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');

        cardImg.src = dataUrl;
        $('itemImgPreview').src = dataUrl;

        DEFAULT_STATE.itemImage   = dataUrl;
        DEFAULT_STATE.imgNaturalW = itemImgNaturalW;
        DEFAULT_STATE.imgNaturalH = itemImgNaturalH;

        // Patch the history entry registerNewCard() already saved without the image
        if (activeHistoryId) {
          const hist = getHistory();
          const idx  = hist.findIndex(h => h.id === activeHistoryId);
          if (idx >= 0) {
            hist[idx].itemImage   = dataUrl;
            hist[idx].imgNaturalW = itemImgNaturalW;
            hist[idx].imgNaturalH = itemImgNaturalH;
            saveHistory(hist);
          }
        }
      } catch (e) {
        // canvas.toDataURL() is blocked in some browsers when served from file://
        // (Firefox private-mode security restriction). The image stays visible on
        // screen. The export onclone handler strips non-data-URL images from the
        // render clone so export still works — it just omits the logo in that case.
        console.warn('[init] could not convert logo to data URL:', e);
      }
    }
  };

  cardImg.onerror = () => console.warn('[init] could not load img/brown_logo.png');

  // Set src directly — same-origin file, no fetch needed
  cardImg.src = 'img/brown_logo.png';
  cardImg.style.display     = 'block';
  placeholder.style.display = 'none';
  $('itemImgPreview').src   = 'img/brown_logo.png';
  $('itemImgZone').classList.add('has-image');
  $('clearItem').style.display = 'inline-block';
})();

// ── SHARE PROVIDER UI — initial sync ──
updateShareUI();

// ── SHARE: URL hash detection (Step 6) ──
(function () {
  const hash = window.location.hash;
  if (!hash.startsWith('#share=')) return;

  // Strip hash immediately so a page refresh doesn't re-trigger the import
  history.replaceState(null, '', window.location.pathname + window.location.search);

  const shareValue = hash.slice('#share='.length);        // e.g. "dropbox:https%3A%2F..."
  const colonIdx   = shareValue.indexOf(':');
  if (colonIdx === -1) return;
  const provider = shareValue.slice(0, colonIdx);
  const id       = shareValue.slice(colonIdx + 1);

  // Fetch and show import modal after init is fully done
  requestAnimationFrame(async () => {
    let cardState = null;
    try {
      cardState = await fetchSharedCard(provider, id);
    } catch (err) {
      if (err.message === 'not_found') {
        showInfoModal('Card Not Found', 'This shared card is no longer available — the owner may have deleted it.');
      } else {
        showInfoModal('Share Error', 'Could not load the shared card. Please check your connection and try again.');
        console.error('[share] fetchSharedCard error:', err);
      }
      return;
    }

    if (!cardState) return; // provider not yet implemented

    // Normalise: handle legacy bare array, new envelope { version, collections, cards }, or single card
    const isEnvelope       = !Array.isArray(cardState) && Array.isArray(cardState.cards);
    const cards            = isEnvelope ? cardState.cards : (Array.isArray(cardState) ? cardState : [cardState]);
    const sharedCollections = isEnvelope ? (cardState.collections || []) : [];
    const existing = getHistory();

    // Deduplicate against the user's existing collection before showing the modal
    const { newCards, skipCount } = _deduplicateCards(cards, existing);
    const totalCount = cards.length;
    const s = n => n !== 1 ? 's' : '';

    if (!newCards.length) {
      // Everything is already in the collection — skip the import modal entirely
      showInfoModal('Already in Your Collection',
        `${totalCount === 1
          ? `"${cards[0].name || 'This card'}" is`
          : `All ${totalCount} cards are`} already in your collection.`);
      return;
    }

    // Build the modal message
    if (skipCount === 0) {
      if (totalCount === 1) {
        $('shareImportMsg').innerHTML =
          `<strong>${cards[0].name || 'Unnamed Card'}</strong> was shared with you — would you like to import it?`;
      } else {
        $('shareImportMsg').innerHTML =
          `<strong>${totalCount} cards</strong> were shared with you — would you like to import them all?`;
      }
    } else {
      $('shareImportMsg').innerHTML =
        `<strong>${totalCount} card${s(totalCount)}</strong> were shared with you. ` +
        `${skipCount} ${skipCount === 1 ? 'is' : 'are'} already in your collection — ` +
        `import the <strong>${newCards.length} new card${s(newCards.length)}</strong>?`;
    }
    $('shareImportModal').classList.add('active');

    $('shareImportOk').onclick = () => {
      $('shareImportModal').classList.remove('active');
      const remapped = mergeImportedCollections(sharedCollections, newCards);
      const remappedNames = new Set(remapped.map(c => c.name));
      const merged = [...remapped, ...existing.filter(e => !remappedNames.has(e.name))];
      saveHistory(merged.slice(0, getMaxHistory()));
      renderCollectionDropdown();
      renderHistoryBar();
      applyState(remapped[0]);
      if (newCards.length === 1) {
        showInfoModal('Imported', `"${newCards[0].name || 'Card'}" has been added to your history.`);
      } else {
        showInfoModal('Imported', `${newCards.length} cards have been added to your history.`);
      }
    };
  });
})();

}); // end window.__storageReady.then — initial data render
