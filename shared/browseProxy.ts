/**
 * Injects a `<base>` tag and lightweight client-side bridge into proxied HTML pages
 * so relative assets, link clicks, GET forms, fetch/XHR, and nested iframes stay
 * routed through `/api/browse` without CORS or X-Frame-Options blocks.
 */
export function injectProxyBridge(html: string, finalUrl: string): string {
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

  if (window.HTMLIFrameElement) {
    var iframeSrcDesc = Object.getOwnPropertyDescriptor(HTMLIFrameElement.prototype, 'src');
    if (iframeSrcDesc && iframeSrcDesc.set) {
      Object.defineProperty(HTMLIFrameElement.prototype, 'src', {
        configurable: true,
        enumerable: true,
        get: iframeSrcDesc.get,
        set: function(val) {
          return iframeSrcDesc.set.call(this, typeof val === 'string' ? toProxiedUrl(val) : val);
        }
      });
    }
  }
})();
</script>`.trim();

  const cleanedHtml = html
    .replace(/<base\b[^>]*>/gi, '')
    .replace(/\s+(?:integrity|crossorigin)(?:=(?:"[^"]*"|'[^']*'|[^\s>]+))?/gi, '');
  if (/<head\b[^>]*>/i.test(cleanedHtml)) {
    return cleanedHtml.replace(/<head\b[^>]*>/i, (match) => `${match}\n${bridgeScript}`);
  }
  if (/<html\b[^>]*>/i.test(cleanedHtml)) {
    return cleanedHtml.replace(/<html\b[^>]*>/i, (match) => `${match}\n<head>${bridgeScript}</head>`);
  }
  return `${bridgeScript}\n${cleanedHtml}`;
}
