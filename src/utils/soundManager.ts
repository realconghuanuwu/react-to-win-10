export type Win10SoundId =
  | 'notify'
  | 'notify-messaging'
  | 'usb-insert'
  | 'usb-remove'
  | 'usb-fail'
  | 'background'
  | 'foreground'
  | 'error'
  | 'critical-stop'
  | 'exclamation'
  | 'ding'
  | 'balloon'
  | 'recycle'
  | 'uac'
  | 'startup'
  | 'logon'
  | 'logoff'
  | 'shutdown'
  | 'unlock'
  | 'minimize'
  | 'restore';

export type Win10SoundCategory = 'notification' | 'device' | 'system' | 'power';

export interface Win10SoundMeta {
  id: Win10SoundId;
  label: string;
  eventLabel: string;
  src: string;
  category: Win10SoundCategory;
}

export const WIN10_SOUNDS: Win10SoundMeta[] = [
  {
    id: 'notify',
    label: 'Notification',
    eventLabel: 'Toast & Action Center notification',
    src: '/assets/sounds/windows-notify-system.wav',
    category: 'notification',
  },
  {
    id: 'notify-messaging',
    label: 'Notification (Messaging)',
    eventLabel: 'Messaging / app alert',
    src: '/assets/sounds/windows-notify-messaging.wav',
    category: 'notification',
  },
  {
    id: 'balloon',
    label: 'System Balloon',
    eventLabel: 'Tray balloon / capture tip',
    src: '/assets/sounds/windows-balloon.wav',
    category: 'notification',
  },
  {
    id: 'usb-insert',
    label: 'Device Connect',
    eventLabel: 'USB drive or hardware plugged in',
    src: '/assets/sounds/windows-hardware-insert.wav',
    category: 'device',
  },
  {
    id: 'usb-remove',
    label: 'Device Disconnect',
    eventLabel: 'USB drive ejected or hardware removed',
    src: '/assets/sounds/windows-hardware-remove.wav',
    category: 'device',
  },
  {
    id: 'usb-fail',
    label: 'Device Failed to Connect',
    eventLabel: 'Hardware connection failed',
    src: '/assets/sounds/windows-hardware-fail.wav',
    category: 'device',
  },
  {
    id: 'background',
    label: 'Default Beep',
    eventLabel: 'Volume adjustment & default chime',
    src: '/assets/sounds/windows-background.wav',
    category: 'system',
  },
  {
    id: 'foreground',
    label: 'System Foreground',
    eventLabel: 'Foreground system prompt',
    src: '/assets/sounds/windows-foreground.wav',
    category: 'system',
  },
  {
    id: 'critical-stop',
    label: 'Critical Stop',
    eventLabel: 'System error / cannot find target',
    src: '/assets/sounds/windows-critical-stop.wav',
    category: 'system',
  },
  {
    id: 'error',
    label: 'Program Error',
    eventLabel: 'Application error notification',
    src: '/assets/sounds/windows-error.wav',
    category: 'system',
  },
  {
    id: 'exclamation',
    label: 'Exclamation',
    eventLabel: 'Warning & incorrect PIN',
    src: '/assets/sounds/windows-exclamation.wav',
    category: 'system',
  },
  {
    id: 'ding',
    label: 'Asterisk / Ding',
    eventLabel: 'Terminal bell & confirmation ding',
    src: '/assets/sounds/windows-ding.wav',
    category: 'system',
  },
  {
    id: 'recycle',
    label: 'Empty Recycle Bin',
    eventLabel: 'Emptying the Recycle Bin',
    src: '/assets/sounds/windows-recycle.wav',
    category: 'system',
  },
  {
    id: 'uac',
    label: 'Windows User Account Control',
    eventLabel: 'Elevation & security prompt',
    src: '/assets/sounds/windows-uac.wav',
    category: 'system',
  },
  {
    id: 'minimize',
    label: 'Minimize',
    eventLabel: 'Minimize window',
    src: '/assets/sounds/windows-minimize.wav',
    category: 'system',
  },
  {
    id: 'restore',
    label: 'Restore Up',
    eventLabel: 'Restore or maximize window',
    src: '/assets/sounds/windows-restore.wav',
    category: 'system',
  },
  {
    id: 'startup',
    label: 'Windows Startup',
    eventLabel: 'Desktop ready chime',
    src: '/assets/sounds/windows-startup.wav',
    category: 'power',
  },
  {
    id: 'logon',
    label: 'Windows Logon',
    eventLabel: 'Sign in / wake up PC',
    src: '/assets/sounds/windows-logon.wav',
    category: 'power',
  },
  {
    id: 'unlock',
    label: 'Windows Unlock',
    eventLabel: 'Unlock from Lock Screen',
    src: '/assets/sounds/windows-unlock.wav',
    category: 'power',
  },
  {
    id: 'logoff',
    label: 'Windows Logoff',
    eventLabel: 'Lock / Sleep / Sign out',
    src: '/assets/sounds/windows-logoff.wav',
    category: 'power',
  },
  {
    id: 'shutdown',
    label: 'Windows Shutdown',
    eventLabel: 'Shut down / Restart',
    src: '/assets/sounds/windows-shutdown.wav',
    category: 'power',
  },
];

const SOUND_MAP = new Map<Win10SoundId, Win10SoundMeta>(WIN10_SOUNDS.map((s) => [s.id, s]));

export interface SoundEngineSettings {
  systemVolume: number;
  isSystemMuted: boolean;
  systemSoundsVolume: number;
  soundEffectsEnabled: boolean;
  windowSoundsEnabled: boolean;
  focusAssist: boolean;
}

let settingsProvider: (() => SoundEngineSettings) | null = null;
let audioCtx: AudioContext | null = null;
let userInteracted = false;
let unlockListenersAttached = false;

const decodedBufferCache = new Map<Win10SoundId, AudioBuffer>();
const pendingDecode = new Map<Win10SoundId, Promise<AudioBuffer | null>>();

export function registerSoundSettingsProvider(provider: () => SoundEngineSettings) {
  settingsProvider = provider;
}

function getSettings(): SoundEngineSettings {
  if (settingsProvider) return settingsProvider();
  return {
    systemVolume: 85,
    isSystemMuted: false,
    systemSoundsVolume: 100,
    soundEffectsEnabled: true,
    windowSoundsEnabled: false,
    focusAssist: false,
  };
}

function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) {
    try {
      audioCtx = new Ctx();
    } catch {
      return null;
    }
  }
  return audioCtx;
}

export function initSoundUnlock() {
  if (typeof window === 'undefined' || unlockListenersAttached) return;
  unlockListenersAttached = true;

  const unlock = () => {
    userInteracted = true;
    const ctx = getAudioContext();
    if (ctx && ctx.state === 'suspended') {
      void ctx.resume().catch(() => undefined);
    }
  };

  window.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  window.addEventListener('keydown', unlock, { capture: true, passive: true });
}

async function loadAudioBuffer(id: Win10SoundId): Promise<AudioBuffer | null> {
  const existing = decodedBufferCache.get(id);
  if (existing) return existing;

  const inflight = pendingDecode.get(id);
  if (inflight) return inflight;

  const meta = SOUND_MAP.get(id);
  const ctx = getAudioContext();
  if (!meta || !ctx || typeof fetch === 'undefined') return null;

  const promise = (async () => {
    try {
      const response = await fetch(meta.src);
      if (!response.ok) return null;
      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      decodedBufferCache.set(id, audioBuffer);
      return audioBuffer;
    } catch {
      return null;
    } finally {
      pendingDecode.delete(id);
    }
  })();

  pendingDecode.set(id, promise);
  return promise;
}

export function preloadCoreSounds(): void {
  if (typeof window === 'undefined') return;
  const coreIds: Win10SoundId[] = [
    'notify',
    'usb-insert',
    'usb-remove',
    'background',
    'critical-stop',
    'exclamation',
    'recycle',
    'unlock',
    'logon',
    'shutdown',
  ];
  for (const id of coreIds) {
    void loadAudioBuffer(id);
  }
}

export interface PlaySoundOptions {
  /** Bypass soundEffectsEnabled check (e.g. when previewing in Settings -> Sound) */
  force?: boolean;
  /** Override gain multiplier (0..1) */
  volumeScale?: number;
  /** Respect Focus Assist (for notifications) */
  isNotification?: boolean;
  /** Window sound gated behind windowSoundsEnabled */
  isWindowSound?: boolean;
}

function playFallbackHtmlAudio(src: string, gain: number) {
  if (typeof Audio === 'undefined') return;
  try {
    const audio = new Audio(src);
    audio.volume = Math.max(0, Math.min(1, gain));
    void audio.play().catch(() => undefined);
  } catch {
    // Ignore playback errors in restricted/headless environments
  }
}

export function playSound(id: Win10SoundId, options: PlaySoundOptions = {}): void {
  if (typeof window === 'undefined') return;

  const meta = SOUND_MAP.get(id);
  if (!meta) return;

  const settings = getSettings();

  if (!options.force) {
    if (!settings.soundEffectsEnabled) return;
    if (options.isNotification && settings.focusAssist) return;
    if (options.isWindowSound && !settings.windowSoundsEnabled) return;
  }

  if (settings.isSystemMuted && !options.force) return;

  const master = settings.isSystemMuted && options.force ? 0.65 : settings.systemVolume / 100;
  const sysChannel = settings.systemSoundsVolume / 100;
  const extra = options.volumeScale ?? 1;
  const finalGain = Math.max(0, Math.min(1, master * sysChannel * extra));

  if (finalGain <= 0.001) return;

  const ctx = getAudioContext();
  if (!ctx) {
    playFallbackHtmlAudio(meta.src, finalGain);
    return;
  }

  if (ctx.state === 'suspended') {
    if (!userInteracted && !options.force) {
      return;
    }
    void ctx.resume().catch(() => undefined);
  }

  const cached = decodedBufferCache.get(id);
  if (cached) {
    try {
      const source = ctx.createBufferSource();
      const gainNode = ctx.createGain();
      source.buffer = cached;
      gainNode.gain.value = finalGain;
      source.connect(gainNode);
      gainNode.connect(ctx.destination);
      source.start(0);
      return;
    } catch {
      // Fall through to fetch/HTMLAudio
    }
  }

  void loadAudioBuffer(id).then((buffer) => {
    if (buffer) {
      try {
        const source = ctx.createBufferSource();
        const gainNode = ctx.createGain();
        source.buffer = buffer;
        gainNode.gain.value = finalGain;
        source.connect(gainNode);
        gainNode.connect(ctx.destination);
        source.start(0);
        return;
      } catch {
        // Fallback below
      }
    }
    playFallbackHtmlAudio(meta.src, finalGain);
  });
}

let lastVolumeChimeAt = 0;
export function playVolumeChangeChime(): void {
  const now = Date.now();
  if (now - lastVolumeChimeAt < 180) return;
  lastVolumeChimeAt = now;
  playSound('background');
}
