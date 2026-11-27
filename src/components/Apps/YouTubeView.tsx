import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { YouTubeVideoItem } from '../../../shared/browseProxy';
import { apiClient } from '../../api/http';
import { useDesktopStore } from '../../store/useDesktopStore';

interface YouTubeViewProps {
  url: string;
  reloadNonce: number;
  isMuted?: boolean;
  onNavigate: (nextUrl: string) => void;
  onTitleChange: (title: string) => void;
  onAudioChange?: (playing: boolean) => void;
}

const CATEGORIES = [
  { label: 'All', query: 'popular music gaming tech' },
  { label: 'Music', query: 'music official mv 2026' },
  { label: 'Gaming', query: 'gaming highlights gameplay' },
  { label: 'Mixes', query: 'lofi hip hop mix' },
  { label: 'News', query: 'world tech news' },
  { label: 'Live', query: 'live stream music news' },
  { label: 'Coding', query: 'programming tutorial react' },
  { label: 'Trailers', query: 'movie game trailer' },
];

const SIDEBAR_ITEMS = [
  { label: 'Home', icon: '🏠', query: 'popular music gaming tech' },
  { label: 'Shorts', icon: '⚡', query: 'youtube shorts trending' },
  { label: 'Music', icon: '🎵', query: 'music official mv' },
  { label: 'Gaming', icon: '🎮', query: 'gaming gameplay' },
  { label: 'News', icon: '📰', query: 'tech news today' },
  { label: 'Coding', icon: '💻', query: 'web development react' },
];

function parseYouTubeUrl(rawUrl: string): {
  videoId: string | null;
  searchQuery: string;
} {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      return { videoId: parsed.pathname.slice(1) || null, searchQuery: '' };
    }
    if (parsed.pathname === '/watch') {
      return {
        videoId: parsed.searchParams.get('v'),
        searchQuery: parsed.searchParams.get('search_query') || '',
      };
    }
    if (parsed.pathname.startsWith('/shorts/') || parsed.pathname.startsWith('/embed/')) {
      return { videoId: parsed.pathname.split('/')[2] || null, searchQuery: '' };
    }
    return {
      videoId: null,
      searchQuery: parsed.searchParams.get('search_query') || '',
    };
  } catch {
    return { videoId: null, searchQuery: '' };
  }
}

export function YouTubeView({
  url,
  reloadNonce,
  isMuted = false,
  onNavigate,
  onTitleChange,
  onAudioChange,
}: YouTubeViewProps) {
  const { videoId, searchQuery } = parseYouTubeUrl(url);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeCategory, setActiveCategory] = useState('All');
  const [searchInput, setSearchInput] = useState(searchQuery);
  const [videos, setVideos] = useState<YouTubeVideoItem[]>([]);
  const [loading, setLoading] = useState(true);
  const playerIframeRef = useRef<HTMLIFrameElement | null>(null);
  const systemVolume = useDesktopStore((state) => state.systemVolume);
  const isSystemMuted = useDesktopStore((state) => state.isSystemMuted);
  const onTitleChangeRef = useRef(onTitleChange);
  onTitleChangeRef.current = onTitleChange;
  const onAudioChangeRef = useRef(onAudioChange);
  onAudioChangeRef.current = onAudioChange;

  useEffect(() => {
    onAudioChangeRef.current?.(Boolean(videoId));
    return () => {
      onAudioChangeRef.current?.(false);
    };
  }, [videoId]);

  useEffect(() => {
    const win = playerIframeRef.current?.contentWindow;
    if (!win || !videoId) return;
    const effectiveMuted = isMuted || isSystemMuted || systemVolume === 0;
    win.postMessage(
      JSON.stringify({
        event: 'command',
        func: 'setVolume',
        args: [systemVolume],
      }),
      '*',
    );
    win.postMessage(
      JSON.stringify({
        event: 'command',
        func: effectiveMuted ? 'mute' : 'unMute',
        args: [],
      }),
      '*',
    );
  }, [isMuted, isSystemMuted, systemVolume, videoId]);

  useEffect(() => {
    if (!videoId) return;
    const handleMsg = (event: MessageEvent) => {
      if (event.source !== playerIframeRef.current?.contentWindow) return;
      try {
        const data =
          typeof event.data === 'string'
            ? (JSON.parse(event.data) as { event?: string; info?: { playerState?: number } })
            : (event.data as { event?: string; info?: { playerState?: number } });
        if (data?.event === 'infoDelivery' && typeof data.info?.playerState === 'number') {
          // 1 = playing, 3 = buffering
          onAudioChangeRef.current?.(
            data.info.playerState === 1 || data.info.playerState === 3,
          );
        }
      } catch {
        // ignore non-JSON messages
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, [videoId]);

  useEffect(() => {
    setSearchInput(searchQuery);
  }, [searchQuery]);

  const effectiveQuery =
    searchQuery ||
    CATEGORIES.find((c) => c.label === activeCategory)?.query ||
    'popular music gaming tech';

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);

    apiClient
      .get<{ videos?: YouTubeVideoItem[] }>('/api/youtube', {
        params: { q: effectiveQuery },
        signal: controller.signal,
      })
      .then((res) => {
        if (controller.signal.aborted) return;
        const list = res.data?.videos ?? [];
        setVideos(list);
        setLoading(false);
        if (videoId) {
          const matched = list.find((v) => v.videoId === videoId);
          onTitleChangeRef.current(matched ? `${matched.title} - YouTube` : 'YouTube');
        } else if (searchQuery) {
          onTitleChangeRef.current(`${searchQuery} - YouTube`);
        } else {
          onTitleChangeRef.current('YouTube');
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => {
      controller.abort();
    };
  }, [effectiveQuery, videoId, searchQuery, reloadNonce]);

  const handleSearch = (e: FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    if (!q) {
      onNavigate('https://www.youtube.com');
      return;
    }
    onNavigate(`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`);
  };

  const activeVideo = videoId ? videos.find((v) => v.videoId === videoId) : null;

  return (
    <div className="flex-1 flex flex-col bg-[#0f0f0f] text-[#f1f1f1] overflow-hidden">
      {/* Top YouTube Header */}
      <header className="flex items-center justify-between gap-4 h-[52px] px-4 bg-[#0f0f0f] shrink-0">
        <div className="flex items-center gap-3 shrink-0">
          <button
            type="button"
            onClick={() => setSidebarOpen((v) => !v)}
            aria-label="Toggle YouTube menu"
            className="w-9 h-9 rounded-full flex items-center justify-center hover:bg-white/10 text-[18px]"
          >
            ☰
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveCategory('All');
              onNavigate('https://www.youtube.com');
            }}
            className="flex items-center gap-1.5 font-semibold text-[17px] tracking-tight"
          >
            <span className="inline-flex items-center justify-center w-7 h-5 rounded-[5px] bg-[#ff0000] text-white text-[11px] leading-none">
              ▶
            </span>
            <span>YouTube</span>
          </button>
        </div>

        {/* Search Bar */}
        <form
          onSubmit={handleSearch}
          className="flex-1 max-w-[540px] flex items-center h-[36px] bg-[#121212] border border-[#303030] rounded-full overflow-hidden focus-within:border-[#1c62b9]"
        >
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search"
            className="flex-1 bg-transparent px-4 text-[14px] text-white outline-none placeholder:text-[#888] select-text"
          />
          <button
            type="submit"
            aria-label="Search YouTube"
            className="w-[54px] h-full bg-[#222222] hover:bg-[#303030] border-l border-[#303030] flex items-center justify-center text-[14px]"
          >
            🔍
          </button>
        </form>

        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3 py-1.5 rounded-full bg-[#222222] text-[12px] font-medium">
            + Create
          </span>
          <span className="w-8 h-8 rounded-full bg-[#3ea6ff] text-[#0f0f0f] font-bold text-[13px] flex items-center justify-center">
            U
          </span>
        </div>
      </header>

      {/* Body */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar (Home / Browse mode) */}
        {!videoId && sidebarOpen && (
          <aside className="w-[180px] shrink-0 overflow-y-auto px-2.5 py-2 border-r border-white/5 hidden sm:flex flex-col gap-1">
            {SIDEBAR_ITEMS.map((item) => {
              const isSelected =
                !searchQuery &&
                (item.label === activeCategory ||
                  (item.label === 'Home' && activeCategory === 'All'));
              return (
                <button
                  key={item.label}
                  type="button"
                  onClick={() => {
                    setActiveCategory(item.label === 'Home' ? 'All' : item.label);
                    onNavigate('https://www.youtube.com');
                  }}
                  className={[
                    'flex items-center gap-3.5 px-3 py-2 rounded-lg text-[13px] text-left transition-colors',
                    isSelected
                      ? 'bg-[#272727] font-medium text-white'
                      : 'text-[#f1f1f1] hover:bg-[#272727]/60',
                  ].join(' ')}
                >
                  <span className="text-[15px] w-5 text-center">{item.icon}</span>
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </aside>
        )}

        {/* Main Content */}
        {videoId ? (
          <div className="flex-1 overflow-y-auto p-4 lg:p-6 flex flex-col lg:flex-row gap-5">
            {/* Player Column */}
            <div className="flex-1 min-w-0 flex flex-col">
              <div className="w-full aspect-video rounded-xl overflow-hidden bg-black">
                <iframe
                  {...{ credentialless: window.crossOriginIsolated }}
                  key={videoId}
                  ref={playerIframeRef}
                  src={`https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1&enablejsapi=1`}
                  onLoad={() => {
                    playerIframeRef.current?.contentWindow?.postMessage(
                      JSON.stringify({ event: 'listening' }),
                      '*',
                    );
                  }}
                  title={activeVideo?.title || 'YouTube Video Player'}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full border-0"
                />
              </div>
              <h1 className="text-[18px] font-semibold mt-3 leading-snug">
                {activeVideo?.title || 'YouTube Video'}
              </h1>
              {activeVideo && (
                <div className="flex items-center gap-3 mt-2.5 pb-3 border-b border-white/10">
                  <div className="w-9 h-9 rounded-full bg-[#272727] flex items-center justify-center text-[14px] font-semibold shrink-0">
                    {activeVideo.channel.slice(0, 1).toUpperCase() || 'Y'}
                  </div>
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium truncate">{activeVideo.channel}</div>
                    <div className="text-[12px] text-[#aaaaaa]">
                      {[activeVideo.views, activeVideo.published].filter(Boolean).join(' • ')}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Up Next Sidebar */}
            <div className="w-full lg:w-[340px] shrink-0 flex flex-col gap-2.5">
              <div className="text-[13px] font-medium text-[#aaaaaa] mb-0.5">Up next</div>
              {videos
                .filter((v) => v.videoId !== videoId)
                .slice(0, 12)
                .map((vid) => (
                  <button
                    key={vid.videoId}
                    type="button"
                    onClick={() =>
                      onNavigate(
                        `https://www.youtube.com/watch?v=${encodeURIComponent(vid.videoId)}`,
                      )
                    }
                    className="flex gap-2.5 text-left rounded-lg p-1 hover:bg-white/10 transition-colors"
                  >
                    <div className="relative w-[150px] aspect-video rounded-lg overflow-hidden bg-[#222] shrink-0">
                      <img
                        src={vid.thumbnail}
                        alt={vid.title}
                        className="w-full h-full object-cover"
                      />
                      {vid.duration && (
                        <span className="absolute bottom-1 right-1 px-1 py-0.5 rounded bg-black/80 text-[10px] font-medium">
                          {vid.duration}
                        </span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-medium line-clamp-2 leading-snug mb-1">
                        {vid.title}
                      </div>
                      <div className="text-[11px] text-[#aaaaaa] truncate">{vid.channel}</div>
                      <div className="text-[11px] text-[#aaaaaa] truncate">
                        {[vid.views, vid.published].filter(Boolean).join(' • ')}
                      </div>
                    </div>
                  </button>
                ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Category Chips */}
            <div className="flex items-center gap-2 px-4 py-2.5 overflow-x-auto shrink-0 border-b border-white/5">
              {CATEGORIES.map((cat) => {
                const isSelected = !searchQuery && activeCategory === cat.label;
                return (
                  <button
                    key={cat.label}
                    type="button"
                    onClick={() => {
                      setActiveCategory(cat.label);
                      onNavigate('https://www.youtube.com');
                    }}
                    className={[
                      'px-3 py-1.5 rounded-lg text-[13px] font-medium whitespace-nowrap transition-colors',
                      isSelected
                        ? 'bg-[#f1f1f1] text-[#0f0f0f]'
                        : 'bg-[#272727] text-[#f1f1f1] hover:bg-[#3f3f3f]',
                    ].join(' ')}
                  >
                    {cat.label}
                  </button>
                );
              })}
            </div>

            {/* Video Grid */}
            <div className="flex-1 overflow-y-auto p-4">
              {loading ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {Array.from({ length: 9 }).map((_, idx) => (
                    <div key={idx} className="flex flex-col gap-2.5 animate-pulse">
                      <div className="aspect-video w-full rounded-xl bg-[#272727]" />
                      <div className="h-4 bg-[#272727] rounded w-4/5" />
                      <div className="h-3 bg-[#272727] rounded w-1/2" />
                    </div>
                  ))}
                </div>
              ) : videos.length === 0 ? (
                <div className="flex items-center justify-center py-16 text-[14px] text-[#aaaaaa]">
                  No videos found. Try another search.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-4 gap-y-6">
                  {videos.map((vid) => (
                    <button
                      key={vid.videoId}
                      type="button"
                      onClick={() =>
                        onNavigate(
                          `https://www.youtube.com/watch?v=${encodeURIComponent(vid.videoId)}`,
                        )
                      }
                      className="group flex flex-col text-left"
                    >
                      <div className="relative aspect-video w-full rounded-xl overflow-hidden bg-[#222] mb-2.5">
                        <img
                          src={vid.thumbnail}
                          alt={vid.title}
                          className="w-full h-full object-cover group-hover:scale-[1.02] transition-transform duration-150"
                        />
                        {vid.duration && (
                          <span className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded bg-black/80 text-[11px] font-medium text-white">
                            {vid.duration}
                          </span>
                        )}
                      </div>
                      <div className="flex gap-3">
                        <div className="w-9 h-9 rounded-full bg-[#272727] text-white flex items-center justify-center text-[13px] font-semibold shrink-0 mt-0.5">
                          {vid.channel.slice(0, 1).toUpperCase() || 'Y'}
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className="text-[14px] font-medium text-[#f1f1f1] line-clamp-2 leading-snug mb-1">
                            {vid.title}
                          </div>
                          <div className="text-[12px] text-[#aaaaaa] truncate">{vid.channel}</div>
                          <div className="text-[12px] text-[#aaaaaa] truncate">
                            {[vid.views, vid.published].filter(Boolean).join(' • ')}
                          </div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
