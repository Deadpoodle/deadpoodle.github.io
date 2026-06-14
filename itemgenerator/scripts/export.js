// export.js - vignette, PNG export, print options, card-back, single print, buildCardNode, renderStateToCanvas, progress, popup print, selection-to-sheet, JSON import/export, trim modal — part of split script.js; see index.html for load order
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

// ── PRINT OPTIONS (shared state for the current print run) ──
const printOptions = {
  squareCorners: false,
  bleed:         true,
  doubleSided:   false,
  cardBackUrl:   'img/card_back_v2.png',
};

// ── CARD BACK IMAGE — single source of truth ──
// The custom card-back data URL (or null for the default). Held in memory so the
// synchronous export/share payload builders can read it; persisted to IndexedDB
// (it's an image blob, like the per-card blobs) rather than the 5 MB localStorage.
let _cardBackData = null;

function _persistCardBack(url) {
  if (window.idbBlobs && _idbReady) {
    if (url) window.idbBlobs.set('__cardBack', url).catch(() => {});
    else     window.idbBlobs.delete('__cardBack').catch(() => {});
    localStorage.removeItem('dnd_card_back_image'); // drop any legacy localStorage copy
  } else {
    if (url) localStorage.setItem('dnd_card_back_image', url);
    else     localStorage.removeItem('dnd_card_back_image');
  }
}

// url: data URL for a custom back, or null/falsy to restore the default.
// Updates printOptions, the print dialog preview, the flip-back face, the in-memory
// cache, and IndexedDB.
function setCardBack(url) {
  const resolved = url || 'img/card_back_v2.png';
  printOptions.cardBackUrl = resolved;
  const flipImg = document.querySelector('.card-flip-back img');
  if (flipImg) flipImg.src = resolved;
  // Sync the Appearance-tab picker zone (needed on initial load / JSON import)
  const zone     = document.getElementById('cardBackZone');
  const zoneImg  = document.getElementById('cardBackPreview');
  const clearBtn = document.getElementById('clearCardBack');
  if (zone && zoneImg) {
    if (url) {
      zoneImg.src = resolved;
      zone.classList.add('has-image');
      if (clearBtn) clearBtn.style.display = 'inline-block';
    } else {
      zoneImg.src = '';
      zone.classList.remove('has-image');
      if (clearBtn) clearBtn.style.display = 'none';
    }
  }
  _cardBackData = url || null;
  _persistCardBack(_cardBackData);
}

// Restore persisted card back on load (IndexedDB, migrating any legacy localStorage copy).
(async function () {
  try { await (window.__storageReady || Promise.resolve()); } catch {}
  let saved = null;
  if (window.idbBlobs && _idbReady) {
    try { saved = await window.idbBlobs.get('__cardBack'); } catch {}
  }
  if (!saved) saved = localStorage.getItem('dnd_card_back_image'); // legacy → migrated by setCardBack
  if (saved) setCardBack(saved);
})();

// ── PRINT (single current item) ──
$('exportPrint').addEventListener('click', () => {
  $('singlePrintModal').classList.add('active');
});

$('singlePrintCancel').addEventListener('click', () => {
  $('singlePrintModal').classList.remove('active');
});

$('singlePrintConfirm').addEventListener('click', async () => {
  $('singlePrintModal').classList.remove('active');
  const opts = {
    squareCorners: $('singlePrintOptSquareCorners').checked,
    bleed:         $('singlePrintOptBleed').checked,
    doubleSided:   false,
    cardBackUrl:   printOptions.cardBackUrl,
  };
  showProgress('Preparing print…');
  updateProgress(0, 1, 'Rendering card…');
  try {
    const state = collectCurrentState();
    const stateForPrint = opts.squareCorners ? { ...state, squareCorners: true } : state;
    const canvas = await renderStateToCanvas(stateForPrint);
    const dataUrl = canvas.toDataURL('image/png');
    updateProgress(1, 1, 'Opening print dialog…');
    await new Promise(r => setTimeout(r, 150));
    hideProgress();
    printImagesInPopup([{
      url:       dataUrl,
      oversized: !!state.allowOversized,
      cardColor: state.cardColor || '#d4b87a',
    }], 'single', opts);
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
  wrap.style.cssText = `width:380px;min-height:531px;position:relative;border-radius:${radius};overflow:${wrapOverflow};flex-shrink:0;`;

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
  const fs      = s.fontScale     ?? 1;
  const descFs  = s.descFontScale ?? 1;
  const hFont   = s.headingFont || 'Cinzel';
  const bFont   = `'${s.bodyFont || 'Crimson Pro'}',Georgia,serif`;

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
  const sideStatLabelStyle = `font-family:${hFont},serif;font-size:${(0.5*fs).toFixed(3)}rem;letter-spacing:0.12em;color:${inkCol};opacity:0.75;text-transform:uppercase;display:block;`;
  const sideStatValueStyle = `font-family:${hFont},serif;font-size:${(0.72*fs).toFixed(3)}rem;font-weight:700;color:${inkCol};display:block;margin-top:3px;line-height:1.3;`;

  const saveHtml  = s.savingThrow
    ? `<div style="${sideStatStyle}"><span style="${sideStatLabelStyle}">${saveLbl}</span><span class="side-stat-value" style="${sideStatValueStyle}">${s.savingThrow}</span></div>`
    : `<div></div>`;
  const rangeHtml = s.range
    ? `<div style="${sideStatStyle}"><span style="${sideStatLabelStyle}">${rangeLbl}</span><span class="side-stat-value" style="${sideStatValueStyle}">${s.range}</span></div>`
    : `<div></div>`;

  const descHtml = typeof marked !== 'undefined' ? marked.parse(s.description || '', { breaks: true }) : (s.description || '');

  const content = document.createElement('div');
  content.className = 'card-content';
  const contentOverride = s.allowOversized ? 'height:auto;overflow:visible;' : 'height:531px;overflow:hidden;';
  content.style.cssText = `position:relative;z-index:2;padding:0;display:flex;flex-direction:column;min-height:531px;${contentOverride}`;
  content.innerHTML = `
    <div class="card-header" style="padding:18px 20px 10px;text-align:center;">
      <div class="card-item-name" style="font-family:${hFont},serif;font-size:${(1.15*fs).toFixed(3)}rem;font-weight:700;line-height:1.2;color:${inkCol};letter-spacing:0.04em;">${s.name || 'Unnamed Item'}</div>
      <div class="card-subtype" style="font-family:${hFont},serif;font-size:${(0.65*fs).toFixed(3)}rem;color:${inkCol};letter-spacing:0.12em;text-transform:uppercase;margin-top:3px;opacity:0.85;">${s.type ? (s.subtype ? `${s.type} • ${s.subtype}` : s.type) : (s.subtype || '')}</div>
      <div class="card-rarity rarity-${s.rarity}" style="display:block;text-align:center;font-family:${hFont},serif;font-size:${(0.6*fs).toFixed(3)}rem;line-height:1;letter-spacing:0.14em;text-transform:uppercase;padding:2px 0;${rarityColorStyle}">${rarityIcon} ${rarityLabel} ${rarityIcon}</div>
    </div>
    <div class="card-divider"><span class="divider-gem"></span></div>
    <div class="card-image-wrap" style="display:${imageWrapDisplay};grid-template-columns:1fr 1fr 1fr;align-items:center;padding:8px 20px 4px;min-height:120px;">
      ${saveHtml}
      <div class="card-image-container" style="width:${C}px;height:${C}px;border-radius:50%;border:2px solid ${circleBorder};overflow:hidden;background:rgba(90,60,30,0.12);display:${imageDisplay};align-items:center;justify-content:center;grid-column:2;">
        ${itemImgHtml}
      </div>
      ${rangeHtml}
    </div>
    <div class="card-stats" style="display:${statsDisplay};justify-content:center;gap:0;padding:4px 20px;">
      <div class="card-stat" style="text-align:center;padding:3px 12px;border-right:1px solid rgba(90,60,30,0.3);flex:1;">
        <span class="stat-label" style="font-family:${hFont},serif;font-size:${(0.52*fs).toFixed(3)}rem;letter-spacing:0.12em;color:${inkCol};opacity:0.75;text-transform:uppercase;display:block;">${bonusLbl}</span>
        <span class="stat-value" style="font-family:${hFont},serif;font-size:${(0.82*fs).toFixed(3)}rem;font-weight:700;color:${inkCol};display:block;margin-top:1px;">${bonus}</span>
      </div>
      <div class="card-stat" style="text-align:center;padding:3px 12px;border-right:1px solid rgba(90,60,30,0.3);flex:1;">
        <span class="stat-label" style="font-family:${hFont},serif;font-size:${(0.52*fs).toFixed(3)}rem;letter-spacing:0.12em;color:${inkCol};opacity:0.75;text-transform:uppercase;display:block;">${damageLbl}</span>
        <span class="stat-value" style="font-family:${hFont},serif;font-size:${(0.82*fs).toFixed(3)}rem;font-weight:700;color:${inkCol};display:block;margin-top:1px;">${damage}</span>
      </div>
      <div class="card-stat" style="text-align:center;padding:3px 12px;flex:1;">
        <span class="stat-label" style="font-family:${hFont},serif;font-size:${(0.52*fs).toFixed(3)}rem;letter-spacing:0.12em;color:${inkCol};opacity:0.75;text-transform:uppercase;display:block;">${weightLbl}</span>
        <span class="stat-value" style="font-family:${hFont},serif;font-size:${(0.82*fs).toFixed(3)}rem;font-weight:700;color:${inkCol};display:block;margin-top:1px;">${weight}</span>
      </div>
    </div>
    <div class="card-divider"><span class="divider-gem"></span></div>
    <div class="card-body" style="padding:8px 20px 16px;${s.allowOversized ? 'flex:none;height:auto;overflow:visible;' : 'flex:1;'}">
      <div class="card-description" style="font-family:${bFont};font-size:${(0.87*descFs).toFixed(3)}rem;line-height:1.5;color:${inkCol};">${descHtml}</div>
    </div>
    ${attuneText ? `<div class="card-attunement" style="margin:0 16px 4px;text-align:center;font-family:${bFont};font-style:italic;font-size:${(0.75*descFs).toFixed(3)}rem;color:${inkCol};opacity:0.85;padding-top:4px;border-top:1px solid rgba(90,60,30,0.2);">${attuneText}</div>` : ''}
    <div class="card-footer" style="padding:8px 18px 14px;text-align:center;">
      <div style="font-family:${hFont},serif;font-size:${(0.55*descFs).toFixed(3)}rem;letter-spacing:0.1em;color:rgba(44,26,14,0.45);text-transform:uppercase;">${s.showCollection !== false ? (getCollectionById(s.collectionId)?.name || '') : ''}</div>
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
  _applyStatShrink(node, s.fontScale ?? 1);

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
// entries: array of { url, oversized, cardColor } objects.
// Normal cards: A4 portrait 3×3 grid, each cell 63mm × 88mm (or 69×94mm with bleed).
// If any card is oversized: one card per page, 63mm wide, full height — no grid.
// opts: { bleed, doubleSided, cardBackUrl, squareCorners }
function printImagesInPopup(entries, mode, opts = {}) {
  const {
    bleed       = false,
    doubleSided = false,
    cardBackUrl = 'img/card_back_v2.png',
  } = opts;

  // A4 portrait = 210mm × 297mm
  // No bleed: 3×63 + 2×1 = 191mm wide, 3×88 + 2×1 = 266mm tall → margins 9.5mm / 15.5mm
  // With bleed: 3×69 + 2×1 = 209mm wide, 3×94 + 2×1 = 284mm tall → margins 0.5mm / 6.5mm
  const hasOversized = entries.some(e => e.oversized);

  let pagesHTML, css;

  if (hasOversized) {
    // One card per page, full height — bleed/double-sided not applied to oversized layout
    pagesHTML = entries.map(({ url }, i) => {
      const pageLabel = entries.length > 1 ? ` &bull; Card ${i + 1} of ${entries.length}` : '';
      return `<div class="page">
  <div class="print-header">Made with the Artifex Arcanum &bull; https://www.artifexarcanum.ie${pageLabel}</div>
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
    const totalFrontPages = Math.max(1, Math.ceil(entries.length / PER_PAGE));

    const CELL_W   = bleed ? '69mm' : '63mm';
    const CELL_H   = bleed ? '94mm' : '88mm';
    const GRID_W   = bleed ? '209mm' : '191mm';
    const GRID_H   = bleed ? '284mm' : '266mm';
    const SIDE_MAR = bleed ? '0.5mm' : '9.5mm';
    const TOP_MAR  = bleed ? '6.5mm' : '15.5mm';

    // Build a grid of 9 card-wrap cells for a given page of entries.
    // front=true uses entry images; front=false uses the card back image.
    function buildGrid(pageEntries, front) {
      return Array.from({ length: PER_PAGE }, (_, i) => {
        const entry = pageEntries[i];
        const bleedBg = bleed
          ? `background:${entry ? (front ? (entry.cardColor || '#d4b87a') : '#1b180f') : 'transparent'};`
          : '';
        const imgSrc = front
          ? (entry ? entry.url : '')
          : (entry ? cardBackUrl : '');
        // Back images need scaleX(-1) to counter the grid-level mirror that repositions
        // cells correctly for double-sided printing without inverting the image content.
        const imgStyle = (!front && imgSrc) ? ' style="transform:scaleX(-1)"' : '';
        const img = imgSrc ? `<img src="${imgSrc}" width="63mm" height="88mm"${imgStyle}>` : '';
        return `<div class="card-wrap" style="${bleedBg}">${img}</div>`;
      }).join('');
    }

    const cutSvg = '';

    // Front pages
    pagesHTML = Array.from({ length: totalFrontPages }, (_, p) => {
      const pageEntries = entries.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
      const pageLabel = totalFrontPages > 1 ? ` &bull; Page ${p + 1} of ${totalFrontPages}` : '';
      return `<div class="page">
  <div class="print-header">Made with the Artifex Arcanum &bull; https://www.artifexarcanum.ie${pageLabel}</div>
  <div class="grid">${buildGrid(pageEntries, true)}${cutSvg}</div>
</div>`;
    }).join('\n');

    // Back pages (mirrored horizontally so backs align with fronts when sheet is flipped)
    if (doubleSided) {
      const backPages = Array.from({ length: totalFrontPages }, (_, p) => {
        const pageEntries = entries.slice(p * PER_PAGE, (p + 1) * PER_PAGE);
        const pageLabel = totalFrontPages > 1 ? ` &bull; Back ${p + 1} of ${totalFrontPages}` : ' &bull; Back';
        return `<div class="page">
  <div class="print-header">Made with the Artifex Arcanum &bull; https://www.artifexarcanum.ie${pageLabel}</div>
  <div class="grid" style="transform:scaleX(-1)">${buildGrid(pageEntries, false)}${cutSvg}</div>
</div>`;
      }).join('\n');
      pagesHTML += '\n' + backPages;
    }

    const cutMarkCss = '';

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
      padding: ${TOP_MAR} 0 2mm;
      width: 100%;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(3, ${CELL_W});
      grid-template-rows: repeat(3, ${CELL_H});
      gap: 1mm;
      width: ${GRID_W};
      height: ${GRID_H};
      margin: 0 ${SIDE_MAR};
    }
    .card-wrap {
      width: ${CELL_W};
      height: ${CELL_H};
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
      ${bleed ? 'padding: 3mm; box-sizing: border-box;' : ''}
    }
    .card-wrap img {
      width: 63mm;
      height: 88mm;
      display: block;
      flex-shrink: 0;
    }
    ${cutMarkCss}
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

// ── DOWNLOAD SELECTION → Export & Share sheet (selection mode picks the cards) ──
$('pngSelectionBtn').addEventListener('click', () => {
  if (window._openExportSheet) window._openExportSheet();
});

// ── PRINT SELECTION → Export & Share sheet (selection mode picks the cards) ──
$('printSelectionBtn').addEventListener('click', () => {
  if (window._openExportSheet) window._openExportSheet();
});

// ── EXPORT JSON ──
$('exportJsonBtn').addEventListener('click', () => {
  const saved   = getHistory();
  const payload = { version: 2, collections: collectionsForCards(saved), items: saved };
  if (_cardBackData) payload.cardBack = _cardBackData;
  const blob    = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url     = URL.createObjectURL(blob);
  const a       = document.createElement('a');
  a.href        = url;
  const now     = new Date();
  const stamp   = now.toISOString().slice(0,19).replace('T','-').replace(/:/g,'-');
  a.download    = `artifex-arcanum-${stamp}.json`;
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
      const parsed = _normalizeImportSource(data);
      const incoming = parsed.items;
      const sharedCollections = parsed.collections;
      if (!incoming.length) { showInfoModal('Nothing to Import', 'No items found in that JSON file.'); return; }
      if (parsed.cardBack) setCardBack(parsed.cardBack);

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

