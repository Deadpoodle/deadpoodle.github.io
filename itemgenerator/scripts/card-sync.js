// card-sync.js - image crop pan/zoom, stat auto-shrink, syncCard live render, char counter/overflow, input binding, colour pickers — part of split script.js; see index.html for load order
// ── ITEM IMAGE CROP (pan / zoom) ──
let itemImgX = 0, itemImgY = 0, itemImgScale = 1;
let itemImgNaturalW = 0, itemImgNaturalH = 0;

function updateItemImageTransform() {
  const img = $('cardItemImg');
  if (!img || img.style.display === 'none' || !itemImgNaturalW) return;
  const C = 110;
  const coverScale = Math.max(C / itemImgNaturalW, C / itemImgNaturalH);
  const total = coverScale * itemImgScale;
  const baseX  = (C - itemImgNaturalW * total) / 2;
  const baseY  = (C - itemImgNaturalH * total) / 2;
  img.style.width           = itemImgNaturalW + 'px';
  img.style.height          = itemImgNaturalH + 'px';
  img.style.left            = '0';
  img.style.top             = '0';
  img.style.transformOrigin = '0 0';
  img.style.transform       = `translate(${baseX + itemImgX}px,${baseY + itemImgY}px) scale(${total})`;
}

function resetImageCrop() {
  itemImgX = 0; itemImgY = 0; itemImgScale = 1;
  if ($('itemImgZoom')) $('itemImgZoom').value = 1;
  updateItemImageTransform();
}

function showCropControls(visible) {
  const el = $('itemImgCropControls');
  if (el) el.style.display = visible ? 'block' : 'none';
  const c = $('cardImgContainer');
  c.style.cursor = visible ? 'grab' : '';
  c.classList.toggle('has-img', !!visible);
}

// Drag to pan
(function() {
  let dragging = false, startX = 0, startY = 0;
  const con = () => $('cardImgContainer');

  document.addEventListener('mousedown', e => {
    if (!con().contains(e.target) || !itemImgNaturalW) return;
    e.preventDefault();
    dragging = true;
    startX = e.clientX - itemImgX;
    startY = e.clientY - itemImgY;
    con().style.cursor = 'grabbing';
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    itemImgX = e.clientX - startX;
    itemImgY = e.clientY - startY;
    updateItemImageTransform();
  });
  function isOutsideCircle(clientX, clientY) {
    const rect = con().getBoundingClientRect();
    const dx = clientX - (rect.left + rect.width  / 2);
    const dy = clientY - (rect.top  + rect.height / 2);
    return Math.sqrt(dx * dx + dy * dy) > rect.width / 2;
  }

  async function confirmRemoveImage() {
    if (await showGenericConfirm('Remove Image', 'Remove the item image?', 'Remove')) {
      $('clearItem').click();
    } else {
      resetImageCrop();
    }
  }

  document.addEventListener('mouseup', e => {
    if (!dragging) return;
    dragging = false;
    if (!itemImgNaturalW) return;
    con().style.cursor = 'grab';
    if (isOutsideCircle(e.clientX, e.clientY)) confirmRemoveImage();
  });

  // Touch pan
  let tx = 0, ty = 0;
  con().addEventListener('touchstart', e => {
    if (e.touches.length !== 1 || !itemImgNaturalW) return;
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
    dragging = true; e.preventDefault();
  }, { passive: false });
  con().addEventListener('touchmove', e => {
    if (!dragging || e.touches.length !== 1) return;
    itemImgX += e.touches[0].clientX - tx;
    itemImgY += e.touches[0].clientY - ty;
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
    updateItemImageTransform(); e.preventDefault();
  }, { passive: false });
  con().addEventListener('touchend', e => {
    if (!dragging) return;
    dragging = false;
    if (!itemImgNaturalW) return;
    if (e.changedTouches.length > 0 && isOutsideCircle(e.changedTouches[0].clientX, e.changedTouches[0].clientY)) {
      confirmRemoveImage();
    }
  });
})();

// Scroll to zoom
$('cardImgContainer').addEventListener('wheel', e => {
  if (!itemImgNaturalW) return;
  e.preventDefault();
  itemImgScale = Math.max(0.2, Math.min(10, itemImgScale * (e.deltaY > 0 ? 0.92 : 1.08)));
  if ($('itemImgZoom')) $('itemImgZoom').value = itemImgScale;
  updateItemImageTransform();
}, { passive: false });

// Zoom slider + reset button
$('itemImgZoom').addEventListener('input', () => {
  itemImgScale = parseFloat($('itemImgZoom').value);
  updateItemImageTransform();
});
$('resetImgCrop').addEventListener('click', resetImageCrop);

// ── STAT TEXT AUTO-SHRINK ──
// Reduces font size of an element until its content fits, down to minRem.
function _shrinkToFit(el, baseRem, minRem) {
  el.style.fontSize = baseRem + 'rem';
  let size = baseRem;
  while (el.scrollWidth > el.offsetWidth + 1 && size > minRem) {
    size = Math.round((size - 0.05) * 100) / 100;
    el.style.fontSize = size + 'rem';
  }
}

// Runs _shrinkToFit on all stat/subtype elements within a built card node.
// Must be called after the node is in the DOM so scrollWidth is measurable.
function _applyStatShrink(node, fontScale = 1) {
  node.querySelectorAll('.stat-value').forEach(el => _shrinkToFit(el, 0.82 * fontScale, 0.55));
  node.querySelectorAll('.side-stat-value').forEach(el => _shrinkToFit(el, 0.72 * fontScale, 0.55));
  const subtype = node.querySelector('.card-subtype');
  if (subtype) _shrinkToFit(subtype, 0.65 * fontScale, 0.5);
}

// ── LIVE SYNC ──
function syncCard() {
  if (!_applyingState) setDirty(true);
  const fs     = parseFloat($('fontScale').value)     || 1;
  const descFs = parseFloat($('descFontScale').value) || 1;
  const hFont = $('headingFont').value || 'Cinzel';
  const bFont = `'${$('bodyFont').value || 'Crimson Pro'}',Georgia,serif`;
  const name    = $('itemName').value || 'Unnamed Item';

  // Keep the center card-strip name in sync as the user types
  const stripName = $('cardStripName');
  if (stripName) stripName.textContent = name;

  // Keep history bar/dropdown name in sync as the user types
  if (activeHistoryId) {
    document.querySelectorAll('.history-item, .history-dropdown-item').forEach(el => {
      if (el.dataset.historyId === String(activeHistoryId)) {
        const span = el.querySelector('.history-name');
        if (span) span.textContent = $('itemName').value || 'Unnamed Item';
      }
    });
  }
  const type    = $('itemType').value;
  const subtype = $('itemSubtype').value;
  const rarity  = $('itemRarity').value;
  const bonus   = $('itemBonus').value;
  const damage  = $('itemDamage').value;
  const weight  = $('itemWeight').value;
  const showCollection = $('showCollection').checked;
  const collectionId   = $('itemCollection').value ? parseInt($('itemCollection').value, 10) : null;
  const source         = showCollection ? (getCollectionById(collectionId)?.name || '') : '';
  const desc    = $('itemDescription').value;

  // Attunement
  const attune = _resolveAttunement($('itemAttunement').value, $('attunementCustom').value);

  $('previewName').textContent   = name;
  $('previewSubtype').textContent = type ? (subtype ? `${type} • ${subtype}` : type) : subtype;
  _shrinkToFit($('previewSubtype'), 0.65 * fs, 0.5);
  $('previewBonus').textContent  = bonus  || '—';
  $('previewDamage').textContent = damage || '—';
  $('previewWeight').textContent = weight || '—';
  _shrinkToFit($('previewBonus'),  0.82 * fs, 0.55);
  _shrinkToFit($('previewDamage'), 0.82 * fs, 0.55);
  _shrinkToFit($('previewWeight'), 0.82 * fs, 0.55);
  $('previewSource').textContent = source || '';

  // Rarity badge
  const rarityEl = $('previewRarity');
  rarityEl.className = `card-rarity rarity-${rarity}`;
  const icon = rarityIcons[rarity] || '◆';
  rarityEl.textContent = `${icon} ${rarityLabels[rarity]} ${icon}`;
  const rarityHex = $('rarityColorHex').value;
  if (/^#[0-9a-fA-F]{6}$/.test(rarityHex)) {
    rarityEl.style.color = rarityHex;
    rarityEl.style.borderColor = rarityHex;
  } else {
    rarityEl.style.color = '';
    rarityEl.style.borderColor = '';
  }

  // Attunement
  const attuneEl = $('previewAttunement');
  if (attune) {
    attuneEl.style.display = 'block';
    attuneEl.textContent = attune;
  } else {
    attuneEl.style.display = 'none';
  }

  // Description (markdown)
  $('previewDesc').innerHTML = typeof marked !== 'undefined'
    ? marked.parse(desc, { breaks: true })
    : desc.replace(/\n/g, '<br>');

  // ── CHAR COUNTER + OVERFLOW CONTROL ──
  // CHAR_LIMIT is used only for the counter display and the "warn" colour.
  // Calculated: card 531px − header/divider/image-wrap/stats/footer ≈ 226px available,
  // at 0.87rem Crimson Pro (line-height 1.5 ≈ 20.9px) ≈ 13 lines × ~43 chars ≈ 560 chars.
  const CHAR_LIMIT = 560;
  const len = desc.length;
  const oversized = $('allowOversized').checked;
  const countEl   = $('charCount');
  const warnEl    = $('oversizedWarning');
  const bodyEl    = $('previewDesc').closest('.card-body') || $('previewDesc').parentElement;

  // Clamp or unclamp card body overflow first, so DOM layout is correct before we measure.
  const cardContent = $('itemCard').querySelector('.card-content');
  if (oversized) {
    cardContent.style.height    = 'auto';
    cardContent.style.minHeight = '531px';
    cardContent.style.overflow  = 'visible';
    $('itemCard').style.minHeight = cardContent.scrollHeight + 'px';
  } else {
    cardContent.style.height    = '531px';
    cardContent.style.minHeight = '';
    cardContent.style.overflow  = 'hidden';
    $('itemCard').style.minHeight = '';
  }

  // Detect actual clipping by measuring whether the description content exceeds the
  // available body height. This is accurate regardless of other card settings
  // (attunement, circle size, title length etc.).
  const isClipped = !oversized && bodyEl.scrollHeight > bodyEl.clientHeight;

  countEl.textContent = `${len} / ${CHAR_LIMIT}`;
  countEl.className   = 'char-count' + (isClipped || len > CHAR_LIMIT ? ' over' : len > CHAR_LIMIT * 0.85 ? ' warn' : '');

  if (isClipped) {
    warnEl.classList.add('visible');
  } else {
    warnEl.classList.remove('visible');
  }

  applyCardScale($('scaleSlider').value);

  // Stat labels
  $('previewBonusLabel').textContent  = $('bonusLabel').value  || 'Bonus';
  $('previewDamageLabel').textContent = $('damageLabel').value || 'Damage';
  $('previewWeightLabel').textContent = $('weightLabel').value || 'Weight';

  // Side stats (save / range)
  const saveVal  = $('itemSave').value.trim();
  const rangeVal = $('itemRange').value.trim();
  $('saveStat').style.display  = saveVal  ? 'block' : 'none';
  $('rangeStat').style.display = rangeVal ? 'block' : 'none';
  if (saveVal)  { $('previewSave').textContent  = saveVal;  $('previewSaveLabel').textContent  = $('saveLabel').value  || 'Save';  _shrinkToFit($('previewSave'),  0.82 * fs, 0.55); }
  if (rangeVal) { $('previewRange').textContent = rangeVal; $('previewRangeLabel').textContent = $('rangeLabel').value || 'Range'; _shrinkToFit($('previewRange'), 0.82 * fs, 0.55); }

  // Toggles
  const showImg = $('showImage').checked;
  $('cardImgContainer').style.display = showImg ? 'flex' : 'none';
  $('imageWrap').style.display     = (showImg || !!saveVal || !!rangeVal) ? 'grid' : 'none';
  $('statsStrip').style.display    = $('showStats').checked ? 'flex' : 'none';
  $('cardFrame').style.display     = $('showFrame').checked ? 'block' : 'none';
  $('itemCard').style.borderRadius = $('squareCorners').checked ? '0' : '8px';

  // Background image opacity
  const bgOpacityVal = parseFloat($('bgOpacity').value) || 1;
  $('bgOpacityLabel').textContent = Math.round(bgOpacityVal * 100) + '%';
  $('cardBgImg').style.opacity = bgOpacityVal;

  // Circle size + border colour
  const circleSize = parseInt($('circleSize').value) || 110;
  $('circleSizeLabel').textContent = circleSize + 'px';
  const circleContainer = $('cardImgContainer');
  circleContainer.style.width  = circleSize + 'px';
  circleContainer.style.height = circleSize + 'px';
  const circleBorderHex = $('circleBorderColorHex').value;
  circleContainer.style.borderColor = /^#[0-9a-fA-F]{6}$/.test(circleBorderHex)
    ? circleBorderHex : 'rgba(90,60,30,0.45)';

  // Colors
  const cardCol = $('cardColorHex').value;
  const inkCol  = $('inkColorHex').value;
  if (/^#[0-9a-fA-F]{6}$/.test(cardCol)) {
    $('cardBg').style.backgroundColor = cardCol;
  }
  if (/^#[0-9a-fA-F]{6}$/.test(inkCol)) {
    const card = $('itemCard');
    card.querySelectorAll('.card-item-name,.card-subtype,.stat-value,.card-source,.side-stat-value').forEach(el => {
      el.style.color = inkCol;
    });
    card.querySelectorAll('.card-description').forEach(el => {
      el.style.color = inkCol;
    });
    card.querySelectorAll('.stat-label,.card-attunement,.side-stat-label').forEach(el => {
      el.style.color = inkCol;
      el.style.opacity = '0.75';
    });
  }

  // Typography — apply font family to all card text elements, and font-size to non-shrink-to-fit ones
  const liveCard = $('itemCard');
  liveCard.querySelectorAll('.card-item-name,.card-subtype,.card-rarity,.stat-label,.stat-value,.side-stat-label,.side-stat-value,.card-source').forEach(el => {
    el.style.fontFamily = `${hFont},serif`;
  });
  liveCard.querySelectorAll('.card-description,.card-attunement').forEach(el => {
    el.style.fontFamily = bFont;
  });
  liveCard.querySelectorAll('.card-description h1,.card-description h2,.card-description h3').forEach(el => {
    el.style.fontFamily = `${hFont},serif`;
  });
  liveCard.querySelector('.card-item-name').style.fontSize = `${(1.15*fs).toFixed(3)}rem`;
  liveCard.querySelector('.card-rarity').style.fontSize    = `${(0.6*fs).toFixed(3)}rem`;
  liveCard.querySelectorAll('.stat-label').forEach(el => el.style.fontSize = `${(0.52*fs).toFixed(3)}rem`);
  liveCard.querySelectorAll('.side-stat-label').forEach(el => el.style.fontSize = `${(0.52*fs).toFixed(3)}rem`);
  liveCard.querySelector('.card-description').style.fontSize  = `${(0.87*descFs).toFixed(3)}rem`;
  $('previewAttunement').style.fontSize = `${(0.75*descFs).toFixed(3)}rem`;
  const srcEl = $('previewSource');
  if (srcEl) srcEl.style.fontSize = `${(0.55*descFs).toFixed(3)}rem`;

  updateDefaultTypeImage();
}

// ── BIND ALL INPUTS ──
[
  'itemName','itemType','itemSubtype','itemRarity','itemBonus',
  'itemDamage','itemWeight','itemDescription',
  'itemAttunement','attunementCustom','showImage','showStats','showCollection','showFrame','squareCorners',
  'allowOversized',
  'bonusLabel','damageLabel','weightLabel','saveLabel','rangeLabel',
  'itemSave','itemRange'
].forEach(id => {
  const el = $(id);
  if (el) el.addEventListener('input', syncCard);
});


// ── COLOR PICKERS ──
function bindColor(pickerId, hexId) {
  const picker = $(pickerId), hex = $(hexId);
  picker.addEventListener('input', () => { hex.value = picker.value; syncCard(); });
  hex.addEventListener('input', () => {
    if (/^#[0-9a-fA-F]{6}$/.test(hex.value)) picker.value = hex.value;
    syncCard();
  });
}
bindColor('cardColor','cardColorHex');
bindColor('inkColor','inkColorHex');
bindColor('rarityColor','rarityColorHex');
bindColor('circleBorderColor','circleBorderColorHex');

$('bgOpacity').addEventListener('input', syncCard);
$('circleSize').addEventListener('input', syncCard);
$('fontScale').addEventListener('input', () => {
  $('fontScaleLabel').textContent = Math.round($('fontScale').value * 100) + '%';
  syncCard();
});
$('descFontScale').addEventListener('input', () => {
  $('descFontScaleLabel').textContent = Math.round($('descFontScale').value * 100) + '%';
  syncCard();
});
$('headingFont').addEventListener('change', syncCard);
$('bodyFont').addEventListener('change', syncCard);

$('resetCardColor').addEventListener('click', () => {
  $('cardColorHex').value = '#d4b87a';
  $('cardColor').value = '#d4b87a';
  syncCard();
});

$('resetInkColor').addEventListener('click', () => {
  $('inkColorHex').value = '#2c1a0e';
  $('inkColor').value = '#2c1a0e';
  syncCard();
});

const RARITY_COLORS = {
  common:    '#555555',
  uncommon:  '#1a6e1a',
  rare:      '#1a3e8b',
  'very-rare': '#5a1a8b',
  legendary: '#8b4a00',
  artifact:  '#8b1a1a',
  unique:    '#2e6b6b',
};
function getRarityDefaultColor() {
  return RARITY_COLORS[$('itemRarity').value] || '#1a3e8b';
}
function syncRarityPickerToRarity() {
  // Only update the picker when the user hasn't set a custom colour (hex field is blank)
  if (!$('rarityColorHex').value) {
    $('rarityColor').value = getRarityDefaultColor();
  }
}

$('resetRarityColor').addEventListener('click', () => {
  $('rarityColorHex').value = '';
  $('rarityColor').value = getRarityDefaultColor();
  syncCard();
});

$('itemRarity').addEventListener('change', syncRarityPickerToRarity);

$('resetCircleBorderColor').addEventListener('click', () => {
  $('circleBorderColorHex').value = '';
  $('circleBorderColor').value = '#5a3c1e';
  syncCard();
});

$('resetAppearanceBtn').addEventListener('click', async () => {
  if (!await showGenericConfirm('Reset Appearance', 'Reset all appearance settings to their defaults? This will also remove any uploaded images.', 'Reset')) return;

  // Colours
  $('cardColor').value    = '#d4b87a'; $('cardColorHex').value    = '#d4b87a';
  $('inkColor').value     = '#2c1a0e'; $('inkColorHex').value     = '#2c1a0e';
  $('rarityColorHex').value  = ''; $('rarityColor').value  = getRarityDefaultColor();
  $('circleBorderColor').value = '#5a3c1e'; $('circleBorderColorHex').value = '';

  // Sliders & toggles
  $('bgOpacity').value    = '1';
  $('circleSize').value   = '110';
  $('showImage').checked  = true;
  $('showStats').checked  = true;
  $('showFrame').checked  = true;
  $('squareCorners').checked = false;

  // Background image
  $('bgUpload').value = '';
  $('bgPreview').src  = '';
  $('bgZone').classList.remove('has-image');
  $('clearBg').style.display = 'none';
  $('cardBgImg').style.backgroundImage = '';
  $('bgOpacityRow').style.display = 'none';

  // Item image
  $('itemImgUpload').value = '';
  $('itemImgPreview').src  = '';
  $('itemImgZone').classList.remove('has-image');
  $('clearItem').style.display = 'none';
  $('itemImgCropControls').style.display = 'none';
  const cardImg = $('cardItemImg');
  cardImg.src = ''; cardImg.style.display = 'none'; cardImg.style.transform = '';
  $('imgPlaceholder').style.display = 'block';
  itemImgX = 0; itemImgY = 0; itemImgScale = 1;
  itemImgNaturalW = 0; itemImgNaturalH = 0;

  syncCard();
});

