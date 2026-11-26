import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useDesktopStore } from '../../store/useDesktopStore';
import { YouTubeView } from './YouTubeView';

interface ChromeAppProps {
  windowId: string;
}

interface BrowserTab {
  id: string;
  title: string;
  url: string;
  history: string[];
  historyIndex: number;
  isLoading: boolean;
  hasAudio?: boolean;
  isMuted?: boolean;
  reloadNonce: number;
}

interface BookmarkItem {
  id: string;
  title: string;
  url: string;
}

interface HistoryEntry {
  id: string;
  title: string;
  url: string;
  visitedAt: number;
}

type SearchEngine = 'bing' | 'duckduckgo' | 'google' | 'wikipedia';

const BOOKMARKS_STORAGE_KEY = 'win10_chrome_bookmarks_v1';
const HISTORY_STORAGE_KEY = 'win10_chrome_history_v1';

const SEARCH_ENGINES: Record<
  SearchEngine,
  { label: string; searchUrl: (q: string) => string }
> = {
  bing: {
    label: 'Bing',
    searchUrl: (q) => `https://www.bing.com/search?q=${encodeURIComponent(q)}`,
  },
  duckduckgo: {
    label: 'DuckDuckGo',
    searchUrl: (q) => `https://duckduckgo.com/?q=${encodeURIComponent(q)}`,
  },
  google: {
    label: 'Google',
    searchUrl: (q) => `https://www.google.com/search?q=${encodeURIComponent(q)}`,
  },
  wikipedia: {
    label: 'Wikipedia',
    searchUrl: (q) =>
      `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(q)}`,
  },
};

const DEFAULT_BOOKMARKS: BookmarkItem[] = [
  { id: 'bm-wiki', title: 'Wikipedia', url: 'https://en.wikipedia.org' },
  { id: 'bm-bing', title: 'Bing', url: 'https://www.bing.com' },
  { id: 'bm-ddg', title: 'DuckDuckGo', url: 'https://duckduckgo.com' },
  { id: 'bm-vne', title: 'VnExpress', url: 'https://vnexpress.net' },
  { id: 'bm-github', title: 'GitHub', url: 'https://github.com' },
  { id: 'bm-osm', title: 'OpenStreetMap', url: 'https://www.openstreetmap.org' },
  { id: 'bm-archive', title: 'Archive.org', url: 'https://archive.org' },
];

const QUICK_SHORTCUTS: Array<{
  title: string;
  url: string;
  badge: string;
  color: string;
}> = [
  { title: 'Wikipedia', url: 'https://en.wikipedia.org', badge: 'W', color: '#3366cc' },
  { title: 'Bing', url: 'https://www.bing.com', badge: 'B', color: '#008373' },
  { title: 'DuckDuckGo', url: 'https://duckduckgo.com', badge: 'D', color: '#de5833' },
  { title: 'VnExpress', url: 'https://vnexpress.net', badge: 'V', color: '#9f224e' },
  { title: 'GitHub', url: 'https://github.com', badge: 'G', color: '#24292f' },
  { title: 'YouTube', url: 'https://www.youtube.com', badge: '▶', color: '#ff0000' },
  { title: 'OpenStreetMap', url: 'https://www.openstreetmap.org', badge: 'M', color: '#7ebc6f' },
  { title: 'Archive.org', url: 'https://archive.org', badge: 'A', color: '#428bca' },
];

function createTab(url = 'chrome://newtab'): BrowserTab {
  return {
    id: `tab-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    title: url === 'chrome://newtab' ? 'New Tab' : getDisplayTitle(url),
    url,
    history: [url],
    historyIndex: 0,
    isLoading: !url.startsWith('chrome://'),
    reloadNonce: 0,
  };
}

function getDisplayTitle(url: string): string {
  if (url === 'chrome://newtab') return 'New Tab';
  if (url === 'chrome://history') return 'History';
  if (url === 'chrome://bookmarks') return 'Bookmarks';
  try {
    const parsed = new URL(url);
    return parsed.hostname.replace(/^www\./, '') || url;
  } catch {
    return url;
  }
}

function getFaviconUrl(url: string): string | null {
  if (url.startsWith('chrome://')) return null;
  try {
    const parsed = new URL(url);
    return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(parsed.hostname)}&sz=32`;
  } catch {
    return null;
  }
}

function isYouTubeUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    return host === 'youtube.com' || host === 'm.youtube.com' || host === 'youtu.be';
  } catch {
    return false;
  }
}

function toYouTubeEmbedUrl(url: string): string | null {
  try {
    const parsed = new URL(url);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtube.com' || host === 'm.youtube.com') {
      if (parsed.pathname === '/watch') {
        const v = parsed.searchParams.get('v');
        if (v) return `https://www.youtube.com/embed/${encodeURIComponent(v)}?autoplay=1`;
      }
      if (parsed.pathname.startsWith('/shorts/')) {
        const id = parsed.pathname.split('/')[2];
        if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1`;
      }
    }
    if (host === 'youtu.be') {
      const id = parsed.pathname.slice(1);
      if (id) return `https://www.youtube.com/embed/${encodeURIComponent(id)}?autoplay=1`;
    }
  } catch {
    return null;
  }
  return null;
}

function normalizeInputToUrl(rawInput: string, engine: SearchEngine): string {
  const trimmed = rawInput.trim();
  if (!trimmed) return 'chrome://newtab';
  if (trimmed.startsWith('chrome://')) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^localhost(:\d+)?(\/.*)?$/i.test(trimmed) || /^\d{1,3}(\.\d{1,3}){3}(:\d+)?(\/.*)?$/.test(trimmed)) {
    return `http://${trimmed}`;
  }
  if (!trimmed.includes(' ') && trimmed.includes('.')) {
    return `https://${trimmed}`;
  }
  return SEARCH_ENGINES[engine].searchUrl(trimmed);
}

function loadStoredBookmarks(): BookmarkItem[] {
  try {
    const raw = window.localStorage.getItem(BOOKMARKS_STORAGE_KEY);
    if (!raw) return DEFAULT_BOOKMARKS;
    const parsed = JSON.parse(raw) as BookmarkItem[];
    return Array.isArray(parsed) ? parsed : DEFAULT_BOOKMARKS;
  } catch {
    return DEFAULT_BOOKMARKS;
  }
}

function loadStoredHistory(): HistoryEntry[] {
  try {
    const raw = window.localStorage.getItem(HISTORY_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as HistoryEntry[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function ChromeApp({ windowId }: ChromeAppProps) {
  const setWindowTitle = useDesktopStore((state) => state.setWindowTitle);
  const systemVolume = useDesktopStore((state) => state.systemVolume);
  const isSystemMuted = useDesktopStore((state) => state.isSystemMuted);

  const [tabs, setTabs] = useState<BrowserTab[]>(() => [createTab('chrome://newtab')]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);
  const [addressInput, setAddressInput] = useState<string>('');
  const [newTabQuery, setNewTabQuery] = useState<string>('');
  const [searchEngine, setSearchEngine] = useState<SearchEngine>('bing');
  const [bookmarks, setBookmarks] = useState<BookmarkItem[]>(loadStoredBookmarks);
  const [historyEntries, setHistoryEntries] = useState<HistoryEntry[]>(loadStoredHistory);
  const [showBookmarksBar, setShowBookmarksBar] = useState<boolean>(true);
  const [showMenu, setShowMenu] = useState<boolean>(false);
  const [proxyAvailable, setProxyAvailable] = useState<boolean>(false);
  const [proxyEnabled, setProxyEnabled] = useState<boolean>(true);
  const [iframeError, setIframeError] = useState<string | null>(null);

  const iframeRefs = useRef<Record<string, HTMLIFrameElement | null>>({});
  const addressInputRef = useRef<HTMLInputElement | null>(null);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId],
  );

  // Detect whether Vite browse proxy middleware is available
  useEffect(() => {
    let cancelled = false;
    fetch('/api/browse-health')
      .then((res) => {
        if (!cancelled && res.ok) {
          setProxyAvailable(true);
        }
      })
      .catch(() => {
        if (!cancelled) setProxyAvailable(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Sync system volume to all proxied iframes
  useEffect(() => {
    const vol = isSystemMuted ? 0 : systemVolume / 100;
    Object.values(iframeRefs.current).forEach((frame) => {
      frame?.contentWindow?.postMessage(
        { type: 'chrome-set-volume', volume: vol },
        '*',
      );
    });
  }, [systemVolume, isSystemMuted]);

  // Persist bookmarks & history
  useEffect(() => {
    try {
      window.localStorage.setItem(BOOKMARKS_STORAGE_KEY, JSON.stringify(bookmarks));
    } catch {
      // ignore storage errors
    }
  }, [bookmarks]);

  useEffect(() => {
    try {
      window.localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(historyEntries.slice(0, 150)));
    } catch {
      // ignore storage errors
    }
  }, [historyEntries]);

  // Sync address bar and window title when active tab changes
  useEffect(() => {
    setAddressInput(activeTab.url === 'chrome://newtab' ? '' : activeTab.url);
    setIframeError(null);
    setWindowTitle(
      windowId,
      activeTab.title ? `${activeTab.title} - Google Chrome` : 'Google Chrome',
    );
  }, [activeTab.id, activeTab.url, activeTab.title, setWindowTitle, windowId]);

  const recordHistory = useCallback((url: string, title?: string) => {
    if (url.startsWith('chrome://')) return;
    setHistoryEntries((prev) => [
      {
        id: `hist-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: title || getDisplayTitle(url),
        url,
        visitedAt: Date.now(),
      },
      ...prev.slice(0, 149),
    ]);
  }, []);

  const navigateTab = useCallback(
    (tabId: string, targetUrl: string, options?: { pushHistory?: boolean }) => {
      const pushHistory = options?.pushHistory ?? true;
      const isInternal = targetUrl.startsWith('chrome://');
      setIframeError(null);

      setTabs((prev) =>
        prev.map((tab) => {
          if (tab.id !== tabId) return tab;
          const nextHistory = pushHistory
            ? [...tab.history.slice(0, tab.historyIndex + 1), targetUrl]
            : tab.history;
          const nextIndex = pushHistory ? nextHistory.length - 1 : tab.historyIndex;
          return {
            ...tab,
            url: targetUrl,
            title: getDisplayTitle(targetUrl),
            history: nextHistory,
            historyIndex: nextIndex,
            isLoading: !isInternal,
          };
        }),
      );

      if (!isInternal) {
        recordHistory(targetUrl);
      }
    },
    [recordHistory],
  );

  const openNewTab = useCallback((url = 'chrome://newtab') => {
    const tab = createTab(url);
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(tab.id);
    setShowMenu(false);
    if (!url.startsWith('chrome://')) {
      recordHistory(url);
    }
  }, [recordHistory]);

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        if (prev.length === 1) {
          const fresh = createTab('chrome://newtab');
          setActiveTabId(fresh.id);
          return [fresh];
        }
        const idx = prev.findIndex((t) => t.id === tabId);
        const filtered = prev.filter((t) => t.id !== tabId);
        if (tabId === activeTabId) {
          const nextActive = filtered[Math.min(idx, filtered.length - 1)];
          setActiveTabId(nextActive.id);
        }
        return filtered;
      });
    },
    [activeTabId],
  );

  // Listen to messages from proxied iframe pages (link clicks, form submits, title updates, audio state)
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const data = event.data as
        | {
            type?: string;
            url?: string;
            title?: string;
            newTab?: boolean;
            playing?: boolean;
          }
        | undefined;
      if (!data || typeof data !== 'object') return;

      const sourceTabId =
        Object.entries(iframeRefs.current).find(
          ([, frame]) => frame?.contentWindow === event.source,
        )?.[0] ?? activeTabId;

      if (data.type === 'chrome-navigate' && typeof data.url === 'string') {
        if (data.newTab) {
          openNewTab(data.url);
        } else {
          navigateTab(sourceTabId, data.url);
        }
      } else if (data.type === 'chrome-title' && typeof data.title === 'string') {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === sourceTabId
              ? { ...tab, title: data.title || tab.title, isLoading: false }
              : tab,
          ),
        );
      } else if (data.type === 'chrome-audio' && typeof data.playing === 'boolean') {
        setTabs((prev) =>
          prev.map((tab) =>
            tab.id === sourceTabId ? { ...tab, hasAudio: data.playing } : tab,
          ),
        );
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [activeTabId, navigateTab, openNewTab]);

  const handleAddressSubmit = (e: FormEvent) => {
    e.preventDefault();
    const targetUrl = normalizeInputToUrl(addressInput, searchEngine);
    navigateTab(activeTab.id, targetUrl);
    addressInputRef.current?.blur();
  };

  const handleNewTabSearch = (e: FormEvent) => {
    e.preventDefault();
    const targetUrl = normalizeInputToUrl(newTabQuery, searchEngine);
    setNewTabQuery('');
    navigateTab(activeTab.id, targetUrl);
  };

  const handleBack = () => {
    if (activeTab.historyIndex <= 0) return;
    const nextIndex = activeTab.historyIndex - 1;
    const targetUrl = activeTab.history[nextIndex];
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTab.id
          ? {
              ...tab,
              historyIndex: nextIndex,
              url: targetUrl,
              title: getDisplayTitle(targetUrl),
              isLoading: !targetUrl.startsWith('chrome://'),
            }
          : tab,
      ),
    );
  };

  const handleForward = () => {
    if (activeTab.historyIndex >= activeTab.history.length - 1) return;
    const nextIndex = activeTab.historyIndex + 1;
    const targetUrl = activeTab.history[nextIndex];
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTab.id
          ? {
              ...tab,
              historyIndex: nextIndex,
              url: targetUrl,
              title: getDisplayTitle(targetUrl),
              isLoading: !targetUrl.startsWith('chrome://'),
            }
          : tab,
      ),
    );
  };

  const handleReload = () => {
    setIframeError(null);
    setTabs((prev) =>
      prev.map((tab) =>
        tab.id === activeTab.id
          ? {
              ...tab,
              isLoading: !tab.url.startsWith('chrome://'),
              reloadNonce: tab.reloadNonce + 1,
            }
          : tab,
      ),
    );
  };

  const isBookmarked = bookmarks.some((b) => b.url === activeTab.url);

  const toggleBookmark = () => {
    if (activeTab.url.startsWith('chrome://')) return;
    if (isBookmarked) {
      setBookmarks((prev) => prev.filter((b) => b.url !== activeTab.url));
    } else {
      setBookmarks((prev) => [
        ...prev,
        {
          id: `bm-${Date.now()}`,
          title: activeTab.title || getDisplayTitle(activeTab.url),
          url: activeTab.url,
        },
      ]);
    }
  };

  const canGoBack = activeTab.historyIndex > 0;
  const canGoForward = activeTab.historyIndex < activeTab.history.length - 1;

  return (
    <div
      className="flex-1 flex flex-col bg-white text-[#202124] overflow-hidden select-none"
      onClick={() => showMenu && setShowMenu(false)}
    >
      {/* Chrome Tab Strip */}
      <div className="flex items-end h-[36px] bg-[#dee1e6] px-2 pt-1.5 gap-1 overflow-x-auto shrink-0">
        {tabs.map((tab) => {
          const isTabActive = tab.id === activeTab.id;
          const favicon = getFaviconUrl(tab.url);
          return (
            <div
              key={tab.id}
              onClick={() => setActiveTabId(tab.id)}
              className={[
                'group relative flex items-center gap-2 h-[30px] min-w-[110px] max-w-[220px] flex-1 px-3 rounded-t-lg text-[12px] cursor-default transition-colors',
                isTabActive
                  ? 'bg-white text-[#202124] shadow-[0_0_4px_rgba(0,0,0,0.08)]'
                  : 'bg-transparent text-[#444746] hover:bg-[#e8eaed]',
              ].join(' ')}
            >
              {tab.isLoading ? (
                <span className="w-3.5 h-3.5 rounded-full border-2 border-[#1a73e8] border-t-transparent animate-spin shrink-0" />
              ) : favicon ? (
                <img
                  src={favicon}
                  alt=""
                  className="w-3.5 h-3.5 object-contain shrink-0"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : (
                <span className="w-3.5 h-3.5 rounded-full bg-[#1a73e8]/15 text-[#1a73e8] flex items-center justify-center text-[9px] font-bold shrink-0">
                  G
                </span>
              )}

              <span className="truncate flex-1">{tab.title}</span>

              {tab.hasAudio && (
                <button
                  type="button"
                  title={tab.isMuted ? 'Unmute tab' : 'Mute tab'}
                  aria-label={tab.isMuted ? `Unmute ${tab.title}` : `Mute ${tab.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.id === tab.id ? { ...t, isMuted: !t.isMuted } : t,
                      ),
                    );
                  }}
                  className="w-4 h-4 rounded-full flex items-center justify-center text-[#5f6368] hover:bg-[#dadce0] hover:text-[#202124] shrink-0"
                >
                  {tab.isMuted ? (
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
                      <path d="M8 2.5L4.5 5.5H2v5h2.5L8 13.5V2.5z" />
                      <path d="M11 5.5l3 5m0-5l-3 5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" fill="none" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="currentColor" aria-hidden="true">
                      <path d="M8 2.5L4.5 5.5H2v5h2.5L8 13.5V2.5z" />
                      <path d="M10.5 5.2a3.8 3.8 0 0 1 0 5.6M12.3 3.5a6.2 6.2 0 0 1 0 9" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" fill="none" />
                    </svg>
                  )}
                </button>
              )}

              <button
                type="button"
                aria-label={`Close ${tab.title}`}
                onClick={(e) => {
                  e.stopPropagation();
                  closeTab(tab.id);
                }}
                className="w-4 h-4 rounded-full flex items-center justify-center text-[#5f6368] hover:bg-[#dadce0] hover:text-[#202124] shrink-0 text-[13px] leading-none"
              >
                ×
              </button>
            </div>
          );
        })}

        <button
          type="button"
          title="New tab"
          aria-label="New tab"
          onClick={() => openNewTab('chrome://newtab')}
          className="w-7 h-7 mb-0.5 rounded-full flex items-center justify-center text-[#444746] hover:bg-[#cacdd2] text-[18px] leading-none shrink-0"
        >
          +
        </button>
      </div>

      {/* Navigation & Omnibox Toolbar */}
      <div className="flex items-center gap-1.5 h-[40px] px-2.5 bg-white border-b border-[#dadce0] shrink-0">
        <button
          type="button"
          title="Back"
          aria-label="Back"
          disabled={!canGoBack}
          onClick={handleBack}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-35 disabled:hover:bg-transparent"
        >
          ←
        </button>

        <button
          type="button"
          title="Forward"
          aria-label="Forward"
          disabled={!canGoForward}
          onClick={handleForward}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#5f6368] hover:bg-[#f1f3f4] disabled:opacity-35 disabled:hover:bg-transparent"
        >
          →
        </button>

        <button
          type="button"
          title="Reload"
          aria-label="Reload"
          onClick={handleReload}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#5f6368] hover:bg-[#f1f3f4]"
        >
          ↻
        </button>

        <button
          type="button"
          title="Home"
          aria-label="Home"
          onClick={() => navigateTab(activeTab.id, 'chrome://newtab')}
          className="w-7 h-7 rounded-full flex items-center justify-center text-[#5f6368] hover:bg-[#f1f3f4] text-[14px]"
        >
          ⌂
        </button>

        {/* Omnibox */}
        <form
          onSubmit={handleAddressSubmit}
          className="flex-1 flex items-center h-[28px] bg-[#f1f3f4] hover:bg-[#e8eaed] focus-within:bg-white focus-within:ring-2 focus-within:ring-[#1a73e8] rounded-full px-3 gap-2 transition-colors"
        >
          <span className="text-[12px] text-[#5f6368] shrink-0">
            {activeTab.url.startsWith('https://') ? '🔒' : '🔍'}
          </span>
          <input
            ref={addressInputRef}
            type="text"
            value={addressInput}
            onChange={(e) => setAddressInput(e.target.value)}
            onFocus={(e) => e.currentTarget.select()}
            placeholder="Search or type a URL"
            aria-label="Address and search bar"
            className="flex-1 bg-transparent outline-none text-[13px] text-[#202124] placeholder:text-[#5f6368] select-text"
          />
          {!activeTab.url.startsWith('chrome://') && (
            <button
              type="button"
              title={isBookmarked ? 'Remove bookmark' : 'Bookmark this tab'}
              aria-label="Toggle bookmark"
              onClick={toggleBookmark}
              className={`text-[15px] leading-none shrink-0 ${
                isBookmarked ? 'text-[#1a73e8]' : 'text-[#5f6368] hover:text-[#202124]'
              }`}
            >
              {isBookmarked ? '★' : '☆'}
            </button>
          )}
        </form>

        {/* Proxy mode indicator/toggle */}
        {proxyAvailable && (
          <button
            type="button"
            title={
              proxyEnabled
                ? 'Proxy mode ON (bypasses X-Frame-Options for normal web browsing). Click to switch to Direct iframe.'
                : 'Direct iframe mode. Click to enable Proxy mode.'
            }
            onClick={() => {
              setProxyEnabled((v) => !v);
              handleReload();
            }}
            className={[
              'px-2 py-1 rounded-full text-[11px] font-medium shrink-0 transition-colors',
              proxyEnabled
                ? 'bg-[#e8f0fe] text-[#1a73e8] hover:bg-[#d2e3fc]'
                : 'bg-[#f1f3f4] text-[#5f6368] hover:bg-[#e8eaed]',
            ].join(' ')}
          >
            {proxyEnabled ? 'Proxy ON' : 'Direct'}
          </button>
        )}

        {/* Open in real browser tab */}
        {!activeTab.url.startsWith('chrome://') && (
          <a
            href={activeTab.url}
            target="_blank"
            rel="noopener noreferrer"
            title="Open in external browser tab"
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#5f6368] hover:bg-[#f1f3f4] text-[13px] shrink-0"
          >
            ↗
          </a>
        )}

        {/* Chrome 3-dot Menu */}
        <div className="relative">
          <button
            type="button"
            title="Customize and control Google Chrome"
            aria-label="Chrome menu"
            onClick={(e) => {
              e.stopPropagation();
              setShowMenu((v) => !v);
            }}
            className="w-7 h-7 rounded-full flex items-center justify-center text-[#5f6368] hover:bg-[#f1f3f4] text-[15px] font-bold"
          >
            ⋮
          </button>

          {showMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              className="absolute right-0 top-8 w-52 bg-white rounded-lg shadow-[0_4px_16px_rgba(0,0,0,0.18)] border border-[#dadce0] py-1.5 z-50 text-[13px]"
            >
              <button
                type="button"
                onClick={() => openNewTab('chrome://newtab')}
                className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4]"
              >
                New tab
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  navigateTab(activeTab.id, 'chrome://bookmarks');
                }}
                className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4]"
              >
                Bookmarks
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowMenu(false);
                  navigateTab(activeTab.id, 'chrome://history');
                }}
                className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4]"
              >
                History
              </button>
              <div className="my-1 border-t border-[#e8eaed]" />
              <button
                type="button"
                onClick={() => {
                  setShowBookmarksBar((v) => !v);
                  setShowMenu(false);
                }}
                className="w-full text-left px-4 py-1.5 hover:bg-[#f1f3f4] flex items-center justify-between"
              >
                <span>Show bookmarks bar</span>
                <span>{showBookmarksBar ? '✓' : ''}</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bookmarks Bar */}
      {showBookmarksBar && (
        <div className="flex items-center gap-1 h-[28px] px-2.5 bg-white border-b border-[#e8eaed] overflow-x-auto shrink-0">
          {bookmarks.map((bm) => {
            const fav = getFaviconUrl(bm.url);
            return (
              <button
                key={bm.id}
                type="button"
                onClick={() => navigateTab(activeTab.id, bm.url)}
                className="flex items-center gap-1.5 px-2 py-0.5 rounded-full hover:bg-[#f1f3f4] text-[12px] text-[#3c4043] shrink-0 max-w-[140px]"
              >
                {fav && (
                  <img
                    src={fav}
                    alt=""
                    className="w-3.5 h-3.5 object-contain shrink-0"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = 'none';
                    }}
                  />
                )}
                <span className="truncate">{bm.title}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Main Content Area (keep all tabs mounted so background tabs keep running) */}
      <div className="relative flex-1 bg-white overflow-hidden flex flex-col">
        {tabs.map((tab) => {
          const isTabActive = tab.id === activeTab.id;
          const tabYoutubeMode = isYouTubeUrl(tab.url);
          const tabYoutubeEmbed = toYouTubeEmbedUrl(tab.url);
          const tabShouldUseProxy = proxyAvailable && proxyEnabled && !tabYoutubeEmbed;
          const tabIframeSrc = tab.url.startsWith('chrome://')
            ? ''
            : tabYoutubeEmbed
              ? tabYoutubeEmbed
              : tabShouldUseProxy
                ? `/api/browse?url=${encodeURIComponent(tab.url)}`
                : tab.url;

          return (
            <div
              key={tab.id}
              className={
                isTabActive ? 'flex-1 flex flex-col overflow-hidden' : 'hidden'
              }
            >
              {tab.url === 'chrome://newtab' ? (
                <div className="flex-1 overflow-y-auto flex flex-col items-center justify-center px-6 py-10 bg-white">
                  {/* Google Wordmark */}
                  <div className="text-[54px] font-semibold tracking-tight mb-6 select-none">
                    <span className="text-[#4285f4]">G</span>
                    <span className="text-[#ea4335]">o</span>
                    <span className="text-[#fbbc05]">o</span>
                    <span className="text-[#4285f4]">g</span>
                    <span className="text-[#34a853]">l</span>
                    <span className="text-[#ea4335]">e</span>
                  </div>

                  {/* Search Box */}
                  <form
                    onSubmit={handleNewTabSearch}
                    className="w-full max-w-[540px] flex items-center h-[44px] px-4 rounded-full bg-white border border-[#dfe1e5] shadow-[0_1px_6px_rgba(32,33,36,0.12)] hover:shadow-[0_2px_8px_rgba(32,33,36,0.18)] focus-within:shadow-[0_2px_8px_rgba(32,33,36,0.2)] gap-3 mb-4"
                  >
                    <span className="text-[#9aa0a6] text-[15px]">🔍</span>
                    <input
                      type="text"
                      value={newTabQuery}
                      onChange={(e) => setNewTabQuery(e.target.value)}
                      placeholder={`Search ${SEARCH_ENGINES[searchEngine].label} or type a URL`}
                      className="flex-1 bg-transparent outline-none text-[14px] text-[#202124] placeholder:text-[#5f6368] select-text"
                    />
                  </form>

                  {/* Search Engine Selector */}
                  <div className="flex items-center gap-1.5 mb-8 text-[12px]">
                    <span className="text-[#5f6368] mr-1">Search with:</span>
                    {(Object.keys(SEARCH_ENGINES) as SearchEngine[]).map((key) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setSearchEngine(key)}
                        className={[
                          'px-2.5 py-1 rounded-full transition-colors',
                          searchEngine === key
                            ? 'bg-[#e8f0fe] text-[#1a73e8] font-medium'
                            : 'bg-[#f1f3f4] text-[#5f6368] hover:bg-[#e8eaed]',
                        ].join(' ')}
                      >
                        {SEARCH_ENGINES[key].label}
                      </button>
                    ))}
                  </div>

                  {/* Quick Shortcuts Grid */}
                  <div className="grid grid-cols-4 gap-3 max-w-[440px] w-full">
                    {QUICK_SHORTCUTS.map((item) => (
                      <button
                        key={item.url}
                        type="button"
                        onClick={() => navigateTab(tab.id, item.url)}
                        className="flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-[#f1f3f4] transition-colors"
                      >
                        <div
                          style={{ backgroundColor: item.color }}
                          className="w-11 h-11 rounded-full text-white flex items-center justify-center text-[18px] font-semibold shadow-sm"
                        >
                          {item.badge}
                        </div>
                        <span className="text-[12px] text-[#202124] truncate w-full text-center">
                          {item.title}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
              ) : tabYoutubeMode && proxyAvailable ? (
                <YouTubeView
                  url={tab.url}
                  reloadNonce={tab.reloadNonce}
                  isMuted={Boolean(tab.isMuted)}
                  onNavigate={(nextUrl) => navigateTab(tab.id, nextUrl)}
                  onTitleChange={(nextTitle) =>
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.id === tab.id ? { ...t, title: nextTitle, isLoading: false } : t,
                      ),
                    )
                  }
                  onAudioChange={(playing) =>
                    setTabs((prev) =>
                      prev.map((t) =>
                        t.id === tab.id ? { ...t, hasAudio: playing } : t,
                      ),
                    )
                  }
                />
              ) : tab.url === 'chrome://history' ? (
                <div className="flex-1 overflow-y-auto p-6 max-w-[760px] w-full mx-auto">
                  <div className="flex items-center justify-between mb-4 pb-3 border-b border-[#dadce0]">
                    <h1 className="text-[20px] font-medium text-[#202124]">History</h1>
                    <button
                      type="button"
                      onClick={() => setHistoryEntries([])}
                      className="px-3 py-1.5 rounded bg-[#f1f3f4] hover:bg-[#e8eaed] text-[12px] text-[#202124]"
                    >
                      Clear browsing data
                    </button>
                  </div>
                  {historyEntries.length === 0 ? (
                    <p className="text-[13px] text-[#5f6368]">No browsing history yet.</p>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {historyEntries.map((entry) => (
                        <button
                          key={entry.id}
                          type="button"
                          onClick={() => navigateTab(tab.id, entry.url)}
                          className="flex items-center justify-between gap-4 px-3 py-2 rounded hover:bg-[#f1f3f4] text-left"
                        >
                          <div className="min-w-0 flex-1">
                            <div className="text-[13px] text-[#202124] truncate">{entry.title}</div>
                            <div className="text-[11px] text-[#5f6368] truncate">{entry.url}</div>
                          </div>
                          <span className="text-[11px] text-[#5f6368] shrink-0">
                            {new Date(entry.visitedAt).toLocaleTimeString()}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : tab.url === 'chrome://bookmarks' ? (
                <div className="flex-1 overflow-y-auto p-6 max-w-[760px] w-full mx-auto">
                  <h1 className="text-[20px] font-medium text-[#202124] mb-4 pb-3 border-b border-[#dadce0]">
                    Bookmarks
                  </h1>
                  <div className="flex flex-col gap-1">
                    {bookmarks.map((bm) => (
                      <div
                        key={bm.id}
                        className="flex items-center justify-between gap-3 px-3 py-2 rounded hover:bg-[#f1f3f4]"
                      >
                        <button
                          type="button"
                          onClick={() => navigateTab(tab.id, bm.url)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="text-[13px] text-[#202124] truncate">{bm.title}</div>
                          <div className="text-[11px] text-[#5f6368] truncate">{bm.url}</div>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setBookmarks((prev) => prev.filter((item) => item.id !== bm.id))
                          }
                          className="px-2 py-1 rounded text-[12px] text-[#5f6368] hover:bg-[#dadce0]"
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : iframeError && isTabActive ? (
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <h2 className="text-[18px] font-medium text-[#202124] mb-2">
                    Unable to display this page inside Chrome
                  </h2>
                  <p className="text-[13px] text-[#5f6368] max-w-[440px] mb-5">
                    {iframeError}
                  </p>
                  <div className="flex items-center gap-3">
                    {proxyAvailable && !proxyEnabled && (
                      <button
                        type="button"
                        onClick={() => {
                          setProxyEnabled(true);
                          handleReload();
                        }}
                        className="px-4 py-2 rounded-full bg-[#1a73e8] text-white text-[13px] hover:bg-[#1765cc]"
                      >
                        Retry with Proxy ON
                      </button>
                    )}
                    <a
                      href={tab.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 rounded-full bg-[#f1f3f4] text-[#202124] text-[13px] hover:bg-[#e8eaed]"
                    >
                      Open in external tab
                    </a>
                  </div>
                </div>
              ) : (
                <iframe
                  {...{ credentialless: window.crossOriginIsolated }}
                  key={`${tab.id}-${tab.reloadNonce}-${tabShouldUseProxy ? 'proxy' : 'direct'}`}
                  ref={(el) => {
                    iframeRefs.current[tab.id] = el;
                  }}
                  src={tabIframeSrc}
                  title={tab.title}
                  onLoad={() => {
                    setTabs((prev) =>
                      prev.map((t) => (t.id === tab.id ? { ...t, isLoading: false } : t)),
                    );
                  }}
                  onError={() => {
                    setTabs((prev) =>
                      prev.map((t) => (t.id === tab.id ? { ...t, isLoading: false } : t)),
                    );
                    if (isTabActive) {
                      setIframeError('The website refused to connect or blocked embedding.');
                    }
                  }}
                  sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-presentation"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0 bg-white"
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
