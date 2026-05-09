// Cloudflare Worker — artifex-arcanum.joefahey87.workers.dev
//
// Proxies requests that Firefox Enhanced Tracking Protection blocks when made
// directly from the browser. Currently handles:
//   - Dropbox recipient fetch (GET dl.dropboxusercontent.com)
//
// www.googleapis.com and drive.google.com are allowed for future use but are
// not currently routed through the proxy (Google Drive API calls are made directly).
//
// Usage: fetch(`${WORKER_URL}?url=${encodeURIComponent(targetUrl)}`, options)

const ALLOW_ORIGIN = 'https://deadpoodle.github.io';

const ALLOWED_HOSTS = new Set([
  'dl.dropboxusercontent.com',   // Dropbox recipient fetch
  'www.googleapis.com',          // Google Drive API (future use)
  'drive.google.com',            // Google Drive recipient fetch (future use)
]);

addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

async function handle(request) {
  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders() });
  }

  const target = new URL(request.url).searchParams.get('url');
  if (!target) return new Response('Missing url param', { status: 400 });

  let parsed;
  try { parsed = new URL(target); } catch { return new Response('Invalid URL', { status: 400 }); }
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return new Response('Forbidden', { status: 403 });

  const init = { method: request.method, headers: {} };
  const ct = request.headers.get('Content-Type');
  if (ct) init.headers['Content-Type'] = ct;
  if (request.method === 'POST') init.body = await request.text();

  const upstream = await fetch(target, init);
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: {
      'Content-Type': upstream.headers.get('Content-Type') || 'application/json',
      'Cache-Control': 'no-store',
      ...corsHeaders(),
    },
  });
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin':  ALLOW_ORIGIN,
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}
