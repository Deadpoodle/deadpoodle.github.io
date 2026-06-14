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

// Once on IndexedDB, make 200 the default card-history cap (one-time, only raises).
window._applyMigratedMaxDefault?.();

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
