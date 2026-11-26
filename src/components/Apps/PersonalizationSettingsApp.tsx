import { useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import {
  DEFAULT_PERSONALIZATION_SETTINGS,
  useDesktopStore,
  type PersonalizationTab,
} from '../../store/useDesktopStore';
import type { BackgroundFit, BackgroundType } from '../../db/types';
import { TaskbarSettingsPanel } from './TaskbarSettingsApp';

const BUILT_IN_WALLPAPERS = [
  { id: 'hero', name: 'Windows 10 Hero', src: '/assets/wallpapers/win10-hero.jpg' },
  { id: 'img1', name: 'Windows 10 Light', src: '/assets/wallpapers/img1.jpg' },
  { id: 'img2', name: 'Beach Arch', src: '/assets/wallpapers/img2.jpg' },
  { id: 'img3', name: 'Ocean Wave', src: '/assets/wallpapers/img3.jpg' },
  { id: 'img4', name: 'Milky Way Tent', src: '/assets/wallpapers/img4.jpg' },
];

const WIN10_COLORS = [
  '#ffb900', '#ff8c00', '#f7630c', '#ca5010', '#da3b01', '#ef6950', '#d13438', '#ff4343',
  '#e74856', '#e81123', '#ea005e', '#c30052', '#e3008c', '#bf0077', '#c239b3', '#9a0089',
  '#0078d7', '#0063b1', '#8e8cd8', '#6b69d6', '#8764b8', '#744da9', '#b146c2', '#881798',
  '#0099bc', '#2d7d9a', '#00b7c3', '#038387', '#00b294', '#018574', '#00cc6a', '#10893e',
];

const PRESET_THEMES = [
  {
    name: 'Windows (light)',
    wallpaper: '/assets/wallpapers/win10-hero.jpg',
    accentColor: '#0078d7',
  },
  {
    name: 'Windows 10 Beach',
    wallpaper: '/assets/wallpapers/img2.jpg',
    accentColor: '#0099bc',
  },
  {
    name: 'Ocean Deep',
    wallpaper: '/assets/wallpapers/img3.jpg',
    accentColor: '#038387',
  },
  {
    name: 'Starry Night',
    wallpaper: '/assets/wallpapers/img4.jpg',
    accentColor: '#ff8c00',
  },
];

const NAV_ITEMS: Array<{ id: PersonalizationTab; label: string }> = [
  { id: 'Background', label: 'Background' },
  { id: 'Colors', label: 'Colors' },
  { id: 'Lock screen', label: 'Lock screen' },
  { id: 'Themes', label: 'Themes' },
  { id: 'Fonts', label: 'Fonts' },
  { id: 'Start', label: 'Start' },
  { id: 'Taskbar', label: 'Taskbar' },
];

export function getWallpaperCssProps(
  backgroundType: BackgroundType,
  wallpaper: string,
  backgroundFit: BackgroundFit,
  solidColor: string,
): CSSProperties {
  if (backgroundType === 'solid') {
    return {
      backgroundColor: solidColor,
      backgroundImage: 'none',
    };
  }

  const fitStyles: Record<BackgroundFit, CSSProperties> = {
    fill: { backgroundSize: 'cover', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' },
    fit: { backgroundSize: 'contain', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' },
    stretch: { backgroundSize: '100% 100%', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' },
    tile: { backgroundSize: 'auto', backgroundRepeat: 'repeat', backgroundPosition: 'top left' },
    center: { backgroundSize: 'auto', backgroundRepeat: 'no-repeat', backgroundPosition: 'center' },
  };

  return {
    backgroundColor: solidColor,
    backgroundImage: `url("${wallpaper}")`,
    ...fitStyles[backgroundFit],
  };
}

function DesktopPreviewMockup({
  bgStyle,
  accentColor,
}: {
  bgStyle: CSSProperties;
  accentColor: string;
}) {
  return (
    <div
      data-testid="personalize-preview"
      style={bgStyle}
      className="relative w-[336px] max-w-full h-[186px] border border-white/15 overflow-hidden shadow-md"
    >
      {/* Mini Start Menu + Window Preview */}
      <div className="absolute bottom-0 left-0 w-[168px] h-[112px] bg-[#181818]/92 border-t border-r border-white/15 flex p-2 gap-2">
        {/* Mini App List */}
        <div className="w-[54px] space-y-1.5 pt-1">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <span
                style={{ backgroundColor: accentColor }}
                className="w-2.5 h-2.5 shrink-0 inline-block"
              />
              <span className="h-[2px] flex-1 bg-white/70" />
            </div>
          ))}
        </div>
        {/* Mini Tiles */}
        <div className="flex-1 grid grid-cols-3 gap-1 pt-1">
          <div
            style={{ backgroundColor: accentColor }}
            className="col-span-2 row-span-2 flex items-center justify-center text-[13px] font-normal text-white"
          >
            Aa
          </div>
          <div style={{ backgroundColor: accentColor }} />
          <div style={{ backgroundColor: accentColor }} />
          <div style={{ backgroundColor: accentColor }} />
          <div style={{ backgroundColor: accentColor }} />
          <div style={{ backgroundColor: accentColor }} />
        </div>
      </div>

      {/* Mini Taskbar */}
      <div className="absolute bottom-0 inset-x-0 h-[10px] bg-black/80" />
    </div>
  );
}

export function PersonalizationSettingsApp() {
  const personalization = useDesktopStore((state) => state.personalizationSettings);
  const activeTab = useDesktopStore((state) => state.settingsActiveTab);
  const setActiveTab = useDesktopStore((state) => state.setSettingsActiveTab);
  const updatePersonalization = useDesktopStore((state) => state.updatePersonalizationSettings);
  const closeWindow = useDesktopStore((state) => state.closeWindow);

  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const previewStyle = getWallpaperCssProps(
    personalization.backgroundType,
    personalization.wallpaper,
    personalization.backgroundFit,
    personalization.solidColor,
  );

  const allPictureChoices = [
    ...BUILT_IN_WALLPAPERS.map((w) => w.src),
    ...personalization.customWallpapers,
  ];

  const handleBrowseFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null;
      if (!result) return;
      updatePersonalization((prev) => ({
        ...prev,
        backgroundType: 'picture',
        wallpaper: result,
        customWallpapers: prev.customWallpapers.includes(result)
          ? prev.customWallpapers
          : [result, ...prev.customWallpapers].slice(0, 6),
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const filteredNav = NAV_ITEMS.filter((item) =>
    item.label.toLowerCase().includes(searchQuery.trim().toLowerCase()),
  );

  const selectClass =
    'w-[270px] max-w-full h-[32px] px-2.5 bg-[#0f0f0f] border border-[#666666] hover:border-[#999999] text-[13px] text-white outline-none cursor-default';

  return (
    <div className="flex flex-1 min-h-0 bg-[#000000] text-white select-none">
      {/* Left Navigation Sidebar */}
      <aside
        aria-label="Personalization navigation"
        className="w-[232px] shrink-0 bg-[#1f1f1f] border-r border-white/10 flex flex-col py-2"
      >
        <button
          type="button"
          onClick={() => setActiveTab('Background')}
          className="flex items-center gap-3 h-[40px] px-4 text-[13.5px] text-white/90 hover:bg-white/10 cursor-default"
        >
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <polyline points="2,7.5 8,2 14,7.5" />
            <polyline points="3.5,6.5 3.5,14 12.5,14 12.5,6.5" />
          </svg>
          <span>Home</span>
        </button>

        <div className="px-3 py-2">
          <div className="relative flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find a setting"
              style={{ borderColor: searchQuery ? personalization.accentColor : '#555555' }}
              className="w-full h-[32px] pl-3 pr-8 bg-[#121212] border text-[13px] text-white placeholder:text-white/55 outline-none"
            />
            <svg
              viewBox="0 0 16 16"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.3"
              aria-hidden="true"
              className="absolute right-2.5 text-white/65 pointer-events-none"
            >
              <circle cx="9.5" cy="6.5" r="4" />
              <line x1="6.5" y1="9.5" x2="2.5" y2="13.5" />
            </svg>
          </div>
        </div>

        <div className="px-4 pt-3 pb-2 text-[13px] font-semibold text-white">
          Personalization
        </div>

        <nav className="flex flex-col">
          {filteredNav.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={[
                  'relative flex items-center h-[40px] px-4 text-[13.5px] text-left transition-colors cursor-default',
                  isActive
                    ? 'bg-white/10 text-white font-medium'
                    : 'text-white/80 hover:bg-white/6',
                ].join(' ')}
              >
                {isActive && (
                  <span
                    style={{ backgroundColor: personalization.accentColor }}
                    className="absolute left-0 top-2 bottom-2 w-[3px]"
                  />
                )}
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </aside>

      {/* Main Content */}
      <section className="win10-dark-scroll flex-1 overflow-y-auto px-8 py-6 bg-[#000000]">
        {activeTab === 'Background' && (
          <div className="space-y-5 max-w-[600px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Background</h1>

            <DesktopPreviewMockup
              bgStyle={previewStyle}
              accentColor={personalization.accentColor}
            />

            <div className="pt-2">
              <label className="block text-[13.5px] text-white/95 mb-2" htmlFor="bg-type-select">
                Background
              </label>
              <select
                id="bg-type-select"
                value={personalization.backgroundType}
                onChange={(e) =>
                  updatePersonalization({ backgroundType: e.target.value as BackgroundType })
                }
                className={selectClass}
              >
                <option value="picture">Picture</option>
                <option value="solid">Solid color</option>
              </select>
            </div>

            {personalization.backgroundType === 'picture' ? (
              <>
                <div>
                  <div className="text-[13.5px] text-white/95 mb-2">Choose your picture</div>
                  <div className="flex flex-wrap gap-2">
                    {allPictureChoices.map((src, idx) => {
                      const isSelected = personalization.wallpaper === src;
                      return (
                        <button
                          key={`${idx}-${src.slice(0, 48)}`}
                          type="button"
                          aria-label={`Wallpaper option ${idx + 1}`}
                          onClick={() => updatePersonalization({ wallpaper: src })}
                          style={
                            isSelected
                              ? { outline: `2px solid ${personalization.accentColor}`, outlineOffset: '1px' }
                              : undefined
                          }
                          className="w-[74px] h-[74px] overflow-hidden bg-[#1a1a1a] hover:opacity-90 cursor-default"
                        >
                          <img
                            src={src}
                            alt={`Wallpaper ${idx + 1}`}
                            draggable={false}
                            className="w-full h-full object-cover pointer-events-none"
                          />
                        </button>
                      );
                    })}
                  </div>

                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleBrowseFile}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-3 px-6 py-1.5 bg-[#333333] hover:bg-[#444444] active:bg-[#555555] text-[13px] text-white border border-white/10 cursor-default"
                  >
                    Browse
                  </button>
                </div>

                <div className="pt-1">
                  <label className="block text-[13.5px] text-white/95 mb-2" htmlFor="bg-fit-select">
                    Choose a fit
                  </label>
                  <select
                    id="bg-fit-select"
                    value={personalization.backgroundFit}
                    onChange={(e) =>
                      updatePersonalization({ backgroundFit: e.target.value as BackgroundFit })
                    }
                    className={selectClass}
                  >
                    <option value="fill">Fill</option>
                    <option value="fit">Fit</option>
                    <option value="stretch">Stretch</option>
                    <option value="tile">Tile</option>
                    <option value="center">Center</option>
                  </select>
                </div>
              </>
            ) : (
              <div>
                <div className="text-[13.5px] text-white/95 mb-2">
                  Choose your background color
                </div>
                <div className="grid grid-cols-8 gap-1.5 max-w-[336px]">
                  {WIN10_COLORS.map((color) => {
                    const isSelected = personalization.solidColor === color;
                    return (
                      <button
                        key={color}
                        type="button"
                        aria-label={`Background color ${color}`}
                        onClick={() => updatePersonalization({ solidColor: color })}
                        style={{ backgroundColor: color }}
                        className={[
                          'w-9 h-9 cursor-default transition-transform hover:scale-105',
                          isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : '',
                        ].join(' ')}
                      />
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {activeTab === 'Colors' && (
          <div className="space-y-5 max-w-[600px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Colors</h1>
            <DesktopPreviewMockup
              bgStyle={previewStyle}
              accentColor={personalization.accentColor}
            />
            <div>
              <div className="text-[13.5px] text-white/95 mb-2">Choose your accent color</div>
              <div className="grid grid-cols-8 gap-1.5 max-w-[336px]">
                {WIN10_COLORS.map((color) => {
                  const isSelected = personalization.accentColor === color;
                  return (
                    <button
                      key={`accent-${color}`}
                      type="button"
                      aria-label={`Accent color ${color}`}
                      onClick={() => updatePersonalization({ accentColor: color })}
                      style={{ backgroundColor: color }}
                      className={[
                        'w-9 h-9 cursor-default transition-transform hover:scale-105',
                        isSelected ? 'ring-2 ring-white ring-offset-2 ring-offset-black' : '',
                      ].join(' ')}
                    />
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Themes' && (
          <div className="space-y-5 max-w-[620px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Themes</h1>
            <p className="text-[13px] text-white/65">
              Apply a preset Windows 10 wallpaper and accent color theme.
            </p>
            <div className="grid grid-cols-2 gap-3 max-w-[460px]">
              {PRESET_THEMES.map((theme) => {
                const isActive =
                  personalization.backgroundType === 'picture' &&
                  personalization.wallpaper === theme.wallpaper &&
                  personalization.accentColor === theme.accentColor;
                return (
                  <button
                    key={theme.name}
                    type="button"
                    onClick={() =>
                      updatePersonalization({
                        backgroundType: 'picture',
                        wallpaper: theme.wallpaper,
                        accentColor: theme.accentColor,
                      })
                    }
                    style={
                      isActive ? { borderColor: personalization.accentColor } : undefined
                    }
                    className="flex flex-col text-left bg-[#181818] border border-white/15 hover:border-white/40 overflow-hidden cursor-default"
                  >
                    <img
                      src={theme.wallpaper}
                      alt={theme.name}
                      className="w-full h-[100px] object-cover"
                    />
                    <div className="flex items-center justify-between px-3 py-2 text-[12.5px]">
                      <span>{theme.name}</span>
                      <span
                        style={{ backgroundColor: theme.accentColor }}
                        className="w-3.5 h-3.5 inline-block"
                      />
                    </div>
                  </button>
                );
              })}
            </div>
            <div>
              <button
                type="button"
                onClick={() => updatePersonalization(DEFAULT_PERSONALIZATION_SETTINGS)}
                className="px-4 py-1.5 bg-[#333333] hover:bg-[#444444] text-[13px] border border-white/15 cursor-default"
              >
                Reset theme to default
              </button>
            </div>
          </div>
        )}

        {activeTab === 'Lock screen' && (
          <div className="space-y-4 max-w-[540px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Lock screen</h1>
            <div
              style={previewStyle}
              className="relative w-[336px] h-[186px] border border-white/15 flex flex-col justify-end p-4"
            >
              <div className="text-[32px] font-light leading-none text-white drop-shadow">
                09:55
              </div>
              <div className="text-[13px] text-white/95 drop-shadow mt-1">
                Thursday, November 26
              </div>
            </div>
            <p className="text-[13px] text-white/65">
              Lock screen currently mirrors your selected background image.
            </p>
          </div>
        )}

        {activeTab === 'Fonts' && (
          <div className="space-y-4 max-w-[540px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Fonts</h1>
            <div className="p-4 bg-[#181818] border border-white/10 space-y-2">
              <div className="text-[14px] font-semibold">Segoe UI (System Default)</div>
              <div className="text-[20px] font-light text-white/90">
                The quick brown fox jumps over the lazy dog
              </div>
              <div className="text-[12px] text-white/55">
                Used across Desktop labels, Taskbar, Start Menu, Calculator, and File Explorer.
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Start' && (
          <div className="space-y-4 max-w-[540px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Start</h1>
            <DesktopPreviewMockup
              bgStyle={previewStyle}
              accentColor={personalization.accentColor}
            />
            <p className="text-[13px] text-white/65">
              Start Menu uses Windows 10 3-column dark acrylic layout with pinned Productivity and Explore tiles.
            </p>
            <button
              type="button"
              onClick={() => closeWindow('settings')}
              className="px-4 py-1.5 bg-[#333333] hover:bg-[#444444] text-[13px] border border-white/15 cursor-default"
            >
              Close Settings
            </button>
          </div>
        )}

        {activeTab === 'Taskbar' && <TaskbarSettingsPanel />}
      </section>
    </div>
  );
}
