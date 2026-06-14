// images.js - image compression, upload zones (bindUpload), scale slider, flip — part of split script.js; see index.html for load order
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
      try {
        resolve(canvas.toDataURL('image/webp', quality));
      } catch (err) {
        resolve(canvas.toDataURL('image/jpeg', quality));
      }
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
      `<strong>Enable & Upload</strong> will turn on image compression, scale this image down to 500px, and convert it to WebP. This preserves transparency while still reducing file size.`;
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

bindUpload('cardBackUpload', 'cardBackPreview', 'cardBackZone', 'clearCardBack', src => {
  setCardBack(src);
}, { warnKb: 2000, imageType: 'bg' });

// ── SCALE SLIDER ──
function applyCardScale(val) {
  $('scaleLabel').textContent = val + '%';
  // Scale the outer wrapper (#cardScaleInner) rather than #itemCard directly.
  // #itemCard has backface-visibility:hidden inside a preserve-3d context, which
  // causes the browser to rasterise it at 1× and scale up (blurry). Applying the
  // scale one level above the 3D context keeps rasterisation sharp.
  const scaleEl = $('cardScaleInner') || $('itemCard');
  scaleEl.style.transform = `scale(${val/100})`;
  scaleEl.style.transformOrigin = 'top center';
  if (scaleEl !== $('itemCard')) {
    $('itemCard').style.transform = '';
    $('itemCard').style.transformOrigin = '';
  }
  // Use the card's actual rendered height so oversized text is always accounted for.
  // transform: scale() doesn't affect layout flow, so we must set the wrapper height
  // explicitly to (cardHeight × scale) to keep content below the card in position.
  const cardH = $('itemCard').offsetHeight || 380;
  $('cardScaleWrap').style.height = Math.round(cardH * val / 100 + 20) + 'px';
  const persistEl = $('persistScaleToggle');
  if (persistEl && persistEl.checked) localStorage.setItem('dnd_card_scale', val);
}
$('scaleSlider').addEventListener('input', () => applyCardScale($('scaleSlider').value));

function resetFlip() {
  const fc = $('cardFlipContainer');
  if (!fc) return;
  fc.classList.remove('folding');
  fc.style.transition = '';
  fc.dataset.flipped = 'false';
  $('itemCard').style.visibility = '';
  const back = document.querySelector('.card-flip-back');
  if (back) back.classList.remove('visible');
  $('cardFlipBtn').setAttribute('aria-pressed', 'false');
}

$('scaleReset').addEventListener('click', () => {
  $('scaleSlider').value = 100;
  $('scaleSlider').dispatchEvent(new Event('input'));
  resetFlip();
});

$('cardFlipBtn').addEventListener('click', () => {
  const container = $('cardFlipContainer');
  const back = document.querySelector('.card-flip-back');
  const isFlipped = container.dataset.flipped === 'true';
  const FOLD_MS = 180;

  // Phase 1: fold to edge (scaleX 1→0, ease-in)
  container.style.transition = `transform ${FOLD_MS}ms ease-in`;
  container.classList.add('folding');

  setTimeout(() => {
    // Swap face at the invisible edge midpoint
    if (isFlipped) {
      $('itemCard').style.visibility = '';
      if (back) back.classList.remove('visible');
      container.dataset.flipped = 'false';
      $('cardFlipBtn').setAttribute('aria-pressed', 'false');
    } else {
      $('itemCard').style.visibility = 'hidden';
      if (back) back.classList.add('visible');
      container.dataset.flipped = 'true';
      $('cardFlipBtn').setAttribute('aria-pressed', 'true');
    }

    // Phase 2: unfold from edge (scaleX 0→1, ease-out)
    container.style.transition = `transform ${FOLD_MS}ms ease-out`;
    container.classList.remove('folding');

    setTimeout(() => { container.style.transition = ''; }, FOLD_MS);
  }, FOLD_MS);
});

// Keep the wrapper height in sync whenever the card's content changes height
// (e.g. oversized text toggle causes the card to grow/shrink).
new ResizeObserver(() => applyCardScale($('scaleSlider').value))
  .observe($('itemCard'));

// Reset to 100% on every load so slider and card are always in sync
$('scaleSlider').value = 100;
applyCardScale(100);

