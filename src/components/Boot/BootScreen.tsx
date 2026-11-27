import { useEffect, useState } from 'react';
import { DESKTOP_APPS } from '../../data/desktopApps';
import { useDesktopStore } from '../../store/useDesktopStore';
import { useFileSystemStore } from '../../store/useFileSystemStore';
import { playSound, preloadCoreSounds } from '../../utils/soundManager';

const CRITICAL_WALLPAPERS = [
  '/assets/wallpapers/lock-screen.jpg',
  '/assets/wallpapers/win10-hero.jpg',
];

const SECONDARY_ASSETS = [
  '/assets/wallpapers/img1.jpg',
  '/assets/wallpapers/img2.jpg',
  '/assets/wallpapers/img3.jpg',
  '/assets/wallpapers/img4.jpg',
  '/assets/icons/drive-os.png',
  '/assets/icons/folder-win10.png',
  '/assets/icons/display-settings.svg',
  '/assets/icons/personalize.svg',
  '/assets/icons/txt-file.svg',
  '/assets/icons/explorer/desk.png',
  '/assets/icons/explorer/docs.png',
  '/assets/icons/explorer/down.png',
  '/assets/icons/explorer/music.png',
  '/assets/icons/explorer/pics.png',
  '/assets/icons/explorer/vid.png',
  '/assets/icons/explorer/star-sm.png',
];

function preloadImage(src: string): Promise<void> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve();
    img.onerror = () => resolve();
    img.src = src;
  });
}

export function BootScreen() {
  const [progress, setProgress] = useState(0);
  const [fadingOut, setFadingOut] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    preloadCoreSounds();
    const desktopIcons = DESKTOP_APPS.filter((a) => a.showOnDesktop !== false).map((a) => a.icon);
    const assetUrls = Array.from(new Set([...desktopIcons, ...CRITICAL_WALLPAPERS]));
    const total = assetUrls.length + 1;
    let completed = 0;

    const tick = () => {
      completed += 1;
      if (!cancelled) {
        setProgress(Math.min(100, Math.round((completed / total) * 100)));
      }
    };

    const hydrateStores = Promise.all([
      useDesktopStore.getState().hydrate(),
      useFileSystemStore.getState().hydrate(),
    ]).then(tick);

    const loadImages = Promise.all(
      assetUrls.map((url) => preloadImage(url).then(tick)),
    );

    const minDisplayDelay = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 500);
    });

    const safetyTimeout = new Promise<void>((resolve) => {
      window.setTimeout(resolve, 4000);
    });

    Promise.race([
      Promise.all([hydrateStores, loadImages, minDisplayDelay]),
      safetyTimeout,
    ]).then(() => {
      if (cancelled) return;
      setProgress(100);
      setFadingOut(true);
      playSound('startup');
      window.setTimeout(() => {
        if (!cancelled) {
          setDismissed(true);
          // Warm secondary icons and wallpapers quietly after desktop becomes interactive.
          const nonDesktopIcons = DESKTOP_APPS.filter((a) => a.showOnDesktop === false).map((a) => a.icon);
          for (const url of new Set([...nonDesktopIcons, ...SECONDARY_ASSETS])) {
            void preloadImage(url);
          }
        }
      }, 450);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  if (dismissed) return null;

  return (
    <div
      role="status"
      aria-label="Windows 10 loading screen"
      style={{
        backgroundImage: 'url("/assets/wallpapers/lock-screen.jpg")',
      }}
      className={[
        'fixed inset-0 z-[200] bg-[#0a2342] bg-cover bg-center flex flex-col items-center justify-center select-none transition-opacity duration-500',
        fadingOut ? 'opacity-0 pointer-events-none' : 'opacity-100',
      ].join(' ')}
    >
      <div className="absolute inset-0 bg-black/35 backdrop-blur-md" />

      <div className="relative z-10 flex flex-col items-center text-white">
        {/* User Avatar Circle */}
        <div className="w-[152px] h-[152px] rounded-full bg-white/18 border border-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg">
          <svg
            viewBox="0 0 64 64"
            width="84"
            height="84"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.8"
            aria-hidden="true"
            className="text-white"
          >
            <circle cx="32" cy="21" r="11" />
            <path d="M12 52C12 40.5 21 34 32 34C43 34 52 40.5 52 52" strokeLinecap="round" />
          </svg>
        </div>

        {/* Username */}
        <p className="mt-4 text-[34px] font-light tracking-tight text-white drop-shadow">
          User
        </p>

        {/* Windows 10 Ring Spinner + Welcome */}
        <div className="mt-3 flex items-center gap-3">
          <div className="relative w-[22px] h-[22px]" aria-hidden="true">
            {[0, 1, 2, 3, 4].map((idx) => (
              <span
                key={idx}
                className="win10-ring-dot"
                style={{ animationDelay: `${idx * 170}ms` }}
              />
            ))}
          </div>
          <span className="text-[19px] font-light text-white/95 drop-shadow">
            Welcome
          </span>
        </div>

        {/* Asset preload progress */}
        <div
          data-testid="boot-loading-progress"
          className="mt-3 text-[12px] font-normal text-white/75 tracking-wide tabular-nums"
        >
          Loading assets... {progress}%
        </div>
      </div>
    </div>
  );
}
