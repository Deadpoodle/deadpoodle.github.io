// Cloudflare Worker — artifex-arcanum.joefahey87.workers.dev
// Proxies GDrive/Dropbox with full header support for Uploads and Permissions.

// This worker updated by Gemini to resolve download issue where google download type headers were being stripped and so the site was receiving a file without any name or type and didnt know what to do with it.
// need to merge this into the old one to preserve comments etc

const ALLOW_ORIGIN = 'https://www.artifexarcanum.ie';
const ALLOWED_ORIGINS = new Set([ALLOW_ORIGIN]);

const ALLOWED_HOSTS = new Set([
  'dl.dropboxusercontent.com',
  'api.dropboxapi.com',
  'content.dropboxapi.com',
  'www.googleapis.com',
  'drive.google.com',
  'drive.usercontent.google.com',
]);

addEventListener('fetch', event => {
  event.respondWith(handle(event.request));
});

async function handle(request) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(request) });
  }

  if (request.method === 'POST' && url.pathname === '/dropbox-token') {
    return handleDropboxToken(request);
  }

  if (request.method === 'POST' && url.pathname === '/google-token') {
    return handleGoogleToken(request);
  }

  const targetUrl = url.searchParams.get('url');
  if (!targetUrl) return new Response('Missing url param', { status: 400 });

  let parsedTarget;
  try {
    parsedTarget = new URL(targetUrl);
  } catch (e) {
    return new Response('Invalid URL', { status: 400 });
  }

  if (!ALLOWED_HOSTS.has(parsedTarget.hostname)) {
    return new Response(`Forbidden: ${parsedTarget.hostname}`, {
      status: 403,
      headers: corsHeaders(request),
    });
  }

  // --- HEADER HANDLING ---
  const upstreamHeaders = new Headers();
  
  // List of headers that MUST be passed through for the APIs to work
  const headersToForward = [
    'authorization',
    'content-type',
    'dropbox-api-arg', // Critical for Dropbox uploads
    'x-goog-upload-protocol',
    'x-goog-upload-command'
  ];

  for (const headerName of headersToForward) {
    const val = request.headers.get(headerName);
    if (val) upstreamHeaders.set(headerName, val);
  }

  // Set a generic User-Agent to avoid bot-blocking
  upstreamHeaders.set('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36');

  try {
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: upstreamHeaders,
      // We pass the raw body (for JSON or Binary files)
      body: request.method === 'GET' || request.method === 'HEAD' ? null : await request.arrayBuffer(),
      redirect: 'follow'
    });

    const responseHeaders = new Headers(corsHeaders(request));
    const headersToPassBack = [
      'content-type',
      'content-disposition',
      'content-length',
      'cache-control'
    ];

    for (const h of headersToPassBack) {
      const value = upstream.headers.get(h);
      if (value) responseHeaders.set(h, value);
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: responseHeaders,
    });
  } catch (err) {
    return new Response(`Proxy Error: ${err.message}`, { status: 502 });
  }
}

// --- handleDropboxToken, handleGoogleToken, and corsHeaders remain the same ---

async function handleDropboxToken(request) {
  const body = await request.text();
  const upstream = await fetch('https://api.dropboxapi.com/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

async function handleGoogleToken(request) {
  const params = new URLSearchParams(await request.text());
  params.set('client_secret', GOOGLE_CLIENT_SECRET);
  const upstream = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
  });
  return new Response(await upstream.text(), {
    status: upstream.status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(request) },
  });
}

function getCorsOrigin(request) {
  const origin = request.headers.get('Origin');
  return ALLOWED_ORIGINS.has(origin) ? origin : ALLOW_ORIGIN;
}

function corsHeaders(request) {
  const requestedHeaders = request.headers.get('Access-Control-Request-Headers');
  return {
    'Access-Control-Allow-Origin': getCorsOrigin(request),
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': requestedHeaders || 'Content-Type, Authorization, Dropbox-API-Arg, Accept',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
}