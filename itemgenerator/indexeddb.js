// ── IndexedDB blob adapter ──────────────────────────────────────────────────
// Card image blobs (per-card background + item image) are heavy when base64-
// encoded and quickly exhaust the ~5 MB localStorage ceiling. This adapter
// stores them in IndexedDB (typically 50 MB+), keyed by card id, while card
// metadata stays in localStorage for a fast synchronous boot.
//
// One object store, `card_blobs`: key = String(cardId), value = { bgImage, itemImage }
// (data-URL strings or null). Exposed as window.idbBlobs. Every method rejects
// gracefully; callers fall back to localStorage if IndexedDB is unavailable.

(function () {
  const DB_NAME = 'artifex_arcanum';
  const DB_VERSION = 1;
  const STORE = 'card_blobs';

  let _dbPromise = null;

  function _open() {
    if (_dbPromise) return _dbPromise;
    _dbPromise = new Promise((resolve, reject) => {
      if (!('indexedDB' in window) || !window.indexedDB) {
        reject(new Error('indexeddb-unavailable'));
        return;
      }
      let req;
      try {
        req = indexedDB.open(DB_NAME, DB_VERSION);
      } catch (e) {
        reject(e);
        return;
      }
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error || new Error('indexeddb-open-failed'));
      req.onblocked = () => reject(new Error('indexeddb-blocked'));
    });
    return _dbPromise;
  }

  function _tx(mode, fn) {
    return _open().then(db => new Promise((resolve, reject) => {
      let result;
      const tx = db.transaction(STORE, mode);
      const store = tx.objectStore(STORE);
      result = fn(store);
      tx.oncomplete = () => resolve(result && result.__req ? result.__req.result : result);
      tx.onerror = () => reject(tx.error);
      tx.onabort = () => reject(tx.error || new Error('indexeddb-tx-abort'));
    }));
  }

  // Returns true if IndexedDB can be opened in this context (false in some
  // private-browsing modes or when blocked by policy).
  async function available() {
    try { await _open(); return true; }
    catch { return false; }
  }

  function set(key, value) {
    return _tx('readwrite', store => { store.put(value, String(key)); });
  }

  function get(key) {
    return _open().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).get(String(key));
      r.onsuccess = () => resolve(r.result || null);
      r.onerror = () => reject(r.error);
    }));
  }

  function del(key) {
    return _tx('readwrite', store => { store.delete(String(key)); });
  }

  function keys() {
    return _open().then(db => new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, 'readonly');
      const r = tx.objectStore(STORE).getAllKeys();
      r.onsuccess = () => resolve((r.result || []).map(String));
      r.onerror = () => reject(r.error);
    }));
  }

  window.idbBlobs = { available, set, get, delete: del, keys };
})();
