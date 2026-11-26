import { useEffect, useState, type FormEvent } from 'react';
import { formatStorageBytes, useFileSystemStore } from '../../store/useFileSystemStore';
import { useDesktopStore } from '../../store/useDesktopStore';

interface VideoInfo {
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  webpageUrl: string;
}

interface DownloadHistoryItem {
  id: string;
  fileName: string;
  sizeBytes: number;
  mode: 'video' | 'audio';
  win10NodeId: string | null;
  win10FolderId: string | null;
  blobUrl: string;
  createdAt: number;
}

type SaveTarget = 'pc' | 'win10' | 'both';

function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  if (h > 0) {
    return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }
  return `${m}:${String(s).padStart(2, '0')}`;
}

function triggerBrowserDownload(blobUrl: string, fileName: string) {
  const a = document.createElement('a');
  a.href = blobUrl;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

export function YouTubeDownloaderApp() {
  const createMediaFile = useFileSystemStore((state) => state.createMediaFile);
  const openApp = useDesktopStore((state) => state.openApp);
  const openMediaFile = useDesktopStore((state) => state.openMediaFile);

  const [health, setHealth] = useState<{ ok: boolean; ytdlp: string | null; ffmpeg: boolean } | null>(
    null,
  );
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'video' | 'audio'>('video');
  const [videoQuality, setVideoQuality] = useState<'best' | '1080' | '720' | '480'>('best');
  const [audioQuality, setAudioQuality] = useState<'mp3' | 'm4a'>('mp3');
  const [saveTarget, setSaveTarget] = useState<SaveTarget>('both');
  const [win10Folder, setWin10Folder] = useState<'downloads' | 'videos' | 'music' | 'desktop' | 'drive-d'>(
    'downloads',
  );

  const [isFetchingInfo, setIsFetchingInfo] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [videoInfo, setVideoInfo] = useState<VideoInfo | null>(null);
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);

  useEffect(() => {
    let active = true;
    fetch('/api/yt/health')
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((data) => {
        if (active) setHealth(data);
      })
      .catch(() => {
        if (active) setHealth({ ok: false, ytdlp: null, ffmpeg: false });
      });
    return () => {
      active = false;
    };
  }, []);

  const handleFetchInfo = async (e?: FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = url.trim();
    if (!trimmed) return;
    setErrorMessage(null);
    setStatusMessage('Fetching video metadata with yt-dlp...');
    setIsFetchingInfo(true);
    try {
      const res = await fetch('/api/yt/info', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to fetch video info');
      }
      setVideoInfo(data as VideoInfo);
      setStatusMessage(null);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Unable to fetch video info.');
      setStatusMessage(null);
    } finally {
      setIsFetchingInfo(false);
    }
  };

  const handleDownload = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setErrorMessage('Please paste a YouTube URL first.');
      return;
    }

    setErrorMessage(null);
    setIsDownloading(true);
    setStatusMessage('Downloading & processing with yt-dlp + ffmpeg... This may take a moment.');

    try {
      const quality = mode === 'audio' ? audioQuality : videoQuality;
      const res = await fetch('/api/yt/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed, mode, quality }),
      });

      if (!res.ok) {
        const errData = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(errData.error || `Download failed (${res.status})`);
      }

      const rawHeaderName = res.headers.get('X-File-Name');
      const fileName = rawHeaderName
        ? decodeURIComponent(rawHeaderName)
        : mode === 'audio'
          ? `audio.${audioQuality}`
          : 'video.mp4';

      const blob = await res.blob();
      const blobUrl = URL.createObjectURL(blob);

      if (saveTarget === 'pc' || saveTarget === 'both') {
        triggerBrowserDownload(blobUrl, fileName);
      }

      let win10NodeId: string | null = null;
      const targetFolder = mode === 'audio' && win10Folder === 'videos' ? 'music' : win10Folder;
      if (saveTarget === 'win10' || saveTarget === 'both') {
        win10NodeId = await createMediaFile(targetFolder, fileName, blob);
      }

      setHistory((prev) => [
        {
          id: `${Date.now()}`,
          fileName,
          sizeBytes: blob.size,
          mode,
          win10NodeId,
          win10FolderId: win10NodeId ? targetFolder : null,
          blobUrl,
          createdAt: Date.now(),
        },
        ...prev,
      ]);

      setStatusMessage(
        saveTarget === 'pc'
          ? `Downloaded "${fileName}" to your PC.`
          : saveTarget === 'win10'
            ? `Saved "${fileName}" to Win 10 (${targetFolder}).`
            : `Downloaded "${fileName}" to your PC and saved to Win 10 (${targetFolder}).`,
      );
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Download failed.');
      setStatusMessage(null);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#181818] text-white select-none">
      {/* Top Banner */}
      <header className="flex items-center justify-between px-5 py-3 bg-[#202020] border-b border-white/10 shrink-0">
        <div className="flex items-center gap-3">
          <img src="/assets/icons/yt-downloader.svg" alt="" className="w-7 h-7 object-contain" />
          <div>
            <h1 className="text-[14px] font-semibold text-white leading-tight">
              YouTube Downloader
            </h1>
            <p className="text-[11px] text-white/60">Powered by yt-dlp &amp; ffmpeg</p>
          </div>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span
            className={[
              'px-2 py-0.5 border',
              health?.ok
                ? 'bg-[#107c10]/25 border-[#107c10] text-[#7dff7d]'
                : 'bg-[#a4262c]/25 border-[#a4262c] text-[#ff9b9b]',
            ].join(' ')}
          >
            {health === null
              ? 'Checking yt-dlp...'
              : health.ok
                ? `yt-dlp ${health.ytdlp}`
                : 'yt-dlp unavailable'}
          </span>
          {health?.ok && (
            <span className="px-2 py-0.5 bg-white/5 border border-white/15 text-white/75">
              {health.ffmpeg ? 'ffmpeg ready' : 'ffmpeg missing'}
            </span>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-5 space-y-4">
        {/* URL Input */}
        <form onSubmit={handleFetchInfo} className="flex gap-2">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="Paste YouTube video URL (e.g. https://www.youtube.com/watch?v=...)"
            aria-label="YouTube URL"
            className="flex-1 h-[34px] px-3 bg-[#262626] border border-white/20 focus:border-[#0078d7] text-[12.5px] text-white outline-none placeholder:text-white/40"
          />
          <button
            type="submit"
            disabled={isFetchingInfo || isDownloading || !url.trim()}
            className="px-4 h-[34px] bg-[#333333] hover:bg-[#444444] disabled:opacity-45 border border-white/15 text-[12.5px] text-white cursor-default"
          >
            {isFetchingInfo ? 'Fetching...' : 'Get Info'}
          </button>
        </form>

        {/* Video Info Card */}
        {videoInfo && (
          <div className="flex gap-4 p-3 bg-[#222222] border border-white/10">
            {videoInfo.thumbnail && (
              <div className="relative w-[168px] h-[94px] bg-black shrink-0 overflow-hidden">
                <img
                  src={videoInfo.thumbnail}
                  alt={videoInfo.title}
                  className="w-full h-full object-cover"
                />
                {videoInfo.duration > 0 && (
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 bg-black/80 text-[10.5px] text-white tabular-nums">
                    {formatDuration(videoInfo.duration)}
                  </span>
                )}
              </div>
            )}
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <div className="text-[13.5px] font-medium text-white line-clamp-2">
                {videoInfo.title}
              </div>
              <div className="text-[12px] text-white/65 mt-1">{videoInfo.channel}</div>
            </div>
          </div>
        )}

        {/* Format & Destination Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 bg-[#202020] border border-white/10">
          <div className="space-y-3">
            <div className="text-[12px] font-medium text-white/80">Format &amp; Quality</div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setMode('video')}
                className={[
                  'flex-1 h-[30px] text-[12px] border cursor-default',
                  mode === 'video'
                    ? 'bg-[#0078d7] border-[#0078d7] text-white'
                    : 'bg-[#2a2a2a] border-white/15 text-white/80 hover:bg-[#333333]',
                ].join(' ')}
              >
                Video (MP4)
              </button>
              <button
                type="button"
                onClick={() => setMode('audio')}
                className={[
                  'flex-1 h-[30px] text-[12px] border cursor-default',
                  mode === 'audio'
                    ? 'bg-[#0078d7] border-[#0078d7] text-white'
                    : 'bg-[#2a2a2a] border-white/15 text-white/80 hover:bg-[#333333]',
                ].join(' ')}
              >
                Audio Only
              </button>
            </div>

            {mode === 'video' ? (
              <select
                value={videoQuality}
                onChange={(e) => setVideoQuality(e.target.value as typeof videoQuality)}
                aria-label="Video quality"
                className="w-full h-[30px] px-2.5 bg-[#2a2a2a] border border-white/20 text-[12px] text-white outline-none"
              >
                <option value="best">Best Available (MP4)</option>
                <option value="1080">1080p Full HD (MP4)</option>
                <option value="720">720p HD (MP4)</option>
                <option value="480">480p SD (MP4)</option>
              </select>
            ) : (
              <select
                value={audioQuality}
                onChange={(e) => setAudioQuality(e.target.value as typeof audioQuality)}
                aria-label="Audio format"
                className="w-full h-[30px] px-2.5 bg-[#2a2a2a] border border-white/20 text-[12px] text-white outline-none"
              >
                <option value="mp3">MP3 (Best Quality)</option>
                <option value="m4a">M4A (AAC)</option>
              </select>
            )}
          </div>

          <div className="space-y-3">
            <div className="text-[12px] font-medium text-white/80">Save Destination</div>
            <select
              value={saveTarget}
              onChange={(e) => setSaveTarget(e.target.value as SaveTarget)}
              aria-label="Save destination"
              className="w-full h-[30px] px-2.5 bg-[#2a2a2a] border border-white/20 text-[12px] text-white outline-none"
            >
              <option value="both">Both (Real PC + Win 10 Virtual OS)</option>
              <option value="pc">Real PC (Browser Download)</option>
              <option value="win10">Win 10 Virtual OS (IndexedDB)</option>
            </select>

            {(saveTarget === 'win10' || saveTarget === 'both') && (
              <select
                value={win10Folder}
                onChange={(e) => setWin10Folder(e.target.value as typeof win10Folder)}
                aria-label="Win 10 folder"
                className="w-full h-[30px] px-2.5 bg-[#2a2a2a] border border-white/20 text-[12px] text-white outline-none"
              >
                <option value="downloads">Win 10 → Downloads</option>
                <option value="videos">Win 10 → Videos</option>
                <option value="music">Win 10 → Music</option>
                <option value="desktop">Win 10 → Desktop</option>
                <option value="drive-d">Win 10 → Local Disk (D:)</option>
              </select>
            )}
          </div>
        </div>

        {/* Download Button */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            disabled={isDownloading || !url.trim() || health?.ok === false}
            onClick={handleDownload}
            className="px-6 h-[36px] bg-[#e62117] hover:bg-[#ff2b20] disabled:opacity-45 text-[13px] font-medium text-white cursor-default transition-colors"
          >
            {isDownloading
              ? 'Downloading...'
              : mode === 'audio'
                ? `Download Audio (${audioQuality.toUpperCase()})`
                : 'Download Video (MP4)'}
          </button>

          {statusMessage && <span className="text-[12px] text-[#76b9ed]">{statusMessage}</span>}
          {errorMessage && <span className="text-[12px] text-[#ff7b7b]">{errorMessage}</span>}
        </div>

        {/* History */}
        {history.length > 0 && (
          <div className="pt-2 space-y-2">
            <div className="text-[12px] font-medium text-white/80">Downloaded Items</div>
            <div className="divide-y divide-white/10 border border-white/10 bg-[#202020]">
              {history.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-[12px]"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src="/assets/icons/media-file.svg"
                      alt=""
                      className="w-5 h-5 object-contain shrink-0"
                    />
                    <div className="min-w-0">
                      <div className="text-white truncate">{item.fileName}</div>
                      <div className="text-[11px] text-white/55">
                        {formatStorageBytes(item.sizeBytes)} •{' '}
                        {item.mode === 'audio' ? 'Audio' : 'Video'}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {item.win10NodeId && (
                      <button
                        type="button"
                        onClick={() => openMediaFile(item.win10NodeId)}
                        className="px-2.5 py-1 bg-[#0078d7] hover:bg-[#198ae6] text-[11px] text-white cursor-default"
                      >
                        Play in Win 10
                      </button>
                    )}
                    {item.win10FolderId && (
                      <button
                        type="button"
                        onClick={() => openApp('explorer', item.win10FolderId!)}
                        className="px-2.5 py-1 bg-[#333333] hover:bg-[#444444] text-[11px] text-white cursor-default"
                      >
                        Open Folder
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => triggerBrowserDownload(item.blobUrl, item.fileName)}
                      className="px-2.5 py-1 bg-[#333333] hover:bg-[#444444] text-[11px] text-white cursor-default"
                    >
                      Save to PC
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
