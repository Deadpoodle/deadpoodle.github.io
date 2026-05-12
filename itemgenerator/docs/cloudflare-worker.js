// Cloudflare Worker — artifex-arcanum.joefahey87.workers.dev
//
// Proxies requests that Firefox Enhanced Tracking Protection blocks when made
// directly from the browser, and proxies token endpoints that have no CORS headers.
// Currently handles:
//   - Dropbox PKCE token exchange / refresh  (POST /dropbox-token)
//   - Google Drive PKCE token exchange / refresh (POST /google-token)
//   - Dropbox recipient fetch (GET dl.dropboxusercontent.com)
//
// Usage: fetch(`${WORKER_URL}?url=${encodeURIComponent(targetUrl)}`, options)

const ALLOW_ORIGIN = 'https://www.artifexarcanum.ie';
const ALLOWED_ORIGINS = new Set([ALLOW_ORIGIN]);

const ALLOWED_HOSTS = new Set([
  'dl.dropboxusercontent.com',   // Dropbox recipient fetch
  'api.dropboxapi.com',          // Dropbox API endpoints
  'content.dropboxapi.com',      // Dropbox download endpoint
  'www.googleapis.com',          // Google Drive API (future use)
  'drive.google.com',            // Google Drive recipient fetch (future use)
]);

addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

async function handle(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(request) });
  }

  // Route: POST /dropbox-token — proxies PKCE code exchange and token refresh.
  // Dropbox's token endpoint has no CORS headers so the browser can't call it directly.
  // No secrets are needed — PKCE uses code_verifier instead of a client secret.
  if (request.method === 'POST' && new URL(request.url).pathname === '/dropbox-token') {
    return handleDropboxToken(request);
  }

  // Route: POST /google-token — proxies PKCE code exchange and token refresh.
  // Google's token endpoint has no CORS headers, and the exchange requires a
  // client_secret. GOOGLE_CLIENT_SECRET is a Cloudflare Worker secret (set via
  // wrangler secret put GOOGLE_CLIENT_SECRET); in Service Worker format it's a global.
  if (request.method === 'POST' && new URL(request.url).pathname === '/google-token') {
    return handleGoogleToken(request);
  }

  const target = new URL(request.url).searchParams.get('url');
  if (!target) return new Response('Missing url param', { status: 400 });

  let parsed;
  try { parsed = new URL(target); } catch { return new Response('Invalid URL', { status: 400 }); }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) {
    return new Response('Forbidden', {
      status: 403,
      headers: corsHeaders(request),
    });
  }

  const init = { method: request.method, headers: {} };
  for (const [name, value] of request.headers.entries()) {
    if (name.toLowerCase() === 'host') continue;
    init.headers[name] = value;
  }
  if (request.method === 'POST') init.body = await request.text();

  const upstream = await fetch(target, init);
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(request),
    },
  });
}

async function handleDropboxToken(request) {
  const body = await request.text();
  const upstream = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(request),
    },
  });
}

async function handleGoogleToken(request) {
  const params = new URLSearchParams(await request.text());
  // Inject client_secret server-side — the browser never sends or sees it.
  params.set('client_secret', GOOGLE_CLIENT_SECRET);
  const upstream = await fetch('https://oauth2.googleapis.com/token', {
    method:  'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body:    params.toString(),
  });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(request),
    },
  });
}

function getCorsOrigin(request) {
  const origin = request.headers.get('Origin');
  return ALLOWED_ORIGINS.has(origin) ? origin : ALLOW_ORIGIN;
}

function corsHeaders(request) {
  const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
  return {
    'Access-Control-Allow-Origin':  getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': requestedHeaders || 'Content-Type, Authorization, Dropbox-API-Arg, Accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}
