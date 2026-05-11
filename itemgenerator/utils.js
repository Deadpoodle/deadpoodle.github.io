// ── Pure utility functions ─────────────────────────────────────────────────────
// No DOM dependencies. Loaded by both script.js (via index.html) and the test
// suite (tests/index.html) so that the tests always run against the real
// implementations rather than hand-copied snapshots.

// ── Share deduplication cache (localStorage) ──────────────────────────────────
// Maps a content hash → share URL so unchanged selections skip re-uploading.
const SHARE_CACHE_KEY = 'artifex_share_cache';

function _getShareCache() {
  try { return JSON.parse(localStorage.getItem(SHARE_CACHE_KEY) || '{}'); } catch { return {}; }
}
function _setShareCache(hash, url) {
  const cache = _getShareCache();
  cache[hash] = url;
  // Keep at most 100 entries (trim oldest keys if exceeded)
  const keys = Object.keys(cache);
  if (keys.length > 100) keys.slice(0, keys.length - 100).forEach(k => delete cache[k]);
  try { localStorage.setItem(SHARE_CACHE_KEY, JSON.stringify(cache)); } catch {}
}

// Stable JSON stringify (sorted keys) so key insertion order doesn't affect the hash
function _stableStringify(obj) {
  if (Array.isArray(obj)) return '[' + obj.map(_stableStringify).join(',') + ']';
  if (obj !== null && typeof obj === 'object') {
    return '{' + Object.keys(obj).sort().map(k => JSON.stringify(k) + ':' + _stableStringify(obj[k])).join(',') + '}';
  }
  return JSON.stringify(obj);
}

// Synchronous content fingerprint for a single card — strips volatile fields so two
// cards with identical content but different IDs / timestamps compare as equal.
function _cardFingerprint(card) {
  const { id, sharedAt, appVersion, ...rest } = card;
  return _stableStringify(rest);
}

// Deduplicate an array of incoming cards against the user's existing collection.
// Returns { newCards, skipCount }.
// - Cards whose content fingerprint already exists are skipped (skipCount++).
// - Cards within the same incoming batch that are identical to each other are also skipped.
// - All kept cards receive a fresh ID to prevent timestamp clashes, whether or not their
//   original ID matched an existing card.
function _deduplicateCards(incoming, existing) {
  const seenFPs = new Set(existing.map(_cardFingerprint));
  const existingIds = new Set(existing.map(c => c.id));
  const newCards = [];
  let skipCount = 0;

  for (const card of incoming) {
    const fp = _cardFingerprint(card);
    if (seenFPs.has(fp)) { skipCount++; continue; }
    seenFPs.add(fp); // prevent intra-batch duplicates
    // Always assign a fresh ID — avoids clashes and satisfies the rule that same-ID
    // but different-content imports don't collide with existing entries.
    newCards.push({ ...card, id: Date.now() + newCards.length });
  }

  return { newCards, skipCount };
}

// ── Attunement / Requirements rendering ───────────────────────────────────────
// Maps the dropdown mode value to the prefix that appears on the card.
const ATTUNE_PREFIXES = {
  attunement: 'Requires attunement by ',
  craftsman:  'Creation by ',
  custom:     'Requires ',
};
const ATTUNE_KNOWN_MODES = new Set(Object.keys(ATTUNE_PREFIXES).concat(['']));

// Returns the full string to display on the card, or '' if nothing should show.
// Handles legacy saved cards whose attunement field contained display text rather than a mode key.
function _resolveAttunement(mode, text) {
  mode = mode || '';
  text = (text || '').trim();
  if (!mode) return '';
  if (!ATTUNE_KNOWN_MODES.has(mode)) {
    // Legacy format — the mode field contains the old display text (e.g. "by a spellcaster").
    // Render with the old prefix so existing saved cards display correctly.
    return 'Requires ' + mode;
  }
  if (!text) return '';
  return ATTUNE_PREFIXES[mode] + text;
}

// SHA-256 of card content, ignoring volatile fields that change on every share
async function _shareContentHash(states) {
  const stable = states.map(({ id, sharedAt, appVersion, ...rest }) => rest);
  const str    = _stableStringify(stable);
  const buf    = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
}
