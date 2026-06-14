// cloud.js - token storage, share UI sync, PKCE, Dropbox + Google Drive OAuth/refresh/fetch, shareCurrentCard, fetchSharedCard — part of split script.js; see index.html for load order
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
};
function updateShareUI() {
  const provider = getShareProvider();
  const connected = !!provider && !!getShareToken();
  // Top-bar cloud avatar reflects connection status.
  const avatar = $('cloudAvatar');
  if (avatar) {
    avatar.classList.toggle('connected', connected);
    avatar.title = connected ? 'Connected · Cloud & sharing' : 'Cloud & sharing';
  }
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

    const discoverBtn = $('discoverShareFilesBtn');
    if (discoverBtn) {
      if (provider === 'dropbox') {
        discoverBtn.textContent = '⬇ Import from Dropbox';
      } else if (provider === 'gdrive') {
        discoverBtn.textContent = '⬇ Import from Drive';
      } else {
        discoverBtn.textContent = '🔎 Discover shared JSON';
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
const DROPBOX_REDIRECT   = 'https://www.artifexarcanum.ie/oauth.html';
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
  const proxyUrl = `${DROPBOX_PROXY}?url=${encodeURIComponent(url)}`;
  const doFetch = token => fetch(proxyUrl, {
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
const GDRIVE_REDIRECT  = 'https://www.artifexarcanum.ie/oauth.html';
const GDRIVE_SCOPE     = 'https://www.googleapis.com/auth/drive.file';
const GDRIVE_PROXY     = 'https://artifex-arcanum.joefahey87.workers.dev';

// ── Google Drive OAuth — authorization code + PKCE flow ──
// Switched from implicit flow: PKCE + access_type=offline + prompt=consent
// ensures a refresh token is issued. The client_secret is injected server-side
// by the Cloudflare Worker's POST /google-token route.
async function connectGoogleDrive() {
  const verifier  = _pkceVerifier();
  const challenge = await _pkceChallenge(verifier);
  sessionStorage.setItem('dnd_gdrive_oauth_verifier', verifier);

  const params = new URLSearchParams({
    client_id:             GDRIVE_CLIENT_ID,
    redirect_uri:          GDRIVE_REDIRECT,
    response_type:         'code',
    scope:                 GDRIVE_SCOPE,
    access_type:           'offline',
    prompt:                'consent',
    code_challenge:        challenge,
    code_challenge_method: 'S256',
  });

  const popup = window.open(
    'https://accounts.google.com/o/oauth2/v2/auth?' + params,
    'gdrive_auth', 'width=600,height=720,left=200,top=100'
  );
  if (!popup) {
    showInfoModal('Popup Blocked', 'Please allow pop-ups for this page and try again.');
    sessionStorage.removeItem('dnd_gdrive_oauth_verifier');
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
        if (error)  { reject(new Error(error));    return; }
        if (!code)  { reject(new Error('no_code')); return; }

        const storedVerifier = sessionStorage.getItem('dnd_gdrive_oauth_verifier');
        sessionStorage.removeItem('dnd_gdrive_oauth_verifier');

        fetch(`${GDRIVE_PROXY}/google-token`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body:    new URLSearchParams({
            grant_type:    'authorization_code',
            code,
            code_verifier: storedVerifier,
            client_id:     GDRIVE_CLIENT_ID,
            redirect_uri:  GDRIVE_REDIRECT,
          }).toString(),
        })
          .then(r => r.json())
          .then(data => {
            if (data.error || !data.access_token) {
              reject(new Error(data.error || 'no_token'));
              return;
            }
            setShareConnection('gdrive', data.access_token, data.refresh_token || null);
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
    sessionStorage.removeItem('dnd_gdrive_oauth_verifier');
    if (err.message !== 'closed') {
      showInfoModal('Connection Failed', 'Could not connect to Google Drive — please try again.');
      console.error('[gdrive] connect error:', err);
    }
  }
}

async function _refreshGoogleToken() {
  const refreshToken = localStorage.getItem('dnd_share_refresh_token');
  if (!refreshToken) return false;
  try {
    const resp = await fetch(`${GDRIVE_PROXY}/google-token`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body:    new URLSearchParams({
        grant_type:    'refresh_token',
        refresh_token: refreshToken,
        client_id:     GDRIVE_CLIENT_ID,
      }).toString(),
    });
    const data = await resp.json();
    if (data.error || !data.access_token) return false;
    localStorage.setItem('dnd_share_token', data.access_token);
    return true;
  } catch {
    return false;
  }
}

// ── Google Drive fetch wrapper — auto-refreshes on 401, then prompts reconnect ──
async function _gdrive(url, options) {
  const proxyUrl = `${GDRIVE_PROXY}?url=${encodeURIComponent(url)}`;
  const doFetch = token => fetch(proxyUrl, {
    ...options,
    headers: { ...options.headers, Authorization: 'Bearer ' + token },
  });

  let resp = await doFetch(getShareToken());

  if (resp.status === 401) {
    const refreshed = await _refreshGoogleToken();
    if (refreshed) {
      resp = await doFetch(getShareToken());
      if (resp.status !== 401) return resp;
    }
    clearShareConnection();
    showInfoModal('Google Drive Disconnected', 'Your Google Drive session has expired or been revoked. Please reconnect in Settings → Share Provider.');
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

  if (!permResp.ok) throw new Error('permission_failed: ' + permResp.status + '. permissionsResponse: ' + JSON.stringify(await permResp.json().catch(() => ({}))));

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
    const downloadUrl = `https://drive.usercontent.google.com/download?id=${id}&export=download`;
    // Route through the Cloudflare Worker proxy — drive.usercontent.google.com returns no CORS
    // headers, which blocks the fetch in Firefox and Edge. The legacy drive.google.com/uc endpoint
    // now returns 403 for unauthenticated requests.
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
    fontScale:     parseFloat($('fontScale').value)     || 1,
    descFontScale: parseFloat($('descFontScale').value) || 1,
    headingFont: $('headingFont').value || 'Cinzel',
    bodyFont:    $('bodyFont').value    || 'Crimson Pro',
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
  updateSaveChip(val ? 'unsaved' : 'saved');
  updateHistoryActiveClass();
  if (val) scheduleAutoSave();
}

