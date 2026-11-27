import { extractYouTubeVideos, injectProxyBridge } from '../shared/browseProxy';

interface Env {
  YT_API_ORIGIN?: string;
  ASSETS: {
    fetch: (request: Request) => Promise<Response>;
  };
}

const DEFAULT_YT_API_ORIGIN = 'https://react-win-api.dftactics.win';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': '*',
  'Access-Control-Expose-Headers': 'X-File-Name, Content-Disposition, Content-Length',
};

async function handleYtProxy(request: Request, url: URL, env: Env): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const origin = (env.YT_API_ORIGIN || DEFAULT_YT_API_ORIGIN).replace(/\/+$/, '');
  const targetUrl = `${origin}${url.pathname}${url.search}`;

  try {
    const forwardHeaders = new Headers();
    const contentType = request.headers.get('content-type');
    if (contentType) {
      forwardHeaders.set('Content-Type', contentType);
    }

    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const upstream = await fetch(targetUrl, {
      method: request.method,
      headers: forwardHeaders,
      body: hasBody ? request.body : undefined,
    });

    const resHeaders = new Headers(CORS_HEADERS);
    for (const header of ['content-type', 'content-length', 'x-file-name', 'content-disposition']) {
      const value = upstream.headers.get(header);
      if (value) {
        resHeaders.set(header, value);
      }
    }

    return new Response(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'YouTube backend is unreachable.';
    return Response.json({ error: message }, { status: 502, headers: CORS_HEADERS });
  }
}

async function handleBrowse(request: Request, url: URL): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  const target = url.searchParams.get('url') || '';
  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }
  } catch {
    return Response.json({ error: 'Invalid URL' }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    const forwardHeaders = new Headers({
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
    });

    const reqContentType = request.headers.get('content-type');
    if (reqContentType) {
      forwardHeaders.set('Content-Type', reqContentType);
    }
    request.headers.forEach((value, key) => {
      const lower = key.toLowerCase();
      if (lower.startsWith('x-youtube-') || lower.startsWith('x-goog-')) {
        forwardHeaders.set(key, value);
      }
    });

    const hasBody = request.method !== 'GET' && request.method !== 'HEAD';
    const upstream = await fetch(targetUrl.href, {
      method: request.method,
      redirect: 'follow',
      headers: forwardHeaders,
      body: hasBody ? request.body : undefined,
    });

    const finalUrl = upstream.url || targetUrl.href;
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';

    if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
      const html = await upstream.text();
      const patched = injectProxyBridge(html, finalUrl);
      return new Response(patched, {
        status: upstream.status >= 400 ? upstream.status : 200,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/html; charset=utf-8',
          'X-Chrome-Final-Url': finalUrl,
        },
      });
    }

    const resHeaders = new Headers(CORS_HEADERS);
    resHeaders.set('Content-Type', contentType);
    return new Response(upstream.body, {
      status: upstream.status,
      headers: resHeaders,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch target URL';
    return new Response(
      `<!doctype html><html><body style="font-family:system-ui,sans-serif;padding:40px;color:#202124;background:#fff;">
        <h2 style="margin:0 0 8px;">This site can’t be reached</h2>
        <p style="color:#5f6368;margin:0 0 16px;">${message.replace(/</g, '&lt;')}</p>
        <code style="background:#f1f3f4;padding:4px 8px;border-radius:4px;">${targetUrl.href.replace(/</g, '&lt;')}</code>
      </body></html>`,
      {
        status: 502,
        headers: {
          ...CORS_HEADERS,
          'Content-Type': 'text/html; charset=utf-8',
        },
      },
    );
  }
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname.startsWith('/api/yt/')) {
      return handleYtProxy(request, url, env);
    }

    if (url.pathname === '/api/browse-health') {
      return Response.json({ ok: true }, { headers: CORS_HEADERS });
    }

    if (url.pathname === '/api/youtube') {
      const q = url.searchParams.get('q')?.trim() || 'trending music tech';
      try {
        const ytRes = await fetch(
          `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`,
          {
            headers: {
              'User-Agent':
                'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
              'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
            },
          },
        );
        const html = await ytRes.text();
        return Response.json({ videos: extractYouTubeVideos(html) }, { headers: CORS_HEADERS });
      } catch {
        return Response.json({ videos: [] }, { status: 502, headers: CORS_HEADERS });
      }
    }

    if (url.pathname === '/api/browse') {
      return handleBrowse(request, url);
    }

    const assetResponse = await env.ASSETS.fetch(request);

    // Only expose the root homepage as an indexable HTML document; redirect
    // unknown SPA fallback paths back to "/" to prevent duplicate URL indexing.
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      url.pathname !== '/' &&
      url.pathname !== '/index.html'
    ) {
      const contentType = assetResponse.headers.get('content-type') || '';
      if (contentType.includes('text/html')) {
        return Response.redirect(`${url.origin}/`, 301);
      }
    }

    return assetResponse;
  },
};
