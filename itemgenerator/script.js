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
  $('genericConfirmModal').classList.add('active');
  return new Promise(resolve => {
    $('genericConfirmOk').onclick    = () => { $('genericConfirmModal').classList.remove('active'); resolve(true);  };
    $('genericConfirmCancel').onclick = () => { $('genericConfirmModal').classList.remove('active'); resolve(false); };
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
  const source  = $('itemSource').value;
  const desc    = $('itemDescription').value;

  // Attunement
  const attune = _resolveAttunement($('itemAttunement').value, $('attunementCustom').value);

  $('previewName').textContent   = name;
  $('previewSubtype').textContent = type ? (subtype ? `${type} • ${subtype}` : type) : subtype;
  $('previewBonus').textContent  = bonus  || '—';
  $('previewDamage').textContent = damage || '—';
  $('previewWeight').textContent = weight || '—';
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
  if (saveVal)  { $('previewSave').textContent  = saveVal;  $('previewSaveLabel').textContent  = $('saveLabel').value  || 'Save'; }
  if (rangeVal) { $('previewRange').textContent = rangeVal; $('previewRangeLabel').textContent = $('rangeLabel').value || 'Range'; }

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
  'itemDamage','itemWeight','itemSource','itemDescription',
  'itemAttunement','attunementCustom','showImage','showStats','showFrame','squareCorners',
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
  const name = (state.name || 'magic_item').replace(/[^a-z0-9]/gi,'_').toLowerCase();
  link.download = `${name}.png`;
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
    printImagesInPopup([dataUrl], 'single');
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
  wrap.style.cssText = `width:380px;min-height:580px;position:relative;border-radius:${radius};overflow:hidden;flex-shrink:0;`;

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
    ? `<div style="${sideStatStyle}"><span style="${sideStatLabelStyle}">${saveLbl}</span><span style="${sideStatValueStyle}">${s.savingThrow}</span></div>`
    : `<div></div>`;
  const rangeHtml = s.range
    ? `<div style="${sideStatStyle}"><span style="${sideStatLabelStyle}">${rangeLbl}</span><span style="${sideStatValueStyle}">${s.range}</span></div>`
    : `<div></div>`;

  const descHtml = typeof marked !== 'undefined' ? marked.parse(s.description || '', { breaks: true }) : (s.description || '');

  const content = document.createElement('div');
  content.className = 'card-content';
  content.style.cssText = 'position:relative;z-index:2;padding:0;display:flex;flex-direction:column;min-height:580px;';
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
    <div class="card-body" style="padding:8px 20px 16px;flex:1;">
      <div class="card-description" style="font-family:'Crimson Pro',Georgia,serif;font-size:0.87rem;line-height:1.5;color:${inkCol};">${descHtml}</div>
    </div>
    ${attuneText ? `<div class="card-attunement" style="margin:0 16px 4px;text-align:center;font-family:'Crimson Pro',serif;font-style:italic;font-size:0.75rem;color:${inkCol};opacity:0.85;padding-top:4px;border-top:1px solid rgba(90,60,30,0.2);">${attuneText}</div>` : ''}
    <div class="card-footer" style="padding:8px 18px 14px;text-align:center;">
      <div style="font-family:Cinzel,serif;font-size:0.55rem;letter-spacing:0.1em;color:rgba(44,26,14,0.45);text-transform:uppercase;">${s.source || ''}</div>
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
// Layout: A4 portrait, 3×3 grid, each card exactly 63mm × 88mm, no cut lines.
// Single item print: card sits in the top-left cell; remaining 8 cells are empty.
function printImagesInPopup(dataUrls, mode) {
  // A4 portrait = 210mm × 297mm
  // 3 cols × 63mm + 2 × 1mm gap = 191mm  →  side margin = (210 - 191) / 2 = 9.5mm
  // 3 rows × 88mm + 2 × 1mm gap = 266mm  →  top margin  = (297 - 266) / 2 = 15.5mm
  const PER_PAGE = 9;
  const totalPages = Math.max(1, Math.ceil(dataUrls.length / PER_PAGE));

  const pagesHTML = Array.from({ length: totalPages }, (_, p) => {
    const pageUrls = dataUrls.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
    const slots = Array.from({ length: PER_PAGE }, (_, i) =>
      pageUrls[i]
        ? `<div class="card-cell"><img src="${pageUrls[i]}"></div>`
        : `<div class="card-cell"></div>`
    ).join('');
    const pageLabel = totalPages > 1 ? ` &bull; Page ${p + 1} of ${totalPages}` : '';
    return `<div class="page">
  <div class="print-header">Made with the Artifex Arcanum &bull; https://deadpoodle.github.io/itemgenerator${pageLabel}</div>
  <div class="grid">${slots}</div>
</div>`;
  }).join('\n');

  const css = `
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
    const checked = $('pngSelectList').querySelectorAll('input[type="checkbox"]:checked').length;
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
    const items = getHistory();
    if (!items.length) { showInfoModal('No Saved Items', 'No saved cards in history yet.'); return; }

    syncAllQualityUI(localStorage.getItem('dnd_export_quality') || 'standard');

    const list = $('pngSelectList');
    list.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('label');
      row.className = 'print-select-item';
      const rarityLabel = rarityLabels[item.rarity] || item.rarity;
      row.innerHTML = `<input type="checkbox" value="${item.id}" checked>
        <span class="print-select-name">${item.name || 'Unnamed'}</span>
        <span class="history-rarity rarity-${item.rarity}" style="margin-left:auto;flex-shrink:0;">${rarityLabel}</span>`;
      row.querySelector('input').addEventListener('change', updatePngSelectUI);
      list.appendChild(row);
    });

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
        const safeName = (item.name || 'item').replace(/[^a-z0-9]/gi, '_').toLowerCase();
        link.download = `${String(i + 1).padStart(2, '0')}_${safeName}.png`;
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
    const checked = $('printSelectList').querySelectorAll('input[type="checkbox"]:checked').length;
    const pages = Math.max(1, Math.ceil(checked / 9));
    $('printSelectConfirm').textContent = `🖨 Print Selected (${checked})`;
    $('printSelectConfirm').disabled = checked === 0;
    $('printSelectPageHint').textContent = checked > 0
      ? `${pages} page${pages !== 1 ? 's' : ''}`
      : '';
  }

  $('printSelectionBtn').addEventListener('click', () => {
    const items = getHistory();
    if (!items.length) { showInfoModal('No Saved Items', 'No saved cards in history yet.'); return; }

    const list = $('printSelectList');
    list.innerHTML = '';
    items.forEach(item => {
      const row = document.createElement('label');
      row.className = 'print-select-item';
      row.innerHTML = `
        <input type="checkbox" checked value="${item.id}">
        <span class="print-select-name">${item.name || 'Unnamed Item'}</span>
        <span class="print-select-rarity rarity-${item.rarity}">${rarityLabels[item.rarity] || item.rarity}</span>`;
      row.querySelector('input').addEventListener('change', updatePrintSelectUI);
      list.appendChild(row);
    });

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
    const dataUrls = [];

    for (let i = 0; i < items.length; i++) {
      if (_exportCancelled) break;
      updateProgress(i, items.length, `Rendering "${items[i].name || 'Unnamed'}" (${i + 1}/${items.length})…`);
      try {
        const canvas = await renderStateToCanvas(items[i]);
        if (_exportCancelled) break;
        dataUrls.push(canvas.toDataURL('image/png'));
      } catch (e) {
        console.error('Failed to render', items[i].name, e);
      }
    }

    if (_exportCancelled) {
      updateProgress(dataUrls.length, items.length, `Cancelled — ${dataUrls.length} of ${items.length} rendered.`);
      await new Promise(r => setTimeout(r, 1200));
      hideProgress();
    } else {
      updateProgress(items.length, items.length, 'Opening print dialog…');
      await new Promise(r => setTimeout(r, 200));
      hideProgress();
      printImagesInPopup(dataUrls, 'all');
    }
  });
})();

// ── EXPORT JSON ──
$('exportJsonBtn').addEventListener('click', () => {
  const saved   = getHistory();
  const payload = { version: 1, items: saved };
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

      // Merge: new/updated cards first, then existing cards not superseded by name
      const newNames = new Set(newCards.map(c => c.name));
      const merged = [...newCards, ...existing.filter(e => !newNames.has(e.name))];

      const s  = n => n !== 1 ? 's' : '';
      const skipNote = skipCount > 0
        ? ` (${skipCount} duplicate${s(skipCount)} skipped)` : '';

      function doImport(limit) {
        saveHistory(merged.slice(0, limit));
        renderHistoryBar();
        applyState(newCards[0]);
        showInfoModal('Import Complete',
          `Imported ${newCards.length} card${s(newCards.length)}${skipNote}.`);
      }

      const wouldDrop = Math.max(0, merged.length - getMaxHistory());
      if (wouldDrop > 0) {
        const currentMax = getMaxHistory();
        const newMax = merged.length;
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
$('connectGdriveBtn').addEventListener('click', () => {
  console.log('[share] connectGoogleDrive() — not yet implemented');
  showInfoModal('Coming Soon', 'Google Drive connection will be available in a future update.');
});
$('connectOnedriveBtn').addEventListener('click', () => {
  console.log('[share] connectOneDrive() — not yet implemented');
  showInfoModal('Coming Soon', 'OneDrive connection will be available in a future update.');
});
$('disconnectShareBtn').addEventListener('click', () => {
  clearShareConnection();
});

// ── Share selection modal ──

function updateShareSelectUI() {
  const checked = $('shareSelectList').querySelectorAll('input[type="checkbox"]:checked').length;
  $('shareSelectConfirm').textContent = `🔗 Share Selected (${checked})`;
  $('shareSelectConfirm').disabled = checked === 0;
}

// "Share Dropbox Link to Selection" button — opens the selection modal
$('copyShareLinkBtn').addEventListener('click', () => {
  const items = getHistory();
  if (!items.length) { showInfoModal('No Saved Items', 'No saved cards in history yet.'); return; }

  const list = $('shareSelectList');
  list.innerHTML = '';
  items.forEach(item => {
    const row = document.createElement('label');
    row.className = 'print-select-item';
    row.innerHTML = `<input type="checkbox" value="${item.id}" checked>
      <span class="print-select-name">${item.name || 'Unnamed Item'}</span>
      <span class="print-select-rarity rarity-${item.rarity}">${rarityLabels[item.rarity] || item.rarity}</span>`;
    row.querySelector('input').addEventListener('change', updateShareSelectUI);
    list.appendChild(row);
  });

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
    if (err.message === 'reconnect_needed') {
      setShareFeedback('Dropbox needs to be reconnected — disconnect and reconnect in Settings.', 'rgba(220,80,80,0.9)', true);
    } else if (err.message === 'network_error') {
      setShareFeedback('Could not reach Dropbox — check your connection and try again.', 'rgba(220,80,80,0.9)', true);
    } else {
      setShareFeedback('Failed to copy link — please try again.', 'rgba(220,80,80,0.9)', true);
    }
    console.error('[share] shareSelectConfirm error:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = '🔗 Share Dropbox Link to Selection';
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
  $('themeToggle').textContent = light ? '☽ Dark' : '☀ Light';
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
  source: '', description: '',
  attunement: '', attunementCustom: '',
  cardColor: '#d4b87a', inkColor: '#2c1a0e',
  rarityColor: null, circleSize: 110, circleBorderColor: null, bgOpacity: 1,
  showImage: true, showStats: true, showFrame: true, squareCorners: false,
  bgImage: null, itemImage: null,
  imageOffsetX: 0, imageOffsetY: 0, imageScale: 1,
  imgNaturalW: 0, imgNaturalH: 0,
};

function getNewCardState() {
  const state = { ...BLANK_STATE };
  const defType   = localStorage.getItem('dnd_default_type');
  const defRarity = localStorage.getItem('dnd_default_rarity');
  const defSource = localStorage.getItem('dnd_default_source');
  if (defType)   state.type   = defType;
  if (defRarity) state.rarity = defRarity;
  if (defSource) state.source = defSource;
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
  if (!await showGenericConfirm('Clear Card', 'Clear the current card? All fields will be reset to blank.', 'Clear')) return;
  applyState(getNewCardState());
  activeHistoryId = null;
  updateHistoryActiveClass();
});

// ── DEFAULT TYPE IMAGES ──
function getTypeDefaultSrc(type) {
  if (!type || type === 'Other') return null;
  return 'defaults/' + type.toLowerCase().replace(/\s+/g, '_') + '.svg';
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
  $('defaultSource').value = '';

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

// ── Dropbox OAuth — implicit flow (Step 8) ──
// Dropbox's /oauth2/token endpoint does not send CORS headers, so the PKCE
// authorization-code exchange cannot be completed from a browser fetch().
// The implicit flow (response_type=token) returns the access token directly
// in the redirect URL fragment, bypassing the exchange entirely.
// token_access_type=legacy requests a long-lived token so users don't need
// to reconnect frequently.
async function connectDropbox() {
  const params = new URLSearchParams({
    client_id:         DROPBOX_APP_KEY,
    redirect_uri:      DROPBOX_REDIRECT,
    response_type:     'token',
    token_access_type: 'legacy',
  });

  const popup = window.open(
    'https://www.dropbox.com/oauth2/authorize?' + params,
    'dropbox_auth', 'width=600,height=720,left=200,top=100'
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
        if (error)        { reject(new Error(error));     return; }
        if (!access_token){ reject(new Error('no_token')); return; }
        setShareConnection('dropbox', access_token, null);
        resolve();
      }
      window.addEventListener('message', onMsg);
      const poll = setInterval(() => {
        if (!done && popup.closed) {
          clearInterval(poll);
          // Grace period: oauth.html sends postMessage then immediately calls
          // window.close(). The message event may still be queued when the
          // interval fires. Wait 800ms before giving up so it can arrive.
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

// ── Dropbox fetch wrapper — clears connection on 401 ──
// Legacy tokens don't expire, but handle revocation gracefully.
async function _dbx(url, options) {
  const token = getShareToken();
  const resp  = await fetch(url, {
    ...options,
    headers: { ...options.headers, Authorization: 'Bearer ' + token },
  });
  if (resp.status === 401) {
    clearShareConnection();
    showInfoModal('Dropbox Disconnected', 'Your Dropbox session has expired or been revoked. Please reconnect in Settings → Share Provider.');
    throw new Error('auth_expired');
  }
  return resp;
}

// ── shareCurrentCard — upload + create share link (Step 9) ──
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

// ── shareCurrentCard ───────────────────────────────────────────────────────────
// states: array of card state objects (from history). Each will have sharedAt / appVersion
// added. Always uploaded as a JSON array so the recipient handles single or multi uniformly.
async function shareCurrentCard(states) {
  const provider = getShareProvider();
  if (provider !== 'dropbox') {
    showInfoModal('Not Connected', 'Connect Dropbox in Settings → Share Provider first.');
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

  const now = new Date().toISOString();
  const payload = states.map(s => ({ ...s, sharedAt: now, appVersion: '1.0' }));
  const json  = JSON.stringify(payload);

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
    return resp.json();
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
    source:      $('itemSource').value,
    description: $('itemDescription').value,
    attunement:  $('itemAttunement').value,
    attunementCustom: $('attunementCustom').value,
    cardColor:   $('cardColorHex').value,
    inkColor:    $('inkColorHex').value,
    rarityColor: $('rarityColorHex').value || null,
    circleSize:  parseInt($('circleSize').value) || 110,
    circleBorderColor: $('circleBorderColorHex').value || null,
    bgOpacity:   parseFloat($('bgOpacity').value) ?? 1,
    showImage:   $('showImage').checked,
    showStats:   $('showStats').checked,
    showFrame:   $('showFrame').checked,
    squareCorners: $('squareCorners').checked,
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
  };
}

let activeHistoryId = null;
let isDirty = false;
let _applyingState = false;

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
  $('itemSource').value      = s.source      || '';
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
  $('showImage').checked     = s.showImage    !== false;
  $('showStats').checked     = s.showStats    !== false;
  $('showFrame').checked     = s.showFrame    !== false;
  $('squareCorners').checked = s.squareCorners === true;

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
    fallback.src = 'brown_logo.png';
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

function renderHistoryBar() {
  const items      = getHistory();
  const container  = $('historyItems');
  const emptyMsg   = $('historyEmpty');
  const ddContainer = $('historyDropdownItems');
  const ddEmpty     = $('historyDropdownEmpty');
  container.innerHTML = '';
  ddContainer.innerHTML = '';

  if (items.length === 0) {
    emptyMsg.style.display = 'flex';
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
      const updated = getHistory().filter(h => h.id !== item.id);
      saveHistory(updated);
      if (activeHistoryId === item.id) activeHistoryId = null;
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
      const updated = getHistory().filter(h => h.id !== item.id);
      saveHistory(updated);
      if (activeHistoryId === item.id) activeHistoryId = null;
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

// Dropdown toggle
$('historyDropdownBtn').addEventListener('click', e => {
  e.stopPropagation();
  $('historyDropdown').classList.toggle('open');
});

$('historyDropdownNew').addEventListener('click', () => {
  $('historyDropdown').classList.remove('open');
  openNewCard();
});

$('newCardBtn').addEventListener('click', openNewCard);
document.addEventListener('click', () => {
  $('historyDropdown').classList.remove('open');
});

$('historySaveBtn').addEventListener('click', () => {
  const state   = collectCurrentState();
  if (activeHistoryId) state.id = activeHistoryId;
  const history = getHistory().filter(h => h.id !== state.id && h.name !== state.name);
  history.unshift(state);
  saveHistory(history.slice(0, getMaxHistory()));
  renderHistoryBar();
  setDirty(false);

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
  const savedSource = localStorage.getItem('dnd_default_source');
  if (savedType)   $('defaultType').value   = savedType;
  if (savedRarity) $('defaultRarity').value = savedRarity;
  if (savedSource) $('defaultSource').value = savedSource;

  $('defaultType').addEventListener('change', e => {
    if (e.target.value) localStorage.setItem('dnd_default_type', e.target.value);
    else localStorage.removeItem('dnd_default_type');
  });
  $('defaultRarity').addEventListener('change', e => {
    if (e.target.value) localStorage.setItem('dnd_default_rarity', e.target.value);
    else localStorage.removeItem('dnd_default_rarity');
  });
  $('defaultSource').addEventListener('input', e => {
    if (e.target.value) localStorage.setItem('dnd_default_source', e.target.value);
    else localStorage.removeItem('dnd_default_source');
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

// ── INITIAL RENDER ──
// Snapshot the HTML default values before any localStorage state is applied.
const DEFAULT_STATE = collectCurrentState();
renderHistoryBar();
const _initialHistory = getHistory();
if (_initialHistory.length > 0) {
  applyState(_initialHistory[0]);
} else {
  syncCard();
}

// ── DEFAULT CARD IMAGE ──
// Load brown_logo.png and inject it into the welcome card shown to first-time visitors.
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

  cardImg.onerror = () => console.warn('[init] could not load brown_logo.png');

  // Set src directly — same-origin file, no fetch needed
  cardImg.src = 'brown_logo.png';
  cardImg.style.display     = 'block';
  placeholder.style.display = 'none';
  $('itemImgPreview').src   = 'brown_logo.png';
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

    // Normalise: the JSON may be a single card object (legacy) or an array of cards
    const cards   = Array.isArray(cardState) ? cardState : [cardState];
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
      // Merge: new cards first, existing cards not superseded by name
      const newNames = new Set(newCards.map(c => c.name));
      const merged   = [...newCards, ...existing.filter(e => !newNames.has(e.name))];
      saveHistory(merged.slice(0, getMaxHistory()));
      renderHistoryBar();
      applyState(newCards[0]);
      if (newCards.length === 1) {
        showInfoModal('Imported', `"${newCards[0].name || 'Card'}" has been added to your history.`);
      } else {
        showInfoModal('Imported', `${newCards.length} cards have been added to your history.`);
      }
    };
  });
})();
