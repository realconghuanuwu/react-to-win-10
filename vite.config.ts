import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { injectProxyBridge } from './shared/browseProxy.ts';

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

  if (!reqUrl.startsWith('/api/browse?')) {
    next();
    return;
  }

  if ((req.method || '').toUpperCase() === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.end();
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
    if (req.headers) {
      for (const [k, v] of Object.entries(req.headers)) {
        const lower = k.toLowerCase();
        if ((lower.startsWith('x-youtube-') || lower.startsWith('x-goog-')) && typeof v === 'string') {
          headers[k] = v;
        }
      }
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
