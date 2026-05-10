// ── HELPERS ──
const $ = id => document.getElementById(id);

function safeConfirm(msg) {
  const el = $('suppressConfirmToggle');
  if (el && el.checked) return true;
  return confirm(msg);
}

// Syncs all export quality radio groups (Settings, Share tab, Download modal) from a value
function syncAllQualityUI(q) {
  ['exportQuality', 'shareQuality', 'pngModalQuality'].forEach(name => {
    const r = document.querySelector(`input[name="${name}"][value="${q}"]`);
    if (r) r.checked = true;
  });
}

function showInfoModal(title, msgHtml) {
  $('infoModalTitle').textContent = title;
  $('infoModalMsg').innerHTML = msgHtml;
  $('infoModal').classList.add('active');
  return new Promise(resolve => {
    $('infoModalOk').onclick = () => { $('infoModal').classList.remove('active'); resolve(); };
  });
}

function showGenericConfirm(title, msgHtml, confirmText = 'Confirm') {
  if ($('suppressConfirmToggle') && $('suppressConfirmToggle').checked) return Promise.resolve(true);
  $('genericConfirmTitle').textContent = title;
  $('genericConfirmMsg').innerHTML = msgHtml;
  $('genericConfirmOk').textContent = confirmText;
  const modal = $('genericConfirmModal');
  modal.style.zIndex = '10000';
  modal.classList.add('active');
  return new Promise(resolve => {
    const close = (result) => { modal.classList.remove('active'); modal.style.zIndex = ''; resolve(result); };
    $('genericConfirmOk').onclick    = () => close(true);
    $('genericConfirmCancel').onclick = () => close(false);
  });
}

function getExportScale() {
  const q = localStorage.getItem('dnd_export_quality') || 'standard';
  return { draft: 1.5, standard: 2, high: 3 }[q] || 2;
}

const rarityLabels = {
  'common': 'Common',
  'uncommon': 'Uncommon',
  'rare': 'Rare',
  'very-rare': 'Very Rare',
  'legendary': 'Legendary',
  'artifact': 'Artifact',
  'unique': 'Unique'
};

const rarityIcons = {
  'common': '○',
  'uncommon': '◇',
  'rare': '◆',
  'very-rare': '❖',
  'legendary': '★',
  'artifact': '✦',
  'unique': '◈'
};

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
function _applyStatShrink(node) {
  node.querySelectorAll('.stat-value').forEach(el => _shrinkToFit(el, 0.82, 0.55));
  node.querySelectorAll('.side-stat-value').forEach(el => _shrinkToFit(el, 0.72, 0.55));
  const subtype = node.querySelector('.card-subtype');
  if (subtype) _shrinkToFit(subtype, 0.65, 0.5);
}

// ── LIVE SYNC ──
function syncCard() {
  if (!_applyingState) setDirty(true);
  const name    = $('itemName').value || 'Unnamed Item';

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
  _shrinkToFit($('previewSubtype'), 0.65, 0.5);
  $('previewBonus').textContent  = bonus  || '—';
  $('previewDamage').textContent = damage || '—';
  $('previewWeight').textContent = weight || '—';
  _shrinkToFit($('previewBonus'),  0.82, 0.55);
  _shrinkToFit($('previewDamage'), 0.82, 0.55);
  _shrinkToFit($('previewWeight'), 0.82, 0.55);
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
  // Calculated: card 580px − header/divider/image-wrap/stats/footer ≈ 275px available,
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
    cardContent.style.minHeight = '580px';
    cardContent.style.overflow  = 'visible';
    $('itemCard').style.minHeight = cardContent.scrollHeight + 'px';
  } else {
    cardContent.style.height    = '580px';
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
  if (saveVal)  { $('previewSave').textContent  = saveVal;  $('previewSaveLabel').textContent  = $('saveLabel').value  || 'Save';  _shrinkToFit($('previewSave'),  0.82, 0.55); }
  if (rangeVal) { $('previewRange').textContent = rangeVal; $('previewRangeLabel').textContent = $('rangeLabel').value || 'Range'; _shrinkToFit($('previewRange'), 0.82, 0.55); }

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

// ── IMAGE COMPRESSION ──
// TODO: Consider migrating image storage from localStorage to IndexedDB in future.
// localStorage is limited to ~5MB in Firefox, and a single base64-encoded image can
// easily be 1–2MB, meaning only 2–3 image cards can be stored before hitting the limit.
// IndexedDB has no practical size limit and stores binary data natively (no base64 overhead),
// making it far better suited for image-heavy use. Card metadata could remain in localStorage
// while images are keyed by card ID in an IndexedDB object store. JSON export/import would
// need updating to embed/extract images separately from the state object.
// Mild: 800px / 0.85  — noticeable reduction, best quality
// Standard: 500px / 0.75 — balanced (default)
// Aggressive: 300px / 0.65 — maximum storage savings
// Background: larger dimensions needed — card renders up to 1140×1740px at 3× export
// Item image: shown in a circle max 160px — much smaller targets are fine
const COMPRESS_LEVELS = {
  bg: {
    mild:       { maxDim: 1600, quality: 0.85 },
    standard:   { maxDim: 1000, quality: 0.80 },
    aggressive: { maxDim:  700, quality: 0.75 },
  },
  item: {
    mild:       { maxDim: 800, quality: 0.85 },
    standard:   { maxDim: 500, quality: 0.75 },
    aggressive: { maxDim: 300, quality: 0.65 },
  },
};
// type: 'bg' or 'item'
function getCompressLevel(type) {
  const key   = type === 'bg' ? 'dnd_compress_bg_level' : 'dnd_compress_item_level';
  const level = localStorage.getItem(key) || 'standard';
  return (COMPRESS_LEVELS[type] || COMPRESS_LEVELS.item)[level]
      || (COMPRESS_LEVELS[type] || COMPRESS_LEVELS.item).standard;
}
function compressImage(dataUrl, type) {
  const { maxDim, quality } = getCompressLevel(type);
  return new Promise(resolve => {
    const img = new Image();
    img.onerror = () => resolve(dataUrl);
    img.onload = () => {
      const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
      if (scale >= 1) { resolve(dataUrl); return; }
      const w = Math.round(img.width  * scale);
      const h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.src = dataUrl;
  });
}

function showLargeImageModal(sizeKb) {
  return new Promise(resolve => {
    const mb = (sizeKb / 1024).toFixed(1);
    const close = val => { $('largeImageModal').classList.remove('active'); resolve(val); };
    $('largeImageMsg').innerHTML =
      `This image is <strong>${mb} MB</strong>. Large images can fill up your browser\'s storage quickly — a few cards at this size may hit the limit.<br><br>` +
      `<strong>Enable & Upload</strong> will turn on image compression, scale this image down to 500px, and convert it to JPEG. Note: transparent backgrounds in PNGs will be lost.`;
    $('largeImageEnable').textContent = 'Enable & Upload';
    $('largeImageEnable').onclick = () => close('compress');
    $('largeImageRaw').onclick    = () => close('raw');
    $('largeImageCancel').onclick = () => close(false);
    $('largeImageModal').classList.add('active');
  });
}

// ── IMAGE UPLOADS ──
function bindUpload(inputId, previewId, zoneId, clearBtnId, onLoad, options = {}) {
  const { warnKb = 0, imageType = 'item' } = options;
  const input = $(inputId), preview = $(previewId), zone = $(zoneId), clearBtn = $(clearBtnId);
  input.addEventListener('change', async e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async ev => {
      let src = ev.target.result;
      const fileSizeKb = file.size / 1024;
      const compressOn = !!($('compressImagesToggle') && $('compressImagesToggle').checked);

      let shouldCompress = compressOn;
      if (warnKb && fileSizeKb >= warnKb && !compressOn) {
        const result = await showLargeImageModal(fileSizeKb);
        if (!result) { input.value = ''; return; }
        if (result === 'compress') {
          shouldCompress = true;
          // User chose "Enable & Upload" — turn the setting on for future uploads too
          $('compressImagesToggle').checked = true;
          localStorage.setItem('dnd_compress_images', 'true');
          const lr = $('compressLevelRow');
          if (lr) {
            lr.style.setProperty('--compress-opt-opacity', '1');
            lr.style.setProperty('--compress-opt-events', 'auto');
          }
        }
      }

      if (shouldCompress) src = await compressImage(src, imageType);

      preview.src = src;
      zone.classList.add('has-image');
      clearBtn.style.display = 'inline-block';
      if (onLoad) onLoad(src);
    };
    reader.readAsDataURL(file);
  });
  clearBtn.addEventListener('click', () => {
    input.value = '';
    preview.src = '';
    zone.classList.remove('has-image');
    clearBtn.style.display = 'none';
    if (onLoad) onLoad(null);
  });
}

bindUpload('bgUpload','bgPreview','bgZone','clearBg', src => {
  $('cardBgImg').style.backgroundImage = src ? `url('${src}')` : '';
  $('bgOpacityRow').style.display = src ? 'block' : 'none';
  setDirty(true);
  scheduleAutoSave();
}, { warnKb: 2000, imageType: 'bg' });

bindUpload('itemImgUpload','itemImgPreview','itemImgZone','clearItem', src => {
  const img = $('cardItemImg');
  const placeholder = $('imgPlaceholder');
  if (src) {
    img.onload = () => {
      itemImgNaturalW = img.naturalWidth;
      itemImgNaturalH = img.naturalHeight;
      itemImgX = 0; itemImgY = 0; itemImgScale = 1;
      if ($('itemImgZoom')) $('itemImgZoom').value = 1;
      updateItemImageTransform();
      showCropControls(true);
      setDirty(true);
      scheduleAutoSave();
    };
    img.src = src;
    img.style.display = 'block';
    placeholder.style.display = 'none';
  } else {
    img.src = ''; img.style.display = 'none'; img.style.transform = '';
    placeholder.style.display = 'block';
    itemImgX = 0; itemImgY = 0; itemImgScale = 1;
    itemImgNaturalW = 0; itemImgNaturalH = 0;
    showCropControls(false);
    setDirty(true);
    scheduleAutoSave();
  }
}, { warnKb: 2000 });

// ── SCALE SLIDER ──
function applyCardScale(val) {
  $('scaleLabel').textContent = val + '%';
  $('itemCard').style.transform = `scale(${val/100})`;
  $('itemCard').style.transformOrigin = 'top center';
  // Use the card's actual rendered height so oversized text is always accounted for.
  // transform: scale() doesn't affect layout flow, so we must set the wrapper height
  // explicitly to (cardHeight × scale) to keep content below the card in position.
  const cardH = $('itemCard').offsetHeight || 380;
  $('cardScaleWrap').style.height = Math.round(cardH * val / 100 + 20) + 'px';
  const persistEl = $('persistScaleToggle');
  if (persistEl && persistEl.checked) localStorage.setItem('dnd_card_scale', val);
}
$('scaleSlider').addEventListener('input', () => applyCardScale($('scaleSlider').value));

// Keep the wrapper height in sync whenever the card's content changes height
// (e.g. oversized text toggle causes the card to grow/shrink).
new ResizeObserver(() => applyCardScale($('scaleSlider').value))
  .observe($('itemCard'));

// Reset to 100% on every load so slider and card are always in sync
$('scaleSlider').value = 100;
applyCardScale(100);

// ── VIGNETTE POST-PROCESS ──
// html2canvas mis-renders CSS radial-gradient on .card-vignette.
// We skip that element during capture and redraw it precisely here instead.
// Replicates: radial-gradient(ellipse at center, transparent 40%, rgba(0,0,0,0.45) 100%)
function applyCardVignette(canvas) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width, h = canvas.height;
  ctx.save();
  ctx.translate(w / 2, h / 2);
  ctx.scale(w / 2, h / 2); // unit space: card corners at (±1, ±1)
  const g = ctx.createRadialGradient(0, 0, 0.4, 0, 0, 1);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(0,0,0,0.45)');
  ctx.fillStyle = g;
  ctx.fillRect(-1, -1, 2, 2);
  ctx.restore();
}

// ── EXPORT PNG ──
async function exportCurrentPng() {
  const state = collectCurrentState();
  const canvas = await renderStateToCanvas(state);
  const link = document.createElement('a');
  link.download = buildExportFilename(state);
  link.href = canvas.toDataURL('image/png');
  link.click();
}

$('exportPng').addEventListener('click', async () => {
  try { await exportCurrentPng(); }
  catch(e) { showInfoModal('Export Failed', 'Export failed. If you used external images, try uploading them directly.'); }
});

$('exportPngInline').addEventListener('click', async () => {
  try { await exportCurrentPng(); }
  catch(e) { showInfoModal('Export Failed', 'Export failed. If you used external images, try uploading them directly.'); }
});

// ── PRINT (single current item) ──
$('exportPrint').addEventListener('click', async () => {
  showProgress('Preparing print…');
  updateProgress(0, 1, 'Rendering card…');
  try {
    const state = collectCurrentState();
    const canvas = await renderStateToCanvas(state);
    const dataUrl = canvas.toDataURL('image/png');
    updateProgress(1, 1, 'Opening print dialog…');
    await new Promise(r => setTimeout(r, 150));
    hideProgress();
    printImagesInPopup([{ url: dataUrl, oversized: !!state.allowOversized }], 'single');
  } catch(e) {
    hideProgress();
    showInfoModal('Print Failed', 'Print failed: ' + e.message);
  }
});

// ── SHARED: build a card DOM node from a saved state ──
function buildCardNode(s) {
  const wrap = document.createElement('div');
  wrap.className = 'item-card';
  const radius = s.squareCorners ? '0' : '8px';
  const wrapOverflow = s.allowOversized ? 'visible' : 'hidden';
  wrap.style.cssText = `width:380px;min-height:580px;position:relative;border-radius:${radius};overflow:${wrapOverflow};flex-shrink:0;`;

  // bg colour layer
  const bg = document.createElement('div');
  bg.className = 'card-bg';
  bg.style.backgroundColor = s.cardColor || '#d4b87a';

  // bg image layer (separate so opacity is independent of colour)
  const bgImg = document.createElement('div');
  bgImg.className = 'card-bg-img';
  if (s.bgImage) {
    bgImg.style.backgroundImage = `url('${s.bgImage}')`;
    bgImg.style.opacity = s.bgOpacity ?? 1;
  }

  const texture = document.createElement('div');
  texture.className = 'card-texture';

  const vignette = document.createElement('div');
  vignette.className = 'card-vignette';

  const frame = document.createElement('div');
  frame.className = 'card-frame';
  frame.style.display = s.showFrame === false ? 'none' : 'block';
  frame.innerHTML = '<div class="card-frame-inner"></div><div class="card-frame-ornament"></div>';

  // attunement text
  const attuneText = _resolveAttunement(s.attunement, s.attunementCustom);

  const rarityLabel = rarityLabels[s.rarity] || s.rarity || '';
  const rarityIcon  = rarityIcons[s.rarity]  || '◆';
  const inkCol      = s.inkColor || '#2c1a0e';

  const bonus  = s.bonus  || '—';
  const damage = s.damage || '—';
  const weight = s.weight || '—';

  const bonusLbl  = s.bonusLabel  || 'Bonus';
  const damageLbl = s.damageLabel || 'Damage';
  const weightLbl = s.weightLabel || 'Weight';
  const saveLbl   = s.saveLabel   || 'Save';
  const rangeLbl  = s.rangeLabel  || 'Range';

  const C = s.circleSize || 110;
  const circleBorder = s.circleBorderColor && /^#[0-9a-fA-F]{6}$/.test(s.circleBorderColor)
    ? s.circleBorderColor : 'rgba(90,60,30,0.45)';
  const rarityColorStyle = s.rarityColor && /^#[0-9a-fA-F]{6}$/.test(s.rarityColor)
    ? `color:${s.rarityColor};border-color:${s.rarityColor};` : '';
  let itemImgHtml;
  if (s.itemImage) {
    const nw = s.imgNaturalW || C;
    const nh = s.imgNaturalH || C;
    const coverScale = Math.max(C / nw, C / nh);
    const total = coverScale * (s.imageScale || 1);
    const baseX = (C - nw * total) / 2;
    const baseY = (C - nh * total) / 2;
    const tx = baseX + (s.imageOffsetX || 0);
    const ty = baseY + (s.imageOffsetY || 0);
    itemImgHtml = `<img src="${s.itemImage}" alt="" style="position:absolute;left:0;top:0;width:${nw}px;height:${nh}px;transform-origin:0 0;transform:translate(${tx}px,${ty}px) scale(${total});display:block;">`;
  } else {
    const defaultToggle = $('defaultTypeImgToggle');
    const defaultSrc = (defaultToggle && defaultToggle.checked) ? getTypeDefaultSrc(s.type) : null;
    if (defaultSrc) {
      const size = Math.round(C * 0.78);
      const off  = Math.round((C - size) / 2);
      itemImgHtml = `<img src="${defaultSrc}" alt="" style="position:absolute;left:${off}px;top:${off}px;width:${size}px;height:${size}px;object-fit:contain;display:block;">`;
    } else {
      itemImgHtml = `<div class="card-image-placeholder" style="color:rgba(90,60,30,0.4);font-size:2.5rem;">⚔</div>`;
    }
  }

  const statsDisplay = s.showStats === false ? 'none' : 'flex';
  const showImg      = s.showImage !== false;
  const imageDisplay = showImg ? 'flex' : 'none';
  const imageWrapDisplay = (showImg || !!s.savingThrow || !!s.range) ? 'grid' : 'none';

  const sideStatStyle = `text-align:center;padding:0 6px;`;
  const sideStatLabelStyle = `font-family:Cinzel,serif;font-size:0.5rem;letter-spacing:0.12em;color:${inkCol};opacity:0.75;text-transform:uppercase;display:block;`;
  const sideStatValueStyle = `font-family:Cinzel,serif;font-size:0.72rem;font-weight:700;color:${inkCol};display:block;margin-top:3px;line-height:1.3;`;

  const saveHtml  = s.savingThrow
    ? `<div style="${sideStatStyle}"><span style="${sideStatLabelStyle}">${saveLbl}</span><span class="side-stat-value" style="${sideStatValueStyle}">${s.savingThrow}</span></div>`
    : `<div></div>`;
  const rangeHtml = s.range
    ? `<div style="${sideStatStyle}"><span style="${sideStatLabelStyle}">${rangeLbl}</span><span class="side-stat-value" style="${sideStatValueStyle}">${s.range}</span></div>`
    : `<div></div>`;

  const descHtml = typeof marked !== 'undefined' ? marked.parse(s.description || '', { breaks: true }) : (s.description || '');

  const content = document.createElement('div');
  content.className = 'card-content';
  const contentOverride = s.allowOversized ? 'height:auto;overflow:visible;' : 'height:580px;overflow:hidden;';
  content.style.cssText = `position:relative;z-index:2;padding:0;display:flex;flex-direction:column;min-height:580px;${contentOverride}`;
  content.innerHTML = `
    <div class="card-header" style="padding:18px 20px 10px;text-align:center;">
      <div class="card-item-name" style="font-family:Cinzel,serif;font-size:1.15rem;font-weight:700;line-height:1.2;color:${inkCol};letter-spacing:0.04em;">${s.name || 'Unnamed Item'}</div>
      <div class="card-subtype" style="font-family:Cinzel,serif;font-size:0.65rem;color:${inkCol};letter-spacing:0.12em;text-transform:uppercase;margin-top:3px;opacity:0.85;">${s.type ? (s.subtype ? `${s.type} • ${s.subtype}` : s.type) : (s.subtype || '')}</div>
      <div class="card-rarity rarity-${s.rarity}" style="display:block;text-align:center;font-family:Cinzel,serif;font-size:0.6rem;line-height:1;letter-spacing:0.14em;text-transform:uppercase;padding:2px 0;${rarityColorStyle}">${rarityIcon} ${rarityLabel} ${rarityIcon}</div>
    </div>
    <div class="card-divider"><span class="divider-gem"></span></div>
    <div class="card-image-wrap" style="display:${imageWrapDisplay};grid-template-columns:1fr 1fr 1fr;align-items:center;padding:10px 20px;min-height:130px;">
      ${saveHtml}
      <div class="card-image-container" style="width:${C}px;height:${C}px;border-radius:50%;border:2px solid ${circleBorder};overflow:hidden;background:rgba(90,60,30,0.12);display:${imageDisplay};align-items:center;justify-content:center;grid-column:2;">
        ${itemImgHtml}
      </div>
      ${rangeHtml}
    </div>
    <div class="card-stats" style="display:${statsDisplay};justify-content:center;gap:0;padding:4px 20px;">
      <div class="card-stat" style="text-align:center;padding:3px 12px;border-right:1px solid rgba(90,60,30,0.3);flex:1;">
        <span class="stat-label" style="font-family:Cinzel,serif;font-size:0.52rem;letter-spacing:0.12em;color:${inkCol};opacity:0.75;text-transform:uppercase;display:block;">${bonusLbl}</span>
        <span class="stat-value" style="font-family:Cinzel,serif;font-size:0.82rem;font-weight:700;color:${inkCol};display:block;margin-top:1px;">${bonus}</span>
      </div>
      <div class="card-stat" style="text-align:center;padding:3px 12px;border-right:1px solid rgba(90,60,30,0.3);flex:1;">
        <span class="stat-label" style="font-family:Cinzel,serif;font-size:0.52rem;letter-spacing:0.12em;color:${inkCol};opacity:0.75;text-transform:uppercase;display:block;">${damageLbl}</span>
        <span class="stat-value" style="font-family:Cinzel,serif;font-size:0.82rem;font-weight:700;color:${inkCol};display:block;margin-top:1px;">${damage}</span>
      </div>
      <div class="card-stat" style="text-align:center;padding:3px 12px;flex:1;">
        <span class="stat-label" style="font-family:Cinzel,serif;font-size:0.52rem;letter-spacing:0.12em;color:${inkCol};opacity:0.75;text-transform:uppercase;display:block;">${weightLbl}</span>
        <span class="stat-value" style="font-family:Cinzel,serif;font-size:0.82rem;font-weight:700;color:${inkCol};display:block;margin-top:1px;">${weight}</span>
      </div>
    </div>
    <div class="card-divider"><span class="divider-gem"></span></div>
    <div class="card-body" style="padding:8px 20px 16px;${s.allowOversized ? 'flex:none;height:auto;overflow:visible;' : 'flex:1;'}">
      <div class="card-description" style="font-family:'Crimson Pro',Georgia,serif;font-size:0.87rem;line-height:1.5;color:${inkCol};">${descHtml}</div>
    </div>
    ${attuneText ? `<div class="card-attunement" style="margin:0 16px 4px;text-align:center;font-family:'Crimson Pro',serif;font-style:italic;font-size:0.75rem;color:${inkCol};opacity:0.85;padding-top:4px;border-top:1px solid rgba(90,60,30,0.2);">${attuneText}</div>` : ''}
    <div class="card-footer" style="padding:8px 18px 14px;text-align:center;">
      <div style="font-family:Cinzel,serif;font-size:0.55rem;letter-spacing:0.1em;color:rgba(44,26,14,0.45);text-transform:uppercase;">${s.showCollection !== false ? (getCollectionById(s.collectionId)?.name || '') : ''}</div>
    </div>
  `;

  wrap.appendChild(bg);
  wrap.appendChild(bgImg);
  wrap.appendChild(texture);
  wrap.appendChild(vignette);
  wrap.appendChild(frame);
  wrap.appendChild(content);
  return wrap;
}

// ── SHARED: render a state to a canvas via html2canvas ──
async function renderStateToCanvas(s) {
  const offscreen = $('offscreenRender');
  const node = buildCardNode(s);
  // Must be visible in the DOM for html2canvas — opacity:0 wrapper hides it from user
  offscreen.appendChild(node);
  _applyStatShrink(node);

  // Wait for all images inside the node to fully load/decode
  const imgs = Array.from(node.querySelectorAll('img'));
  await Promise.all(imgs.map(img => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise(res => {
      img.onload  = res;
      img.onerror = res; // resolve even on error so we don't hang
    });
  }));
  // Extra frame for layout to settle
  await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

  node.style.boxShadow = 'none';

  const canvas = await html2canvas(node, {
    scale: getExportScale(),
    useCORS: true,
    allowTaint: true,
    backgroundColor: null,
    logging: false,
    imageTimeout: 15000,
    ignoreElements: el => el.classList.contains('card-vignette') || el.classList.contains('img-drag-hint') || el.classList.contains('img-upload-hint'),
    onclone: (doc, el) => {
      el.style.boxShadow = 'none';
      // Strip any images whose src is not a data URL (e.g. file:// paths that
      // result from canvas.toDataURL() failing in local/private-mode testing).
      // This only affects the render clone — the live card on screen is untouched.
      // On production (https://) all item images are data URLs so this is a no-op.
      el.querySelectorAll('img').forEach(img => {
        if (img.src && !img.src.startsWith('data:')) {
          img.src = '';
          img.style.display = 'none';
        }
      });
    }
  });
  applyCardVignette(canvas);
  offscreen.removeChild(node);
  return canvas;
}

// ── PROGRESS HELPERS ──
let _exportCancelled = false;
$('progressCancelBtn').addEventListener('click', () => { _exportCancelled = true; });

function showProgress(title, cancellable = false) {
  _exportCancelled = false;
  $('progressTitle').textContent = title;
  $('progressFill').style.width = '0%';
  $('progressLabel').textContent = 'Preparing…';
  $('progressCancelBtn').style.display = cancellable ? 'block' : 'none';
  $('progressOverlay').classList.add('active');
}
function updateProgress(done, total, label) {
  $('progressFill').style.width = Math.round((done / total) * 100) + '%';
  $('progressLabel').textContent = label;
}
function hideProgress() {
  $('progressOverlay').classList.remove('active');
  $('progressCancelBtn').style.display = 'none';
  _exportCancelled = false;
}

// ── POPUP PRINT (used by both single and all) ──
// Opens a clean popup window containing only card images, then prints it.
// Because the popup contains nothing but <img> tags on a white page,
// no browser CSS stripping can affect the output — colours are baked into the PNGs.
//
// entries: array of { url, oversized } objects.
// Normal cards: A4 portrait 3×3 grid, each cell 63mm × 88mm.
// If any card is oversized: one card per page, 63mm wide, full height — no grid.
function printImagesInPopup(entries, mode) {
  // A4 portrait = 210mm × 297mm
  // 3 cols × 63mm + 2 × 1mm gap = 191mm  →  side margin = (210 - 191) / 2 = 9.5mm
  // 3 rows × 88mm + 2 × 1mm gap = 266mm  →  top margin  = (297 - 266) / 2 = 15.5mm
  const hasOversized = entries.some(e => e.oversized);

  let pagesHTML, css;

  if (hasOversized) {
    // One card per page, full height — no grid constraint
    pagesHTML = entries.map(({ url }, i) => {
      const pageLabel = entries.length > 1 ? ` &bull; Card ${i + 1} of ${entries.length}` : '';
      return `<div class="page">
  <div class="print-header">Made with the Artifex Arcanum &bull; https://deadpoodle.github.io/itemgenerator${pageLabel}</div>
  <div class="card-wrap"><img src="${url}"></div>
</div>`;
    }).join('\n');

    css = `
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0; padding: 0; background: white; }
    .page {
      width: 210mm;
      break-after: page;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding-bottom: 6mm;
    }
    .page:last-child { break-after: avoid; }
    .print-header {
      font-family: Georgia, serif;
      font-size: 7pt;
      color: #aaa;
      text-align: center;
      padding: 6mm 0 2mm;
      width: 100%;
    }
    .card-wrap { width: 63mm; }
    .card-wrap img { width: 63mm; height: auto; display: block; }
  `;
  } else {
    // Normal 3×3 grid layout
    const PER_PAGE = 9;
    const totalPages = Math.max(1, Math.ceil(entries.length / PER_PAGE));

    pagesHTML = Array.from({ length: totalPages }, (_, p) => {
      const pageEntries = entries.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
      const slots = Array.from({ length: PER_PAGE }, (_, i) =>
        pageEntries[i]
          ? `<div class="card-cell"><img src="${pageEntries[i].url}"></div>`
          : `<div class="card-cell"></div>`
      ).join('');
      const pageLabel = totalPages > 1 ? ` &bull; Page ${p + 1} of ${totalPages}` : '';
      return `<div class="page">
  <div class="print-header">Made with the Artifex Arcanum &bull; https://deadpoodle.github.io/itemgenerator${pageLabel}</div>
  <div class="grid">${slots}</div>
</div>`;
    }).join('\n');

    css = `
    @page { size: A4 portrait; margin: 0; }
    html, body { margin: 0; padding: 0; background: white; }
    .page {
      width: 210mm;
      height: 297mm;
      overflow: hidden;
      break-after: page;
      display: flex;
      flex-direction: column;
      align-items: center;
    }
    .page:last-child { break-after: avoid; }
    .print-header {
      font-family: Georgia, serif;
      font-size: 7pt;
      color: #aaa;
      text-align: center;
      padding: 6mm 0 2mm;
      width: 100%;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, 63mm);
      grid-template-rows: repeat(3, 88mm);
      gap: 1mm;
      width: 191mm;
      height: 266mm;
      margin: auto;
    }
    .card-cell {
      width: 63mm;
      height: 88mm;
      display: flex;
      align-items: center;
      justify-content: center;
      overflow: hidden;
      background: white;
    }
    .card-cell img {
      width: 100%;
      height: 100%;
      display: block;
      object-fit: contain;
    }
  `;
  }

  const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<title>Print Magic Items</title>
<style>
  * { box-sizing: border-box; margin: 0; padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important; }
  ${css}
</style>
</head>
<body>
${pagesHTML}
<script>
  var imgs = document.querySelectorAll('img');
  var total = imgs.length;
  var loaded = 0;
  function tryPrint() { loaded++; if (loaded >= total) { setTimeout(function(){ window.print(); }, 250); } }
  if (total === 0) { setTimeout(function(){ window.print(); }, 250); }
  else { imgs.forEach(function(img){ if (img.complete && img.naturalWidth > 0) { tryPrint(); } else { img.onload = tryPrint; img.onerror = tryPrint; } }); }
<\/script>
</body>
</html>`;

  const popup = window.open('', '_blank', 'width=820,height=1000');
  if (!popup) {
    showInfoModal('Pop-up Blocked', 'Pop-ups are blocked — please allow pop-ups for this page and try again.');
    return;
  }
  popup.document.open();
  popup.document.write(html);
  popup.document.close();
}

// ── DOWNLOAD SELECTION ──
(function () {
  function updatePngSelectUI() {
    const checked = $('pngSelectList').querySelectorAll('input[type="checkbox"][value]:checked').length;
    $('pngSelectConfirm').textContent = `⬇ Download Selected (${checked})`;
    $('pngSelectConfirm').disabled = checked === 0;
  }

  // When quality changes in modal → update localStorage + all other quality UI
  document.querySelectorAll('input[name="pngModalQuality"]').forEach(radio => {
    radio.addEventListener('change', () => {
      if (!radio.checked) return;
      localStorage.setItem('dnd_export_quality', radio.value);
      syncAllQualityUI(radio.value);
    });
  });

  $('pngSelectionBtn').addEventListener('click', () => {
    if (!getHistory().length) { showInfoModal('No Saved Items', 'No saved cards in history yet.'); return; }
    syncAllQualityUI(localStorage.getItem('dnd_export_quality') || 'standard');
    buildSelectionList($('pngSelectList'), updatePngSelectUI);
    updatePngSelectUI();
    $('pngSelectModal').classList.add('active');
  });

  $('pngSelectAll').addEventListener('click', () => {
    $('pngSelectList').querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    updatePngSelectUI();
  });

  $('pngSelectNone').addEventListener('click', () => {
    $('pngSelectList').querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    updatePngSelectUI();
  });

  $('pngSelectCancel').addEventListener('click', () => {
    $('pngSelectModal').classList.remove('active');
  });

  $('pngSelectConfirm').addEventListener('click', async () => {
    $('pngSelectModal').classList.remove('active');

    const selectedIds = new Set(
      [...$('pngSelectList').querySelectorAll('input[type="checkbox"]:checked')]
        .map(cb => parseInt(cb.value, 10))
    );
    const items = getHistory().filter(h => selectedIds.has(h.id));
    if (!items.length) return;

    showProgress('Rendering items…', true);
    let exportedCount = 0;
    for (let i = 0; i < items.length; i++) {
      if (_exportCancelled) break;
      const item = items[i];
      updateProgress(i, items.length, `Rendering "${item.name || 'Unnamed'}" (${i + 1}/${items.length})…`);
      try {
        const canvas = await renderStateToCanvas(item);
        if (_exportCancelled) break;
        const link = document.createElement('a');
        link.download = buildExportFilename(item);
        link.href = canvas.toDataURL('image/png');
        link.click();
        exportedCount++;
        await new Promise(r => setTimeout(r, 400));
      } catch (e) {
        console.error('Failed to render', item.name, e);
      }
    }
    if (_exportCancelled) {
      updateProgress(exportedCount, items.length, `Cancelled — ${exportedCount} of ${items.length} downloaded.`);
      await new Promise(r => setTimeout(r, 1200));
    } else {
      updateProgress(items.length, items.length, 'Done!');
      await new Promise(r => setTimeout(r, 600));
    }
    hideProgress();
  });
})();

// ── PRINT ALL (A4 landscape, popup window) ──
// ── PRINT SELECTION ──
(function () {
  function updatePrintSelectUI() {
    const checked = $('printSelectList').querySelectorAll('input[type="checkbox"][value]:checked').length;
    const pages = Math.max(1, Math.ceil(checked / 9));
    $('printSelectConfirm').textContent = `🖨 Print Selected (${checked})`;
    $('printSelectConfirm').disabled = checked === 0;
    $('printSelectPageHint').textContent = checked > 0
      ? `${pages} page${pages !== 1 ? 's' : ''}`
      : '';
  }

  $('printSelectionBtn').addEventListener('click', () => {
    if (!getHistory().length) { showInfoModal('No Saved Items', 'No saved cards in history yet.'); return; }
    buildSelectionList($('printSelectList'), updatePrintSelectUI);
    updatePrintSelectUI();
    $('printSelectModal').classList.add('active');
  });

  $('printSelectAll').addEventListener('click', () => {
    $('printSelectList').querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
    updatePrintSelectUI();
  });

  $('printSelectNone').addEventListener('click', () => {
    $('printSelectList').querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
    updatePrintSelectUI();
  });

  $('printSelectCancel').addEventListener('click', () => {
    $('printSelectModal').classList.remove('active');
  });

  $('printSelectConfirm').addEventListener('click', async () => {
    $('printSelectModal').classList.remove('active');

    const selectedIds = new Set(
      [...$('printSelectList').querySelectorAll('input[type="checkbox"]:checked')]
        .map(cb => parseInt(cb.value, 10))
    );
    const items = getHistory().filter(h => selectedIds.has(h.id));
    if (!items.length) return;

    showProgress('Preparing print sheet…', true);
    const printEntries = [];

    for (let i = 0; i < items.length; i++) {
      if (_exportCancelled) break;
      updateProgress(i, items.length, `Rendering "${items[i].name || 'Unnamed'}" (${i + 1}/${items.length})…`);
      try {
        const canvas = await renderStateToCanvas(items[i]);
        if (_exportCancelled) break;
        printEntries.push({ url: canvas.toDataURL('image/png'), oversized: !!items[i].allowOversized });
      } catch (e) {
        console.error('Failed to render', items[i].name, e);
      }
    }

    if (_exportCancelled) {
      updateProgress(printEntries.length, items.length, `Cancelled — ${printEntries.length} of ${items.length} rendered.`);
      await new Promise(r => setTimeout(r, 1200));
      hideProgress();
    } else {
      updateProgress(items.length, items.length, 'Opening print dialog…');
      await new Promise(r => setTimeout(r, 200));
      hideProgress();
      printImagesInPopup(printEntries, 'all');
    }
  });
})();

// ── EXPORT JSON ──
$('exportJsonBtn').addEventListener('click', () => {
  const saved   = getHistory();
  const payload = { version: 2, collections: collectionsForCards(saved), items: saved };
  const blob    = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  const now     = new Date();
  const stamp   = now.toISOString().slice(0,19).replace('T','-').replace(/:/g,'-');
  a.download    = `dnd-items-${stamp}.json`;
  a.click();
  URL.revokeObjectURL(url);
});

// ── TRIM HISTORY MODAL ──
function hideTrimModal() {
  $('trimHistoryModal').classList.remove('active');
  $('trimHistoryConfirm').onclick = null;
  $('trimHistoryCancel').onclick = null;
}
function showTrimModal(newMax, wouldTrim, onConfirm, onCancel) {
  const s = wouldTrim !== 1 ? 's' : '';
  $('trimHistoryMsg').innerHTML =
    `Reducing your limit to <strong>${newMax}</strong> will permanently remove your oldest <strong>${wouldTrim} card${s}</strong>. This cannot be undone.`;
  $('trimHistoryConfirm').textContent = `Remove ${wouldTrim} card${s}`;
  $('trimHistoryConfirm').onclick = () => { hideTrimModal(); onConfirm(); };
  $('trimHistoryCancel').onclick  = () => { hideTrimModal(); onCancel();  };
  $('trimHistoryModal').classList.add('active');
}
// Cancel button wired via onclick inside showTrimModal — no duplicate listener needed

// ── IMPORT JSON ──
function hideImportOverflowModal() {
  $('importOverflowModal').classList.remove('active');
  $('importOverflowExpand').onclick = null;
  $('importOverflowContinue').onclick = null;
  $('importOverflowCancel').onclick = null;
}

$('importOverflowCancel').addEventListener('click', hideImportOverflowModal);

$('importJsonBtn').addEventListener('click', () => {
  $('importJsonFile').value = '';
  $('importJsonFile').click();
});

$('importJsonFile').addEventListener('change', e => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const data = JSON.parse(ev.target.result);
      // Accept either the { version, items } envelope or a bare array
      const incoming = (Array.isArray(data) ? data : (data.items || []))
                         .filter(item => item && typeof item === 'object');
      const sharedCollections = Array.isArray(data) ? [] : (data.collections || []);
      if (!incoming.length) { showInfoModal('Nothing to Import', 'No items found in that JSON file.'); return; }

      const existing = getHistory();

      // Deduplicate: skip cards whose content already exists in the collection
      const { newCards, skipCount } = _deduplicateCards(incoming, existing);

      if (!newCards.length) {
        const s = incoming.length !== 1 ? 's' : '';
        showInfoModal('Nothing New to Import',
          `All ${incoming.length} card${s} in this file are already in your collection.`);
        return;
      }

      // Pre-compute merge shape for overflow UI (lengths unchanged by collection remapping)
      const newNames       = new Set(newCards.map(c => c.name));
      const existingToKeep = existing.filter(e => !newNames.has(e.name));
      const totalMerged    = newCards.length + existingToKeep.length;

      const s  = n => n !== 1 ? 's' : '';
      const skipNote = skipCount > 0
        ? ` (${skipCount} duplicate${s(skipCount)} skipped)` : '';

      function doImport(limit) {
        // Remap collection IDs at confirm time so collections are only created if user proceeds
        const remapped = mergeImportedCollections(sharedCollections, newCards);
        saveHistory([...remapped, ...existingToKeep].slice(0, limit));
        renderCollectionDropdown();
        renderHistoryBar();
        applyState(remapped[0]);
        showInfoModal('Import Complete',
          `Imported ${remapped.length} card${s(remapped.length)}${skipNote}.`);
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
    } catch {
      showInfoModal('Import Failed', 'Could not read that file — make sure it is a valid Artifex Arcanum JSON export.');
    }
  };
  reader.readAsText(file);
});

// ── SHARE PROVIDER UI EVENTS ──
$('connectDropboxBtn').addEventListener('click', () => connectDropbox());
$('connectGdriveBtn').addEventListener('click', () => connectGoogleDrive());
$('connectOnedriveBtn').addEventListener('click', () => {
  console.log('[share] connectOneDrive() — not yet implemented');
  showInfoModal('Coming Soon', 'OneDrive connection will be available in a future update.');
});
$('disconnectShareBtn').addEventListener('click', () => {
  clearShareConnection();
});

// ── Share selection modal ──

function updateShareSelectUI() {
  const checked = $('shareSelectList').querySelectorAll('input[type="checkbox"][value]:checked').length;
  $('shareSelectConfirm').textContent = `🔗 Share Selected (${checked})`;
  $('shareSelectConfirm').disabled = checked === 0;
}

// "Share Dropbox Link to Selection" button — opens the selection modal
$('copyShareLinkBtn').addEventListener('click', () => {
  if (!getHistory().length) { showInfoModal('No Saved Items', 'No saved cards in history yet.'); return; }
  buildSelectionList($('shareSelectList'), updateShareSelectUI);
  updateShareSelectUI();
  $('shareSelectModal').classList.add('active');
});

$('shareSelectAll').addEventListener('click', () => {
  $('shareSelectList').querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = true);
  updateShareSelectUI();
});
$('shareSelectNone').addEventListener('click', () => {
  $('shareSelectList').querySelectorAll('input[type="checkbox"]').forEach(cb => cb.checked = false);
  updateShareSelectUI();
});
$('shareSelectCancel').addEventListener('click', () => {
  $('shareSelectModal').classList.remove('active');
});

// Confirm — upload selected cards to Dropbox and copy the share link
$('shareSelectConfirm').addEventListener('click', async () => {
  $('shareSelectModal').classList.remove('active');

  const selectedIds = new Set(
    [...$('shareSelectList').querySelectorAll('input[type="checkbox"]:checked')]
      .map(cb => parseInt(cb.value, 10))
  );
  const items = getHistory().filter(h => selectedIds.has(h.id));
  if (!items.length) return;

  const btn      = $('copyShareLinkBtn');
  const feedback = $('shareLinkFeedback');
  const urlBox   = $('shareLinkUrlBox');
  btn.disabled = true;
  btn.textContent = '⏳ Uploading…';
  setShareFeedback('', '');

  try {
    const url = await shareCurrentCard(items);
    if (url) {
      // Show the URL in the text box
      urlBox.value = url;
      urlBox.style.display = 'block';
      // Auto-copy to clipboard
      await navigator.clipboard.writeText(url);
      const n = items.length;
      setShareFeedback(`✓ Link copied! (${n} card${n !== 1 ? 's' : ''})`, 'rgba(100,200,100,0.9)');
    }
  } catch (err) {
    if (err.message === 'network_error') {
      setShareFeedback('Could not reach your cloud provider — check your connection and try again.', 'rgba(220,80,80,0.9)', true);
    } else if (err.message === 'auth_expired') {
      // modal already shown by _dbx / _gdrive
    } else {
      setShareFeedback('Failed to copy link — please try again.', 'rgba(220,80,80,0.9)', true);
    }
    console.error('[share] shareSelectConfirm error:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔗 Share Link to Selection';
  }
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
  $('autoSave').checked = true;
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

function scheduleAutoSave() {
  if (!$('autoSave').checked || !activeHistoryId) return;
  clearTimeout(autoSaveTimer);
  autoSaveTimer = setTimeout(doAutoSave, 1500);
}

// ── TABS ──
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    if ($('autoSave').checked) doAutoSave();
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    $('tab-' + btn.dataset.tab).classList.add('active');
  });
});

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

// ── HISTORY ──
const HISTORY_KEY = 'dnd_item_history';
const MAX_HISTORY_DEFAULT = 25;
function getMaxHistory() {
  const v = parseInt(localStorage.getItem('dnd_max_history'), 10);
  return (isNaN(v) || v < 1) ? MAX_HISTORY_DEFAULT : v;
}

function getHistory() {
  try { return JSON.parse(localStorage.getItem(HISTORY_KEY)) || []; }
  catch { return []; }
}

function saveHistory(items) {
  try { localStorage.setItem(HISTORY_KEY, JSON.stringify(items)); }
  catch(e) {
    // Browser localStorage limit hit (typically ~5–10 MB per site).
    // Cards with uploaded images are large when base64-encoded.
    // Do NOT silently trim — that causes data loss without warning.
    showInfoModal('Storage Full',
      'Your browser\'s storage limit has been reached.<br><br>' +
      'Cards with uploaded images use a lot of space. To free up room:<br>' +
      '&bull; Export your items as JSON first (Share tab) to back them up<br>' +
      '&bull; Then delete some cards from history, or clear their images<br><br>' +
      'This save was not completed — your previous history is unchanged.'
    );
  }
}

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
  onedrive: { name: 'OneDrive',     icon: '☁'  },
};
function updateShareUI() {
  const provider = getShareProvider();
  const connected = !!provider && !!getShareToken();
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
const DROPBOX_REDIRECT   = 'https://deadpoodle.github.io/itemgenerator/oauth.html';
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
  const doFetch = token => fetch(url, {
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
const GDRIVE_REDIRECT  = 'https://deadpoodle.github.io/itemgenerator/oauth.html';
const GDRIVE_SCOPE     = 'https://www.googleapis.com/auth/drive.file';

// ── Google Drive OAuth — implicit flow (Step 13) ──
// Google's "Web application" client type requires a client_secret for the code exchange,
// which cannot be embedded in client-side JS. Implicit flow (response_type=token) returns
// the access token directly in the redirect fragment, bypassing the exchange entirely.
// Tokens expire after 1 hour; the _gdrive() wrapper handles 401s by prompting reconnect.
async function connectGoogleDrive() {
  const params = new URLSearchParams({
    client_id:     GDRIVE_CLIENT_ID,
    redirect_uri:  GDRIVE_REDIRECT,
    response_type: 'token',
    scope:         GDRIVE_SCOPE,
  });

  const popup = window.open(
    'https://accounts.google.com/o/oauth2/v2/auth?' + params,
    'gdrive_auth', 'width=600,height=720,left=200,top=100'
  );
  if (!popup) {
    showInfoModal('Popup Blocked', 'Please allow pop-ups for this page and try again.');
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
        const { access_token, error } = e.data.payload;
        if (error)         { reject(new Error(error));     return; }
        if (!access_token) { reject(new Error('no_token')); return; }
        setShareConnection('gdrive', access_token, null);
        resolve();
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
    if (err.message !== 'closed') {
      showInfoModal('Connection Failed', 'Could not connect to Google Drive — please try again.');
      console.error('[gdrive] connect error:', err);
    }
  }
}

// ── Google Drive fetch wrapper — prompts reconnect on 401 ──
async function _gdrive(url, options) {
  const token = getShareToken();
  const resp  = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: 'Bearer ' + token },
  });
  if (resp.status === 401) {
    clearShareConnection();
    showInfoModal('Google Drive Disconnected', 'Your session has expired (tokens last 1 hour). Please reconnect in Settings → Share Provider.');
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

  if (!permResp.ok) throw new Error('permission_failed: ' + permResp.status);

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
    const downloadUrl = `https://drive.google.com/uc?export=download&id=${id}`;
    // Route through the Cloudflare Worker proxy — drive.google.com/uc returns no CORS headers,
    // which blocks the fetch in Firefox and Edge.
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
  const mob = $('mobileDirtyMsg');
  if (mob) mob.style.display = val ? 'flex' : 'none';
  updateHistoryActiveClass();
  if (val) scheduleAutoSave();
}

function hideConfirmModal() {
  $('confirmModal').classList.remove('active');
  $('confirmModalOk').onclick = null;
  $('confirmModalSave').onclick = null;
  $('confirmModalCancel').onclick = null;
}

function switchToDetailsTab() {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.querySelectorAll('.tab-panel').forEach(p => p.classList.remove('active'));
  const detailsBtn = document.querySelector('.tab-btn[data-tab="identity"]');
  if (detailsBtn) detailsBtn.classList.add('active');
  $('tab-identity').classList.add('active');
}

function tryLoadItem(item) {
  const isDifferentItem = activeHistoryId !== item.id;
  if (!isDirty || !isDifferentItem) {
    if (isDifferentItem) switchToDetailsTab();
    applyState(item);
    return;
  }

  if ($('autoSave').checked) { doAutoSave(); switchToDetailsTab(); applyState(item); return; }

  $('confirmModal').classList.add('active');
  $('confirmModalOk').onclick = () => { hideConfirmModal(); switchToDetailsTab(); applyState(item); };
  $('confirmModalSave').onclick = () => {
    hideConfirmModal();
    const state = collectCurrentState();
    if (activeHistoryId) state.id = activeHistoryId;
    const hist = getHistory().filter(h => h.id !== state.id && h.name !== state.name);
    hist.unshift(state);
    saveHistory(hist.slice(0, getMaxHistory()));
    renderHistoryBar();
    setDirty(false);
    switchToDetailsTab();
    applyState(item);
  };
  $('confirmModalCancel').onclick = () => hideConfirmModal();
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
    empty.style.cssText = 'padding:0.45rem 0.9rem;font-size:0.78rem;';
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

function buildSelectionList(listEl, updateUICb) {
  const items = getHistory();
  const cols  = getCollections();
  listEl.innerHTML = '';

  // Group items
  const byCollection = new Map();
  const uncollected  = [];
  items.forEach(item => {
    if (item.collectionId && cols.find(c => c.id === item.collectionId)) {
      if (!byCollection.has(item.collectionId)) byCollection.set(item.collectionId, []);
      byCollection.get(item.collectionId).push(item);
    } else {
      uncollected.push(item);
    }
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

    const count = document.createElement('span');
    count.className = 'select-group-count';
    count.textContent = `(${groupItems.length})`;

    header.appendChild(caret);
    header.appendChild(selectToggle);
    header.appendChild(label);
    header.appendChild(count);
    listEl.appendChild(header);

    const body = document.createElement('div');
    body.className = 'select-group-body';
    listEl.appendChild(body);

    selectToggle.addEventListener('change', () => {
      body.querySelectorAll('input[type="checkbox"]').forEach(cb => { cb.checked = selectToggle.checked; });
      selectToggle.indeterminate = false;
      updateUICb();
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
    const rarityLabel = rarityLabels[item.rarity] || item.rarity;
    row.innerHTML = `<input type="checkbox" value="${item.id}" checked>
      <span class="print-select-name">${item.name || 'Unnamed'}</span>
      <span class="history-rarity rarity-${item.rarity}" style="margin-left:auto;flex-shrink:0;">${rarityLabel}</span>`;
    row.querySelector('input').addEventListener('change', () => {
      if (groupToggle) syncGroupToggle(groupToggle, body);
      updateUICb();
    });
    (body || listEl).appendChild(row);
  }

  // Render collections first
  cols.forEach(col => {
    const group = byCollection.get(col.id);
    if (!group || group.length === 0) return;
    const { body, selectToggle } = addGroupHeader(col.name, group);
    group.forEach(item => addItemRow(item, true, body, selectToggle));
  });

  // Uncollected at bottom
  if (uncollected.length > 0) {
    const hasGroups = byCollection.size > 0;
    if (hasGroups) {
      const { body, selectToggle } = addGroupHeader('Uncollected', uncollected);
      uncollected.forEach(item => addItemRow(item, true, body, selectToggle));
    } else {
      uncollected.forEach(item => addItemRow(item, false, null, null));
    }
  }
}

function renderHistoryBar() {
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
    const el = document.createElement('div');
    el.className = 'history-item';
    el.dataset.historyId = item.id;
    el.title = `Load: ${item.name || 'Unnamed Item'}`;

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
        if (updated.length > 0) {
          applyState(updated[0]);
        } else {
          activeHistoryId = null;
          applyState(getNewCardState());
        }
      }
      renderHistoryBar();
    });

    const barMark = document.createElement('span');
    barMark.className = 'item-dirty-mark';
    barMark.textContent = '*';
    barMark.style.display = 'none';

    el.appendChild(makeHistoryThumb(item));
    el.appendChild(meta);
    el.appendChild(barMark);
    el.appendChild(del);
    el.addEventListener('click', () => { tryLoadItem(item); requestAnimationFrame(scrollHistoryActiveToCenter); });
    container.appendChild(el);

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

  // Update arrow active states and selection highlight after DOM has updated
  requestAnimationFrame(() => {
    if (window._updateHistoryArrows) window._updateHistoryArrows();
    updateHistoryActiveClass();
  });
}

// ── COLLECTION DROPDOWN EVENTS ──
$('collectionDropdownBtn').addEventListener('click', e => {
  e.stopPropagation();
  $('historyDropdown').classList.remove('open');
  $('newCardDropdown').classList.remove('open');
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
  $('newCardDropdown').classList.remove('open');
  $('historyDropdown').classList.toggle('open');
});

$('historyDropdownNew').addEventListener('click', () => {
  $('historyDropdown').classList.remove('open');
  openNewCard();
});

$('newCardBtn').addEventListener('click', e => {
  e.stopPropagation();
  $('collectionDropdown').classList.remove('open');
  $('historyDropdown').classList.remove('open');
  $('newCardDropdown').classList.toggle('open');
});

$('newCardClean').addEventListener('click', () => {
  $('newCardDropdown').classList.remove('open');
  openNewCard();
});

$('newCardCopy').addEventListener('click', () => {
  $('newCardDropdown').classList.remove('open');
  // Save current card if tracked
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
});

document.addEventListener('click', e => {
  $('historyDropdown').classList.remove('open');
  $('collectionDropdown').classList.remove('open');
  $('newCardDropdown').classList.remove('open');
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

// ── HISTORY BAR ARROWS ──
(function() {
  const track   = $('historyTrack');
  const btnPrev = $('historyPrev');
  const btnNext = $('historyNext');

  // Arrows are active whenever there are 2+ items to navigate between.
  // With looping there is no start/end boundary, so scroll position is irrelevant.
  function updateArrows() {
    const hasMultiple = getHistory().length > 1;
    btnPrev.classList.toggle('active', hasMultiple);
    btnNext.classList.toggle('active', hasMultiple);
  }

  // Navigate to the adjacent history item with wraparound, then centre it in the track.
  function navigateHistory(dir) {
    const items = getHistory();
    if (items.length < 2) return;
    let idx = items.findIndex(h => h.id === activeHistoryId);
    if (idx === -1) idx = dir === 1 ? -1 : items.length;
    const targetIdx = ((idx + dir) + items.length) % items.length;
    tryLoadItem(items[targetIdx]);
    // applyState (called synchronously inside tryLoadItem for the common case) sets
    // .history-active before returning, so one rAF is enough to read layout.
    requestAnimationFrame(scrollHistoryActiveToCenter);
  }

  btnPrev.addEventListener('click', () => navigateHistory(-1));
  btnNext.addEventListener('click', () => navigateHistory(1));

  track.addEventListener('scroll', updateArrows, { passive: true });
  window._updateHistoryArrows = updateArrows;
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

// ── AUTO-SAVE PERSISTENCE ──
$('autoSave').checked = localStorage.getItem('dnd_autosave') !== 'false';
$('autoSave').addEventListener('change', e => localStorage.setItem('dnd_autosave', e.target.checked));

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

  const LOCKED_MAX = 50;

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
      note.textContent = 'Max 50. Cards with large images use more browser storage — if history fills up, the oldest cards are dropped automatically.';
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
    note.textContent = 'Max 50. Cards with large images use more browser storage — if history fills up, the oldest cards are dropped automatically.';
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

  function startDrag(clientY) {
    dragging   = true;
    dragStartY = clientY;
    dragStartH = previewEl.offsetHeight;
    document.body.style.userSelect = 'none';
    document.body.style.webkitUserSelect = 'none';
  }

  function moveDrag(clientY) {
    if (!dragging) return;
    const delta  = clientY - dragStartY;
    // Clamp within the workspace itself: preview + drag handle + min tab area must all fit
    const maxH   = workspace.offsetHeight - handle.offsetHeight - 60;
    const newH   = Math.max(80, Math.min(maxH, dragStartH + delta));
    workspace.style.setProperty('--mobile-preview-h', newH + 'px');
  }

  function endDrag() {
    if (!dragging) return;
    dragging = false;
    document.body.style.userSelect = '';
    document.body.style.webkitUserSelect = '';
    localStorage.setItem(STORAGE_KEY, previewEl.offsetHeight);
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
renderHistoryBar();
const _initialHistory = getHistory();
if (_initialHistory.length > 0) {
  applyState(_initialHistory[0]);
} else {
  syncCard();
}

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
