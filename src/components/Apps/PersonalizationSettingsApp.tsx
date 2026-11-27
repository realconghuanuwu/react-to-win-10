import { useRef, useState, type ChangeEvent, type CSSProperties } from 'react';
import {
  DEFAULT_PERSONALIZATION_SETTINGS,
  useDesktopStore,
  type PersonalizationTab,
} from '../../store/useDesktopStore';
import { formatStorageBytes, useFileSystemStore } from '../../store/useFileSystemStore';
import { notify } from '../../store/useNotificationStore';
import type { BackgroundFit, BackgroundType } from '../../db/types';
import {
  WIN10_SOUNDS,
  playSound,
  playVolumeChangeChime,
  type Win10SoundCategory,
} from '../../utils/soundManager';
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
  { name: 'Windows (light)', wallpaper: '/assets/wallpapers/win10-hero.jpg', accentColor: '#0078d7' },
  { name: 'Windows 10 Beach', wallpaper: '/assets/wallpapers/img2.jpg', accentColor: '#0099bc' },
  { name: 'Ocean Deep', wallpaper: '/assets/wallpapers/img3.jpg', accentColor: '#038387' },
  { name: 'Starry Night', wallpaper: '/assets/wallpapers/img4.jpg', accentColor: '#ff8c00' },
];

const NAV_GROUPS: Array<{ title: string; items: Array<{ id: PersonalizationTab; label: string }> }> = [
  {
    title: 'Personalization',
    items: [
      { id: 'Background', label: 'Background' },
      { id: 'Colors', label: 'Colors' },
      { id: 'Lock screen', label: 'Lock screen' },
      { id: 'Themes', label: 'Themes' },
      { id: 'Fonts', label: 'Fonts' },
      { id: 'Start', label: 'Start' },
      { id: 'Taskbar', label: 'Taskbar' },
    ],
  },
  {
    title: 'System & Device',
    items: [
      { id: 'Display', label: 'Display' },
      { id: 'Sound', label: 'Sound' },
      { id: 'Network', label: 'Network & Internet' },
      { id: 'Apps', label: 'Apps' },
      { id: 'Accounts', label: 'Accounts' },
      { id: 'Time', label: 'Time & language' },
      { id: 'Update', label: 'Update & Security' },
    ],
  },
];

const HOME_CATEGORIES: Array<{
  tab: PersonalizationTab;
  title: string;
  desc: string;
  glyph: string;
}> = [
  { tab: 'Display', title: 'System', desc: 'Display, brightness, night light, storage', glyph: '🖥' },
  { tab: 'Sound', title: 'Sound', desc: 'Volume, Windows 10 sound effects, USB', glyph: '🔊' },
  { tab: 'Network', title: 'Network & Internet', desc: 'Wi-Fi, airplane mode, VPN', glyph: '🌐' },
  { tab: 'Background', title: 'Personalization', desc: 'Background, lock screen, colors, Start', glyph: '🎨' },
  { tab: 'Apps', title: 'Apps', desc: 'Installed apps, defaults, features', glyph: '⊞' },
  { tab: 'Accounts', title: 'Accounts', desc: 'Your info, sign-in PIN, lock screen', glyph: '👤' },
  { tab: 'Time', title: 'Time & Language', desc: 'Date, time, region, format', glyph: '🕒' },
  { tab: 'Taskbar', title: 'Taskbar & Shell', desc: 'Location, icons, combine, badges', glyph: '▭' },
  { tab: 'Update', title: 'Update & Security', desc: 'Windows Update, recovery, security', glyph: '⟳' },
];

const SYSTEM_FONTS = [
  { name: 'Segoe UI', family: '"Segoe UI", sans-serif', desc: 'System UI default font' },
  { name: 'Calibri', family: 'Calibri, "Segoe UI", sans-serif', desc: 'Default Microsoft Word & Excel font' },
  { name: 'Consolas', family: 'Consolas, monospace', desc: 'Notepad & Code Studio monospace' },
  { name: 'Arial', family: 'Arial, sans-serif', desc: 'Classic sans-serif' },
  { name: 'Times New Roman', family: '"Times New Roman", serif', desc: 'Traditional editorial serif' },
  { name: 'Georgia', family: 'Georgia, serif', desc: 'Screen-readable serif' },
  { name: 'Courier New', family: '"Courier New", monospace', desc: 'Fixed-width typewriter' },
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
      <div className="absolute bottom-0 left-0 w-[168px] h-[112px] bg-[#181818]/92 border-t border-r border-white/15 flex p-2 gap-2">
        <div className="w-[54px] space-y-1.5 pt-1">
          {Array.from({ length: 7 }).map((_, idx) => (
            <div key={idx} className="flex items-center gap-1">
              <span style={{ backgroundColor: accentColor }} className="w-2.5 h-2.5 shrink-0 inline-block" />
              <span className="h-[2px] flex-1 bg-white/70" />
            </div>
          ))}
        </div>
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
      <div className="absolute bottom-0 inset-x-0 h-[10px] bg-black/80" />
    </div>
  );
}

function SettingsSwitch({
  label,
  checked,
  accentColor,
  onChange,
}: {
  label: string;
  checked: boolean;
  accentColor: string;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <span className="text-[13.5px] text-white/90">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={onChange}
        className="flex items-center gap-2 cursor-default"
      >
        <span
          style={{
            backgroundColor: checked ? accentColor : 'transparent',
            borderColor: checked ? accentColor : '#999999',
          }}
          className={`w-[42px] h-[20px] rounded-full border-2 flex items-center px-[2px] transition-colors ${
            checked ? 'justify-end' : 'justify-start'
          }`}
        >
          <span className={`w-3 h-3 rounded-full ${checked ? 'bg-white' : 'bg-white/85'}`} />
        </span>
        <span className="w-6 text-left text-[12px] text-white/75">{checked ? 'On' : 'Off'}</span>
      </button>
    </div>
  );
}

export function PersonalizationSettingsApp() {
  const apps = useDesktopStore((state) => state.apps);
  const openApp = useDesktopStore((state) => state.openApp);
  const personalization = useDesktopStore((state) => state.personalizationSettings);
  const activeTab = useDesktopStore((state) => state.settingsActiveTab);
  const nightLightEnabled = useDesktopStore((state) => state.nightLightEnabled);
  const wifiEnabled = useDesktopStore((state) => state.wifiEnabled);
  const airplaneMode = useDesktopStore((state) => state.airplaneMode);
  const networkName = useDesktopStore((state) => state.networkName);
  const brightness = useDesktopStore((state) => state.brightness);
  const displayScale = useDesktopStore((state) => state.displayScale);
  const systemVolume = useDesktopStore((state) => state.systemVolume);
  const isSystemMuted = useDesktopStore((state) => state.isSystemMuted);
  const appVolumes = useDesktopStore((state) => state.appVolumes);
  const soundEffectsEnabled = useDesktopStore((state) => state.soundEffectsEnabled);
  const windowSoundsEnabled = useDesktopStore((state) => state.windowSoundsEnabled);
  const usbConnected = useDesktopStore((state) => state.usbConnected);
  const usbDeviceName = useDesktopStore((state) => state.usbDeviceName);
  const startMenuSettings = useDesktopStore((state) => state.startMenuSettings);
  const userName = useDesktopStore((state) => state.userName);
  const lockPin = useDesktopStore((state) => state.lockPin);

  const toggleQuickSetting = useDesktopStore((state) => state.toggleQuickSetting);
  const setNetworkName = useDesktopStore((state) => state.setNetworkName);
  const setBrightness = useDesktopStore((state) => state.setBrightness);
  const setDisplayScale = useDesktopStore((state) => state.setDisplayScale);
  const setSystemVolume = useDesktopStore((state) => state.setSystemVolume);
  const toggleSystemMute = useDesktopStore((state) => state.toggleSystemMute);
  const setAppVolume = useDesktopStore((state) => state.setAppVolume);
  const setSoundEffectsEnabled = useDesktopStore((state) => state.setSoundEffectsEnabled);
  const setWindowSoundsEnabled = useDesktopStore((state) => state.setWindowSoundsEnabled);
  const connectUsbDrive = useDesktopStore((state) => state.connectUsbDrive);
  const ejectUsbDrive = useDesktopStore((state) => state.ejectUsbDrive);
  const updateStartMenuSettings = useDesktopStore((state) => state.updateStartMenuSettings);
  const setUserName = useDesktopStore((state) => state.setUserName);
  const setLockPin = useDesktopStore((state) => state.setLockPin);
  const setLockScreenOpen = useDesktopStore((state) => state.setLockScreenOpen);
  const setActiveTab = useDesktopStore((state) => state.setSettingsActiveTab);
  const updatePersonalization = useDesktopStore((state) => state.updatePersonalizationSettings);
  const closeWindow = useDesktopStore((state) => state.closeWindow);

  const storageUsedBytes = useFileSystemStore((state) => state.storageUsedBytes);
  const storageQuotaBytes = useFileSystemStore((state) => state.storageQuotaBytes);

  const [searchQuery, setSearchQuery] = useState('');
  const [fontSample, setFontSample] = useState('The quick brown fox jumps over the lazy dog');
  const [fontPreviewSize, setFontPreviewSize] = useState(18);
  const [pinInput, setPinInput] = useState(lockPin ?? '');
  const [nameInput, setNameInput] = useState(userName);
  const [accountSavedMsg, setAccountSavedMsg] = useState('');
  const [appFilter, setAppFilter] = useState('');
  const [soundCategory, setSoundCategory] = useState<Win10SoundCategory | 'all'>('all');
  const [updateStatus, setUpdateStatus] = useState<"You're up to date" | 'Checking for updates...' | 'All definitions current'>("You're up to date");
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

  const qLower = searchQuery.trim().toLowerCase();
  const filteredGroups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((item) => item.label.toLowerCase().includes(qLower)),
  })).filter((g) => g.items.length > 0);

  const selectClass =
    'w-[270px] max-w-full h-[32px] px-2.5 bg-[#0f0f0f] border border-[#666666] hover:border-[#999999] text-[13px] text-white outline-none cursor-default';

  return (
    <div className="flex flex-1 min-h-0 bg-[#000000] text-white select-none">
      {/* Left Navigation Sidebar */}
      <aside
        aria-label="Settings navigation"
        className="w-[232px] shrink-0 bg-[#1f1f1f] border-r border-white/10 flex flex-col py-2 overflow-y-auto win10-dark-scroll"
      >
        <button
          type="button"
          onClick={() => setActiveTab('Home')}
          className={`flex items-center gap-3 h-[40px] px-4 text-[13.5px] cursor-default shrink-0 ${
            activeTab === 'Home' ? 'bg-white/10 text-white font-medium' : 'text-white/90 hover:bg-white/10'
          }`}
        >
          <svg viewBox="0 0 16 16" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden="true">
            <polyline points="2,7.5 8,2 14,7.5" />
            <polyline points="3.5,6.5 3.5,14 12.5,14 12.5,6.5" />
          </svg>
          <span>Home</span>
        </button>

        <div className="px-3 py-2 shrink-0">
          <div className="relative flex items-center">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Find a setting"
              style={{ borderColor: searchQuery ? personalization.accentColor : '#555555' }}
              className="w-full h-[32px] pl-3 pr-8 bg-[#121212] border text-[13px] text-white placeholder:text-white/55 outline-none"
            />
            <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.3" aria-hidden="true" className="absolute right-2.5 text-white/65 pointer-events-none">
              <circle cx="9.5" cy="6.5" r="4" />
              <line x1="6.5" y1="9.5" x2="2.5" y2="13.5" />
            </svg>
          </div>
        </div>

        {filteredGroups.map((group) => (
          <div key={group.title} className="mb-2">
            <div className="px-4 pt-2 pb-1 text-[12px] font-semibold text-white/90">
              {group.title}
            </div>
            <nav className="flex flex-col">
              {group.items.map((item) => {
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setActiveTab(item.id)}
                    className={[
                      'relative flex items-center h-[36px] px-4 text-[13px] text-left transition-colors cursor-default',
                      isActive ? 'bg-white/10 text-white font-medium' : 'text-white/80 hover:bg-white/6',
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
          </div>
        ))}
      </aside>

      {/* Main Content */}
      <section className="win10-dark-scroll flex-1 overflow-y-auto px-8 py-6 bg-[#000000]">
        {activeTab === 'Home' && (
          <div className="space-y-6 max-w-[680px]">
            <div>
              <h1 className="text-[28px] font-light text-white tracking-tight">Windows Settings</h1>
              <p className="text-[13px] text-white/60 mt-1">
                Signed in as <strong className="text-white/90">{userName}</strong>
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {HOME_CATEGORIES.filter(
                (c) =>
                  !qLower ||
                  c.title.toLowerCase().includes(qLower) ||
                  c.desc.toLowerCase().includes(qLower),
              ).map((cat) => (
                <button
                  key={cat.tab}
                  type="button"
                  onClick={() => setActiveTab(cat.tab)}
                  className="p-4 bg-[#141414] hover:bg-[#1e1e1e] border border-white/10 hover:border-white/30 text-left flex items-start gap-3 transition-colors cursor-default"
                >
                  <span style={{ color: personalization.accentColor }} className="text-[20px] leading-none mt-0.5 shrink-0">
                    {cat.glyph}
                  </span>
                  <div className="min-w-0">
                    <div className="text-[14px] font-medium text-white">{cat.title}</div>
                    <div className="text-[11.5px] text-white/60 mt-0.5 leading-snug">{cat.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Background' && (
          <div className="space-y-5 max-w-[600px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Background</h1>
            <DesktopPreviewMockup bgStyle={previewStyle} accentColor={personalization.accentColor} />

            <div className="pt-2">
              <label className="block text-[13.5px] text-white/95 mb-2" htmlFor="bg-type-select">
                Background
              </label>
              <select
                id="bg-type-select"
                value={personalization.backgroundType}
                onChange={(e) => updatePersonalization({ backgroundType: e.target.value as BackgroundType })}
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
                          style={isSelected ? { outline: `2px solid ${personalization.accentColor}`, outlineOffset: '1px' } : undefined}
                          className="w-[74px] h-[74px] overflow-hidden bg-[#1a1a1a] hover:opacity-90 cursor-default"
                        >
                          <img src={src} alt={`Wallpaper ${idx + 1}`} draggable={false} className="w-full h-full object-cover pointer-events-none" />
                        </button>
                      );
                    })}
                  </div>

                  <input ref={fileInputRef} type="file" accept="image/*" onChange={handleBrowseFile} className="hidden" />
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
                    onChange={(e) => updatePersonalization({ backgroundFit: e.target.value as BackgroundFit })}
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
                <div className="text-[13.5px] text-white/95 mb-2">Choose your background color</div>
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
            <DesktopPreviewMockup bgStyle={previewStyle} accentColor={personalization.accentColor} />
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
                    style={isActive ? { borderColor: personalization.accentColor } : undefined}
                    className="flex flex-col text-left bg-[#181818] border border-white/15 hover:border-white/40 overflow-hidden cursor-default"
                  >
                    <img src={theme.wallpaper} alt={theme.name} className="w-full h-[100px] object-cover" />
                    <div className="flex items-center justify-between px-3 py-2 text-[12.5px]">
                      <span>{theme.name}</span>
                      <span style={{ backgroundColor: theme.accentColor }} className="w-3.5 h-3.5 inline-block" />
                    </div>
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => updatePersonalization(DEFAULT_PERSONALIZATION_SETTINGS)}
              className="px-4 py-1.5 bg-[#333333] hover:bg-[#444444] text-[13px] border border-white/15 cursor-default"
            >
              Reset theme to default
            </button>
          </div>
        )}

        {activeTab === 'Lock screen' && (
          <div className="space-y-4 max-w-[540px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Lock screen</h1>
            <div style={previewStyle} className="relative w-[336px] h-[186px] border border-white/15 flex flex-col justify-end p-4">
              <div className="text-[32px] font-light leading-none text-white drop-shadow">09:55</div>
              <div className="text-[13px] text-white/95 drop-shadow mt-1">Thursday, November 26</div>
            </div>
            <p className="text-[13px] text-white/65">
              Lock screen mirrors your selected background and supports optional PIN authentication.
            </p>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setLockScreenOpen(true)}
                style={{ backgroundColor: personalization.accentColor }}
                className="px-4 py-1.5 text-[13px] text-white cursor-default"
              >
                Preview Lock Screen
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('Accounts')}
                className="px-4 py-1.5 bg-[#333333] hover:bg-[#444444] text-[13px] border border-white/15 cursor-default"
              >
                Configure Sign-in PIN
              </button>
            </div>
          </div>
        )}

        {activeTab === 'Fonts' && (
          <div className="space-y-4 max-w-[600px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Fonts</h1>
            <div className="flex flex-wrap items-center gap-3">
              <input
                type="text"
                value={fontSample}
                onChange={(e) => setFontSample(e.target.value)}
                placeholder="Type here to preview font"
                className="flex-1 min-w-[220px] h-[32px] px-3 bg-[#121212] border border-[#555] text-[13px] text-white outline-none focus:border-[#0078d7]"
              />
              <div className="flex items-center gap-2 text-[12px] text-white/75">
                <span>Size {fontPreviewSize}px</span>
                <input
                  type="range"
                  min={12}
                  max={32}
                  value={fontPreviewSize}
                  onChange={(e) => setFontPreviewSize(Number(e.target.value))}
                  style={{ accentColor: personalization.accentColor }}
                />
              </div>
            </div>
            <div className="space-y-2.5">
              {SYSTEM_FONTS.map((f) => (
                <div key={f.name} className="p-3.5 bg-[#181818] border border-white/10">
                  <div className="flex items-baseline justify-between mb-1">
                    <span className="text-[13px] font-semibold">{f.name}</span>
                    <span className="text-[11px] text-white/50">{f.desc}</span>
                  </div>
                  <div style={{ fontFamily: f.family, fontSize: `${fontPreviewSize}px` }} className="text-white/95 truncate">
                    {fontSample || 'The quick brown fox jumps over the lazy dog'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Start' && (
          <div className="space-y-5 max-w-[540px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Start</h1>
            <DesktopPreviewMockup bgStyle={previewStyle} accentColor={personalization.accentColor} />
            <div className="space-y-2 pt-2">
              <SettingsSwitch
                label="Show more tiles on Start"
                checked={startMenuSettings.showMoreTiles}
                accentColor={personalization.accentColor}
                onChange={() => updateStartMenuSettings({ showMoreTiles: !startMenuSettings.showMoreTiles })}
              />
              <SettingsSwitch
                label="Show app list in Start menu"
                checked={startMenuSettings.showAppList}
                accentColor={personalization.accentColor}
                onChange={() => updateStartMenuSettings({ showAppList: !startMenuSettings.showAppList })}
              />
              <SettingsSwitch
                label="Show recently added apps"
                checked={startMenuSettings.showRecentlyAdded}
                accentColor={personalization.accentColor}
                onChange={() => updateStartMenuSettings({ showRecentlyAdded: !startMenuSettings.showRecentlyAdded })}
              />
            </div>
            <button
              type="button"
              onClick={() => closeWindow('settings')}
              className="px-4 py-1.5 bg-[#333333] hover:bg-[#444444] text-[13px] border border-white/15 cursor-default"
            >
              Close Settings
            </button>
          </div>
        )}

        {activeTab === 'Display' && (
          <div className="space-y-5 max-w-[540px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Display</h1>

            <div className="p-4 bg-[#181818] border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[14px] font-medium">Brightness and color</span>
                <span className="text-[12px] text-white/75 tabular-nums">{brightness}%</span>
              </div>
              <input
                type="range"
                min={20}
                max={100}
                value={brightness}
                aria-label="Brightness level"
                onChange={(e) => setBrightness(Number(e.target.value))}
                style={{ accentColor: personalization.accentColor }}
                className="w-full cursor-pointer"
              />
              <SettingsSwitch
                label="Night light"
                checked={nightLightEnabled}
                accentColor={personalization.accentColor}
                onChange={() => toggleQuickSetting('nightLightEnabled')}
              />
            </div>

            <div className="p-4 bg-[#181818] border border-white/10 space-y-3">
              <div className="text-[14px] font-medium">Scale and layout</div>
              <div>
                <label className="block text-[12px] text-white/65 mb-1.5" htmlFor="scale-select">
                  Change the size of text, apps, and other items
                </label>
                <select
                  id="scale-select"
                  value={displayScale}
                  onChange={(e) => setDisplayScale(Number(e.target.value) as 100 | 125 | 150)}
                  className={selectClass}
                >
                  <option value={100}>100% (Recommended)</option>
                  <option value={125}>125%</option>
                  <option value={150}>150%</option>
                </select>
              </div>
              <div className="text-[13px] text-white/70">
                Display resolution: {typeof window !== 'undefined' ? `${window.innerWidth} × ${window.innerHeight}` : '1280 × 720'}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Sound' && (
          <div className="space-y-5 max-w-[640px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Sound</h1>

            {/* Master Volume & System Sounds Volume */}
            <div className="p-4 bg-[#181818] border border-white/10 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[14px] font-medium">Master volume</div>
                  <div className="text-[12px] text-white/60">
                    Controls system sound effects, media, and browser audio
                  </div>
                </div>
                <span className="text-[14px] tabular-nums text-white/85">
                  {isSystemMuted ? 'Muted' : `${systemVolume}%`}
                </span>
              </div>

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={toggleSystemMute}
                  className="px-3 py-1 bg-[#2b2b2b] hover:bg-[#383838] border border-white/15 text-[12px] cursor-default shrink-0"
                >
                  {isSystemMuted ? 'Unmute' : 'Mute'}
                </button>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={isSystemMuted ? 0 : systemVolume}
                  aria-label="Master volume"
                  onChange={(e) => {
                    setSystemVolume(Number(e.target.value));
                    playVolumeChangeChime();
                  }}
                  onPointerUp={() => playSound('background')}
                  style={{ accentColor: personalization.accentColor }}
                  className="flex-1 cursor-pointer"
                />
              </div>

              <div className="pt-2 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between text-[13px]">
                  <span>System Sounds volume</span>
                  <span className="tabular-nums text-white/75">
                    {appVolumes['system-sounds'] ?? 100}%
                  </span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={appVolumes['system-sounds'] ?? 100}
                  aria-label="System Sounds volume"
                  onChange={(e) => setAppVolume('system-sounds', Number(e.target.value))}
                  onPointerUp={() => playSound('background')}
                  style={{ accentColor: personalization.accentColor }}
                  className="w-full cursor-pointer"
                />
              </div>

              <div className="pt-2 border-t border-white/10">
                <SettingsSwitch
                  label="Play Windows 10 system sound effects"
                  checked={soundEffectsEnabled}
                  accentColor={personalization.accentColor}
                  onChange={() => {
                    const next = !soundEffectsEnabled;
                    setSoundEffectsEnabled(next);
                    if (next) playSound('notify', { force: true });
                  }}
                />
                <SettingsSwitch
                  label="Play window minimize / restore sounds"
                  checked={windowSoundsEnabled}
                  accentColor={personalization.accentColor}
                  onChange={() => {
                    const next = !windowSoundsEnabled;
                    setWindowSoundsEnabled(next);
                    if (next) playSound('restore', { force: true });
                  }}
                />
              </div>
            </div>

            {/* USB & Event Triggers */}
            <div className="p-4 bg-[#181818] border border-white/10 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <div className="text-[14px] font-medium">Hardware &amp; Event Simulation</div>
                  <div className="text-[12px] text-white/60">
                    Test USB plug-in/eject (mounts Drive E: in This PC) and system alerts
                  </div>
                </div>
                <span className="text-[11.5px] text-white/65 shrink-0">
                  {usbConnected ? `${usbDeviceName} (E:)` : 'No USB mounted'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    if (usbConnected) ejectUsbDrive();
                    else connectUsbDrive();
                  }}
                  style={{ backgroundColor: personalization.accentColor }}
                  className="px-3.5 py-1.5 text-[12.5px] text-white hover:brightness-110 cursor-default"
                >
                  {usbConnected ? '⏏ Eject USB Drive (E:)' : '🔌 Plug in USB Drive (E:)'}
                </button>
                <button
                  type="button"
                  onClick={() => ejectUsbDrive(true)}
                  className="px-3.5 py-1.5 bg-[#2b2b2b] hover:bg-[#3a3a3a] border border-white/15 text-[12.5px] cursor-default"
                >
                  Test USB Fail
                </button>
                <button
                  type="button"
                  onClick={() =>
                    notify({
                      source: 'Windows Security',
                      title: 'Test notification',
                      message: 'Windows 10 notification sound and Action Center toast.',
                      kind: 'success',
                    })
                  }
                  className="px-3.5 py-1.5 bg-[#2b2b2b] hover:bg-[#3a3a3a] border border-white/15 text-[12.5px] cursor-default"
                >
                  Test Notification
                </button>
                <button
                  type="button"
                  onClick={() => playSound('critical-stop', { force: true })}
                  className="px-3.5 py-1.5 bg-[#2b2b2b] hover:bg-[#3a3a3a] border border-white/15 text-[12.5px] cursor-default"
                >
                  Test Critical Stop
                </button>
              </div>
            </div>

            {/* Windows 10 Sound Scheme Browser */}
            <div className="p-4 bg-[#181818] border border-white/10 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="text-[14px] font-medium">Windows 10 Sound Scheme</div>
                  <div className="text-[12px] text-white/60">
                    All {WIN10_SOUNDS.length} authentic Windows 10 sound effects
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  {(
                    [
                      { id: 'all', label: 'All' },
                      { id: 'notification', label: 'Notifications' },
                      { id: 'device', label: 'USB & Devices' },
                      { id: 'system', label: 'System' },
                      { id: 'power', label: 'Logon & Power' },
                    ] as const
                  ).map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSoundCategory(cat.id)}
                      style={
                        soundCategory === cat.id
                          ? { backgroundColor: personalization.accentColor }
                          : undefined
                      }
                      className={`px-2.5 py-1 text-[11.5px] cursor-default ${
                        soundCategory === cat.id
                          ? 'text-white'
                          : 'bg-[#262626] text-white/75 hover:bg-[#333]'
                      }`}
                    >
                      {cat.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="divide-y divide-white/10 border border-white/10 bg-[#121212] max-h-[320px] overflow-y-auto win10-dark-scroll">
                {WIN10_SOUNDS.filter(
                  (s) => soundCategory === 'all' || s.category === soundCategory,
                ).map((s) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-[12.5px] hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <div className="font-medium text-white/95 truncate">{s.label}</div>
                      <div className="text-[11px] text-white/55 truncate">{s.eventLabel}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => playSound(s.id, { force: true })}
                      className="px-3 py-1 bg-[#2b2b2b] hover:bg-[#0078d7] border border-white/15 text-[11.5px] text-white shrink-0 cursor-default"
                    >
                      ▶ Test
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'Network' && (
          <div className="space-y-5 max-w-[540px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Network &amp; Internet</h1>
            <div className="p-4 bg-[#181818] border border-white/10 space-y-2">
              <div className="text-[15px] font-medium">
                {airplaneMode ? '✈ Airplane mode enabled' : wifiEnabled ? `📶 Connected to ${networkName}` : 'Wi-Fi is turned off'}
              </div>
              <SettingsSwitch
                label="Wi-Fi"
                checked={wifiEnabled && !airplaneMode}
                accentColor={personalization.accentColor}
                onChange={() => toggleQuickSetting('wifiEnabled')}
              />
              <SettingsSwitch
                label="Airplane mode"
                checked={airplaneMode}
                accentColor={personalization.accentColor}
                onChange={() => toggleQuickSetting('airplaneMode')}
              />
            </div>
            <div className="p-4 bg-[#181818] border border-white/10 space-y-2">
              <div className="text-[13.5px] font-medium mb-1">Available networks</div>
              {['Wi-Fi (Home_5G)', 'Office_Guest', 'Phone Hotspot'].map((ssid) => (
                <button
                  key={ssid}
                  type="button"
                  onClick={() => setNetworkName(ssid)}
                  className={`w-full flex items-center justify-between px-3 py-2 text-[13px] border cursor-default ${
                    networkName === ssid ? 'border-white/40 bg-white/10' : 'border-white/10 hover:bg-white/5'
                  }`}
                >
                  <span>{ssid}</span>
                  <span className="text-[11px] text-white/65">{networkName === ssid ? 'Connected' : 'Secured'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'Accounts' && (
          <div className="space-y-5 max-w-[540px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Accounts</h1>
            <div className="flex items-center gap-4 p-4 bg-[#181818] border border-white/10">
              <div className="w-14 h-14 rounded-full bg-[#3a3a3a] border border-white/25 flex items-center justify-center text-[22px]">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div>
                <div className="text-[16px] font-medium">{userName}</div>
                <div className="text-[12px] text-white/60">Local Account · Administrator</div>
              </div>
            </div>

            <div className="p-4 bg-[#181818] border border-white/10 space-y-3">
              <label className="block text-[13px]">Display name</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  className="flex-1 h-[32px] px-3 bg-[#0f0f0f] border border-[#555] text-[13px] outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setUserName(nameInput);
                    setAccountSavedMsg('Updated display name');
                  }}
                  style={{ backgroundColor: personalization.accentColor }}
                  className="px-4 h-[32px] text-[12.5px] text-white cursor-default"
                >
                  Save
                </button>
              </div>

              <label className="block text-[13px] pt-2">Sign-in PIN (Windows Hello)</label>
              <div className="flex gap-2">
                <input
                  type="password"
                  value={pinInput}
                  onChange={(e) => setPinInput(e.target.value)}
                  placeholder="Enter a PIN (e.g. 1234)"
                  className="flex-1 h-[32px] px-3 bg-[#0f0f0f] border border-[#555] text-[13px] outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    setLockPin(pinInput || null);
                    setAccountSavedMsg(pinInput.trim() ? 'PIN enabled for Lock Screen' : 'PIN removed');
                  }}
                  className="px-4 h-[32px] bg-[#333] hover:bg-[#444] border border-white/15 text-[12.5px] cursor-default"
                >
                  {pinInput.trim() ? 'Set PIN' : 'Clear PIN'}
                </button>
              </div>
              {accountSavedMsg && <div className="text-[12px] text-[#7cc9ff]">{accountSavedMsg}</div>}
            </div>
          </div>
        )}

        {activeTab === 'Apps' && (
          <div className="space-y-4 max-w-[600px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Apps &amp; features</h1>
            <div className="text-[12.5px] text-white/65">
              Virtual disk usage: {formatStorageBytes(storageUsedBytes)} of {formatStorageBytes(storageQuotaBytes)}
            </div>
            <input
              type="text"
              value={appFilter}
              onChange={(e) => setAppFilter(e.target.value)}
              placeholder="Search installed apps..."
              className="w-full max-w-[300px] h-[32px] px-3 bg-[#121212] border border-[#555] text-[13px] outline-none"
            />
            <div className="divide-y divide-white/10 border border-white/10 bg-[#141414]">
              {apps
                .filter((a) => a.name.toLowerCase().includes(appFilter.trim().toLowerCase()))
                .map((app) => (
                  <div key={app.id} className="flex items-center justify-between px-3.5 py-2.5 text-[13px]">
                    <div className="flex items-center gap-3 min-w-0">
                      <img src={app.icon} alt="" className="w-5 h-5 object-contain shrink-0" />
                      <span className="truncate">{app.name}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => openApp(app.id)}
                      className="px-3 py-1 bg-[#2b2b2b] hover:bg-[#3a3a3a] border border-white/15 text-[12px] cursor-default"
                    >
                      Open
                    </button>
                  </div>
                ))}
            </div>
          </div>
        )}

        {activeTab === 'Time' && (
          <div className="space-y-4 max-w-[540px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Date &amp; time</h1>
            <div className="p-4 bg-[#181818] border border-white/10 space-y-2">
              <div className="text-[12px] text-white/60">Current date and time</div>
              <div className="text-[20px] font-light">{new Date().toLocaleString()}</div>
              <div className="text-[12.5px] text-white/70">Time zone: {Intl.DateTimeFormat().resolvedOptions().timeZone}</div>
            </div>
          </div>
        )}

        {activeTab === 'Update' && (
          <div className="space-y-4 max-w-[540px]">
            <h1 className="text-[28px] font-light text-white tracking-tight">Windows Update</h1>
            <div className="p-4 bg-[#181818] border border-white/10 space-y-3">
              <div className="text-[16px] font-medium">{updateStatus}</div>
              <div className="text-[12.5px] text-white/65">Last checked: Today</div>
              <button
                type="button"
                onClick={() => {
                  setUpdateStatus('Checking for updates...');
                  window.setTimeout(() => setUpdateStatus("You're up to date"), 900);
                }}
                style={{ backgroundColor: personalization.accentColor }}
                className="px-4 py-1.5 text-[13px] text-white cursor-default"
              >
                Check for updates
              </button>
            </div>
          </div>
        )}

        {activeTab === 'Taskbar' && <TaskbarSettingsPanel />}
      </section>
    </div>
  );
}
