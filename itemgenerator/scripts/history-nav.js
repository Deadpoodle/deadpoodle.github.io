// history-nav.js - history search, scroll helper, cards-strip nav, mobile swipe, settings toggles (suppress/compress/scale/quality/defaults/max-history), mobile drag handle, modal backdrop close — part of split script.js; see index.html for load order
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

