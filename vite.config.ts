import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

interface ProxyRequest {
  url?: string;
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  on?: (event: string, listener: (chunk: Uint8Array) => void) => void;
}

interface ProxyResponse {
  statusCode: number;
  setHeader: (name: string, value: string) => void;
  end: (chunk?: string | Uint8Array) => void;
}

function injectProxyBridge(html: string, finalUrl: string): string {
  const safeBase = finalUrl.replace(/"/g, '&quot;');
  const bridgeScript = `
<base href="${safeBase}">
<script>
(function() {
  var BASE_URL = ${JSON.stringify(finalUrl)};
  function postTitle() {
    try {
      window.parent.postMessage({ type: 'chrome-title', title: document.title || BASE_URL, url: BASE_URL }, '*');
    } catch (e) {}
  }
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', postTitle);
  } else {
    postTitle();
  }
  window.addEventListener('load', postTitle);

  document.addEventListener('click', function(e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var el = e.target;
    while (el && el.tagName !== 'A') el = el.parentElement;
    if (!el) return;
    var rawHref = el.getAttribute('href');
    if (!rawHref || rawHref.startsWith('#') || rawHref.startsWith('javascript:') || rawHref.startsWith('mailto:') || rawHref.startsWith('tel:')) return;
    try {
      var resolved = new URL(rawHref, BASE_URL).href;
      if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
        e.preventDefault();
        window.parent.postMessage({
          type: 'chrome-navigate',
          url: resolved,
          newTab: el.getAttribute('target') === '_blank'
        }, '*');
      }
    } catch (err) {}
  }, true);

  document.addEventListener('submit', function(e) {
    var form = e.target;
    if (!form || form.tagName !== 'FORM') return;
    var method = (form.getAttribute('method') || 'GET').toUpperCase();
    if (method !== 'GET') return;
    try {
      var action = form.getAttribute('action') || BASE_URL;
      var targetUrl = new URL(action, BASE_URL);
      var data = new FormData(form);
      data.forEach(function(value, key) {
        if (typeof value === 'string') {
          targetUrl.searchParams.set(key, value);
        }
      });
      e.preventDefault();
      window.parent.postMessage({ type: 'chrome-navigate', url: targetUrl.href, newTab: false }, '*');
    } catch (err) {}
  }, true);

  var origOpen = window.open;
  window.open = function(url) {
    if (typeof url === 'string' && url) {
      try {
        var resolved = new URL(url, BASE_URL).href;
        if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
          window.parent.postMessage({ type: 'chrome-navigate', url: resolved, newTab: true }, '*');
          return null;
        }
      } catch (err) {}
    }
    return origOpen ? origOpen.apply(window, arguments) : null;
  };

  function toProxiedUrl(inputUrl) {
    try {
      if (typeof inputUrl !== 'string' || !inputUrl) return inputUrl;
      if (inputUrl.startsWith('data:') || inputUrl.startsWith('blob:') || inputUrl.startsWith('/api/browse')) {
        return inputUrl;
      }
      var resolved = new URL(inputUrl, BASE_URL).href;
      if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
        return '/api/browse?url=' + encodeURIComponent(resolved);
      }
    } catch (e) {}
    return inputUrl;
  }

  if (window.fetch) {
    var origFetch = window.fetch;
    window.fetch = function(input, init) {
      try {
        if (typeof input === 'string') {
          input = toProxiedUrl(input);
        } else if (input && typeof input === 'object' && typeof input.url === 'string') {
          var proxied = toProxiedUrl(input.url);
          if (proxied !== input.url) {
            input = new Request(proxied, input);
          }
        }
      } catch (e) {}
      return origFetch.call(window, input, init);
    };
  }

  if (window.XMLHttpRequest && window.XMLHttpRequest.prototype.open) {
    var origXhrOpen = window.XMLHttpRequest.prototype.open;
    window.XMLHttpRequest.prototype.open = function(method, url) {
      var args = Array.prototype.slice.call(arguments);
      if (typeof url === 'string') {
        args[1] = toProxiedUrl(url);
      }
      return origXhrOpen.apply(this, args);
    };
  }

  if (window.history) {
    var origPush = window.history.pushState;
    var origReplace = window.history.replaceState;
    window.history.pushState = function(state, title, url) {
      if (typeof url === 'string' && url) {
        try {
          var resolved = new URL(url, BASE_URL).href;
          if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
            BASE_URL = resolved;
          }
        } catch (e) {}
      }
      return origPush ? origPush.call(window.history, state, title, window.location.href) : undefined;
    };
    window.history.replaceState = function(state, title, url) {
      if (typeof url === 'string' && url) {
        try {
          var resolved = new URL(url, BASE_URL).href;
          if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
            BASE_URL = resolved;
          }
        } catch (e) {}
      }
      return origReplace ? origReplace.call(window.history, state, title, window.location.href) : undefined;
    };
  }
})();
</script>`.trim();

  // Remove existing <base> tags so ours takes precedence
  const withoutBase = html.replace(/<base\b[^>]*>/gi, '');
  if (/<head\b[^>]*>/i.test(withoutBase)) {
    return withoutBase.replace(/<head\b[^>]*>/i, (match) => `${match}\n${bridgeScript}`);
  }
  if (/<html\b[^>]*>/i.test(withoutBase)) {
    return withoutBase.replace(/<html\b[^>]*>/i, (match) => `${match}\n<head>${bridgeScript}</head>`);
  }
  return `${bridgeScript}\n${withoutBase}`;
}

interface YouTubeVideoItem {
  videoId: string;
  title: string;
  channel: string;
  views: string;
  duration: string;
  thumbnail: string;
}

function extractYouTubeVideos(html: string): YouTubeVideoItem[] {
  const marker = 'var ytInitialData = ';
  const start = html.indexOf(marker);
  if (start === -1) return [];
  const jsonStart = start + marker.length;
  const end = html.indexOf(';</script>', jsonStart);
  if (end === -1) return [];

  try {
    const data = JSON.parse(html.slice(jsonStart, end)) as unknown;
    const results: YouTubeVideoItem[] = [];
    const seen = new Set<string>();

    const walk = (node: unknown) => {
      if (!node || typeof node !== 'object' || results.length >= 24) return;
      if (Array.isArray(node)) {
        for (const item of node) walk(item);
        return;
      }
      const record = node as Record<string, unknown>;
      const renderer = record.videoRenderer as Record<string, unknown> | undefined;
      if (renderer && typeof renderer.videoId === 'string' && !seen.has(renderer.videoId)) {
        seen.add(renderer.videoId);
        const titleRuns = (renderer.title as { runs?: Array<{ text?: string }> } | undefined)?.runs;
        const title = titleRuns?.map((r) => r.text ?? '').join('') || 'YouTube Video';
        const ownerRuns = (
          renderer.ownerText as { runs?: Array<{ text?: string }> } | undefined
        )?.runs;
        const channel = ownerRuns?.map((r) => r.text ?? '').join('') || '';
        const views =
          (renderer.shortViewCountText as { simpleText?: string } | undefined)?.simpleText ||
          (renderer.viewCountText as { simpleText?: string } | undefined)?.simpleText ||
          '';
        const duration =
          (renderer.lengthText as { simpleText?: string } | undefined)?.simpleText || '';
        results.push({
          videoId: renderer.videoId,
          title,
          channel,
          views,
          duration,
          thumbnail: `https://i.ytimg.com/vi/${renderer.videoId}/hqdefault.jpg`,
        });
        return;
      }
      for (const val of Object.values(record)) {
        walk(val);
      }
    };

    walk(data);
    return results;
  } catch {
    return [];
  }
}

async function handleBrowseMiddleware(
  req: ProxyRequest,
  res: ProxyResponse,
  next: () => void,
) {
  const reqUrl = req.url || '';
  if (reqUrl === '/api/browse-health') {
    res.statusCode = 200;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (reqUrl.startsWith('/api/youtube')) {
    const parsedReq = new URL(reqUrl, 'http://localhost');
    const q = parsedReq.searchParams.get('q')?.trim() || 'trending music tech';
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
      const videos = extractYouTubeVideos(html);
      res.statusCode = 200;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ videos }));
    } catch {
      res.statusCode = 502;
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ videos: [] }));
    }
    return;
  }

  if (!reqUrl.startsWith('/api/browse?')) {
    next();
    return;
  }

  const parsedReq = new URL(reqUrl, 'http://localhost');
  const target = parsedReq.searchParams.get('url') || '';

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
      throw new Error('Invalid protocol');
    }
  } catch {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: 'Invalid URL' }));
    return;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);
    const method = (req.method || 'GET').toUpperCase();

    let body: Uint8Array | undefined;
    if (method !== 'GET' && method !== 'HEAD' && req.on) {
      const chunks: Uint8Array[] = [];
      await new Promise<void>((resolve) => {
        req.on!('data', (chunk: Uint8Array) => chunks.push(chunk));
        req.on!('end', () => resolve());
      });
      const totalLen = chunks.reduce((sum, c) => sum + c.length, 0);
      if (totalLen > 0) {
        const merged = new Uint8Array(totalLen);
        let offset = 0;
        for (const c of chunks) {
          merged.set(c, offset);
          offset += c.length;
        }
        body = merged;
      }
    }

    const headers: Record<string, string> = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
      Accept:
        'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9,vi;q=0.8',
    };
    const reqContentType = req.headers?.['content-type'];
    if (typeof reqContentType === 'string') {
      headers['Content-Type'] = reqContentType;
    }

    const upstream = await fetch(targetUrl.href, {
      method,
      redirect: 'follow',
      signal: controller.signal,
      headers,
      body: body as unknown as BodyInit | undefined,
    });
    clearTimeout(timeout);

    const finalUrl = upstream.url || targetUrl.href;
    const contentType = upstream.headers.get('content-type') || 'application/octet-stream';
    res.setHeader('Access-Control-Allow-Origin', '*');

    if (contentType.includes('text/html') || contentType.includes('application/xhtml+xml')) {
      const html = await upstream.text();
      const patched = injectProxyBridge(html, finalUrl);
      res.statusCode = upstream.status >= 400 ? upstream.status : 200;
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.setHeader('X-Chrome-Final-Url', finalUrl);
      res.end(patched);
      return;
    }

    const bytes = new Uint8Array(await upstream.arrayBuffer());
    res.statusCode = upstream.status;
    res.setHeader('Content-Type', contentType);
    res.end(bytes);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Failed to fetch target URL';
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end(`<!doctype html><html><body style="font-family:system-ui,sans-serif;padding:40px;color:#202124;background:#fff;">
      <h2 style="margin:0 0 8px;">This site can’t be reached</h2>
      <p style="color:#5f6368;margin:0 0 16px;">${message.replace(/</g, '&lt;')}</p>
      <code style="background:#f1f3f4;padding:4px 8px;border-radius:4px;">${targetUrl.href.replace(/</g, '&lt;')}</code>
    </body></html>`);
  }
}

function chromeBrowseProxyPlugin(): Plugin {
  return {
    name: 'chrome-browse-proxy',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleBrowseMiddleware(
          req as unknown as ProxyRequest,
          res as unknown as ProxyResponse,
          next,
        );
      });
    },
    configurePreviewServer(server) {
      server.middlewares.use((req, res, next) => {
        void handleBrowseMiddleware(
          req as unknown as ProxyRequest,
          res as unknown as ProxyResponse,
          next,
        );
      });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), chromeBrowseProxyPlugin()],
});
