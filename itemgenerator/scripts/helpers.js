// helpers.js - $ getElementById, modal/toast/confirm helpers, getExportScale, quality-UI sync — part of split script.js; see index.html for load order
﻿// ── HELPERS ──
const $ = id => document.getElementById(id);

function safeConfirm(msg) {
  const el = $('suppressConfirmToggle');
  if (el && el.checked) return true;
  return confirm(msg);
}

// Syncs all export quality radio groups (Settings, Share tab) from a value
function syncAllQualityUI(q) {
  ['exportQuality', 'shareQuality'].forEach(name => {
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

// Lightweight non-modal toast (bottom-centre, auto-dismiss).
let _toastTimer = null;
function showToast(msg, ms = 4500) {
  const el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('show'), ms);
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

