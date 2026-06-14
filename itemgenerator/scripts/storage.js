// storage.js - history + localStorage/IndexedDB, initStorage, window.__storageReady — part of split script.js; see index.html for load order
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

