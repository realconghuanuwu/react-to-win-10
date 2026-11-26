import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { CheckmarkCircleRegular, DismissRegular, ErrorCircleRegular } from '@fluentui/react-icons';
import { getTaskbarInsets, useDesktopStore } from '../../store/useDesktopStore';
import { useFileSystemStore } from '../../store/useFileSystemStore';
import { useNotificationStore } from '../../store/useNotificationStore';

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable) return true;
  if (target.closest('input, textarea, select, [contenteditable="true"], .monaco-editor, .univer-container')) {
    return true;
  }
  return false;
}

function RunDialog() {
  const isOpen = useDesktopStore((s) => s.isRunDialogOpen);
  const runHistory = useDesktopStore((s) => s.runHistory);
  const setRunDialogOpen = useDesktopStore((s) => s.setRunDialogOpen);
  const addRunHistory = useDesktopStore((s) => s.addRunHistory);
  const openApp = useDesktopStore((s) => s.openApp);
  const openTerminal = useDesktopStore((s) => s.openTerminal);
  const openSettingsTab = useDesktopStore((s) => s.openSettingsTab);
  const setLockScreenOpen = useDesktopStore((s) => s.setLockScreenOpen);

  const [cmd, setCmd] = useState(runHistory[0] ?? '');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      setErrorMsg(null);
      window.setTimeout(() => {
        inputRef.current?.focus();
        inputRef.current?.select();
      }, 0);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const executeCommand = (e: FormEvent) => {
    e.preventDefault();
    const raw = cmd.trim();
    if (!raw) return;
    const lower = raw.toLowerCase();
    addRunHistory(raw);

    if (lower === 'explorer' || lower === 'explorer.exe' || lower === 'this pc') {
      openApp('explorer', 'this-pc', undefined, true);
    } else if (lower === 'c:' || lower === 'c:\\') {
      openApp('explorer', 'drive-c');
    } else if (lower === 'd:' || lower === 'd:\\') {
      openApp('explorer', 'drive-d');
    } else if (lower === 'desktop') {
      openApp('explorer', 'desktop');
    } else if (lower === 'documents') {
      openApp('explorer', 'documents');
    } else if (lower === 'downloads') {
      openApp('explorer', 'downloads');
    } else if (lower === 'recycle' || lower === 'shell:recyclebinfolder') {
      openApp('recycle-bin');
    } else if (lower === 'notepad' || lower === 'notepad.exe') {
      openApp('notepad', undefined, undefined, true);
    } else if (lower === 'calc' || lower === 'calc.exe' || lower === 'calculator') {
      openApp('calculator');
    } else if (lower === 'chrome' || lower === 'chrome.exe' || lower.startsWith('http://') || lower.startsWith('https://')) {
      openApp('chrome');
    } else if (lower === 'winword' || lower === 'word') {
      openApp('word');
    } else if (lower === 'excel') {
      openApp('excel');
    } else if (lower === 'mspaint' || lower === 'paint') {
      openApp('paint');
    } else if (lower === 'taskmgr' || lower === 'taskmgr.exe') {
      openApp('task-manager');
    } else if (lower === 'code' || lower === 'vscode') {
      openApp('code-studio');
    } else if (lower === 'pdf') {
      openApp('pdf-tool');
    } else if (lower === 'cmd' || lower === 'cmd.exe') {
      openTerminal('cmd');
    } else if (lower === 'powershell' || lower === 'powershell.exe') {
      openTerminal('powershell');
    } else if (lower === 'wt' || lower === 'terminal') {
      openApp('terminal');
    } else if (lower === 'ms-settings:taskbar') {
      openSettingsTab('Taskbar');
    } else if (lower === 'ms-settings:display') {
      openSettingsTab('Display');
    } else if (lower === 'ms-settings:' || lower === 'settings' || lower === 'control') {
      openApp('settings');
    } else if (lower === 'lock') {
      setLockScreenOpen(true);
    } else {
      setErrorMsg(`Windows cannot find '${raw}'. Make sure you typed the name correctly, and then try again.`);
      return;
    }
    setRunDialogOpen(false);
  };

  return (
    <div
      className="fixed inset-0 z-[120] flex items-end justify-start p-6 pointer-events-auto"
      onClick={() => setRunDialogOpen(false)}
    >
      <div
        role="dialog"
        aria-label="Run"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation();
            setRunDialogOpen(false);
          }
        }}
        className="w-[410px] max-w-[calc(100vw-32px)] bg-[#f0f0f0] border border-[#767676] shadow-[0_8px_28px_rgba(0,0,0,0.45)] text-[#1f1f1f] text-[12px] select-none mb-10"
      >
        <div className="flex items-center justify-between h-[30px] px-3 bg-white border-b border-[#e0e0e0]">
          <div className="flex items-center gap-2">
            <img src="/assets/icons/file-explorer.png" alt="" className="w-4 h-4 object-contain" />
            <span>Run</span>
          </div>
          <button
            type="button"
            aria-label="Close Run"
            onClick={() => setRunDialogOpen(false)}
            className="w-7 h-7 flex items-center justify-center hover:bg-[#e81123] hover:text-white cursor-default"
          >
            ×
          </button>
        </div>

        <form onSubmit={executeCommand} className="p-4 space-y-3">
          <div className="flex items-start gap-3">
            <img src="/assets/icons/settings.png" alt="" className="w-8 h-8 object-contain shrink-0" />
            <p className="text-[12px] leading-snug text-[#222]">
              Type the name of a program, folder, document, or Internet resource, and Windows will open it for you.
            </p>
          </div>

          <div className="flex items-center gap-2.5">
            <label htmlFor="win10-run-input" className="w-11 shrink-0 text-[12px]">
              Open:
            </label>
            <input
              id="win10-run-input"
              ref={inputRef}
              list="win10-run-history"
              value={cmd}
              onChange={(e) => {
                setCmd(e.target.value);
                setErrorMsg(null);
              }}
              placeholder="e.g. notepad, calc, explorer, taskmgr, ms-settings:"
              className="flex-1 h-[24px] px-2 bg-white border border-[#7a7a7a] focus:border-[#0078d7] outline-none text-[12px] text-black"
            />
            <datalist id="win10-run-history">
              {runHistory.map((item) => (
                <option key={item} value={item} />
              ))}
            </datalist>
          </div>

          {errorMsg && (
            <div className="px-2.5 py-1.5 bg-[#fde7e9] border border-[#f1707a] text-[#a80000] text-[11.5px]">
              {errorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="submit"
              className="min-w-[74px] h-[24px] px-3 bg-[#e1e1e1] hover:bg-[#e5f1fb] border border-[#0078d7] text-black cursor-default"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => setRunDialogOpen(false)}
              className="min-w-[74px] h-[24px] px-3 bg-[#e1e1e1] hover:bg-[#e5f1fb] border border-[#adadad] hover:border-[#0078d7] text-black cursor-default"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function AltTabOverlay() {
  const isOpen = useDesktopStore((s) => s.isAltTabOpen);
  const altTabIndex = useDesktopStore((s) => s.altTabIndex);
  const windows = useDesktopStore((s) => s.windows);
  const activeDesktopId = useDesktopStore((s) => s.activeDesktopId);
  const focusWindow = useDesktopStore((s) => s.focusWindow);
  const setAltTabState = useDesktopStore((s) => s.setAltTabState);

  const desktopWindows = useMemo(
    () =>
      windows
        .filter((w) => w.desktopId === activeDesktopId)
        .sort((a, b) => b.zIndex - a.zIndex),
    [windows, activeDesktopId],
  );

  if (!isOpen || desktopWindows.length === 0) return null;

  const safeIdx = ((altTabIndex % desktopWindows.length) + desktopWindows.length) % desktopWindows.length;

  return (
    <div
      role="dialog"
      aria-label="Window Switcher"
      className="fixed inset-0 z-[130] flex items-center justify-center bg-black/35 backdrop-blur-sm select-none"
      onClick={() => setAltTabState(false)}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="max-w-[82vw] bg-[#1f1f1f]/95 border border-white/20 p-5 shadow-2xl"
      >
        <div className="flex flex-wrap items-center justify-center gap-3">
          {desktopWindows.map((win, idx) => {
            const selected = idx === safeIdx;
            return (
              <button
                key={win.id}
                type="button"
                onClick={() => {
                  focusWindow(win.id);
                  setAltTabState(false);
                }}
                className={[
                  'w-[164px] flex flex-col bg-[#2b2b2b] border p-2.5 text-left transition-colors cursor-default',
                  selected
                    ? 'border-[#66baff] ring-2 ring-[#0078d7] bg-[#363636]'
                    : 'border-white/15 hover:border-white/40',
                ].join(' ')}
              >
                <div className="flex items-center gap-2 mb-2">
                  <img src={win.icon} alt="" className="w-4 h-4 object-contain shrink-0" />
                  <span className="text-[11.5px] text-white truncate">{win.title}</span>
                </div>
                <div className="h-[72px] bg-[#191919] border border-white/10 flex flex-col items-center justify-center gap-1">
                  <img src={win.icon} alt="" className="w-8 h-8 object-contain" />
                  <span className="text-[10px] text-white/60">
                    {win.isMinimized ? 'Minimized' : win.isMaximized ? 'Maximized' : `${win.width}×${win.height}`}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
        <div className="mt-3 text-center text-[11px] text-white/65">
          Press Tab to cycle windows · Click or release Alt to switch
        </div>
      </div>
    </div>
  );
}

function LockScreenOverlay() {
  const isOpen = useDesktopStore((s) => s.isLockScreenOpen);
  const personalization = useDesktopStore((s) => s.personalizationSettings);
  const userName = useDesktopStore((s) => s.userName);
  const lockPin = useDesktopStore((s) => s.lockPin);
  const wifiEnabled = useDesktopStore((s) => s.wifiEnabled);
  const airplaneMode = useDesktopStore((s) => s.airplaneMode);
  const networkName = useDesktopStore((s) => s.networkName);
  const setLockScreenOpen = useDesktopStore((s) => s.setLockScreenOpen);
  const setPowerState = useDesktopStore((s) => s.setPowerState);

  const [now, setNow] = useState(() => new Date());
  const [stage, setStage] = useState<'curtain' | 'signin'>('curtain');
  const [pinDraft, setPinDraft] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [powerOpen, setPowerOpen] = useState(false);
  const pinInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!isOpen) {
      setStage('curtain');
      setPinDraft('');
      setPinError(null);
      setPowerOpen(false);
      return;
    }
    const t = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(t);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && stage === 'signin' && lockPin) {
      window.setTimeout(() => pinInputRef.current?.focus(), 40);
    }
  }, [isOpen, stage, lockPin]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (stage === 'curtain' && (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape')) {
        e.preventDefault();
        setStage('signin');
      } else if (stage === 'signin' && e.key === 'Escape') {
        e.preventDefault();
        setStage('curtain');
        setPinError(null);
      } else if (stage === 'signin' && !lockPin && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        setLockScreenOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen, stage, lockPin, setLockScreenOpen]);

  if (!isOpen) return null;

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

  const handleAttemptSignIn = (e?: FormEvent) => {
    e?.preventDefault();
    if (lockPin && pinDraft !== lockPin) {
      setPinError('The PIN is incorrect. Try again.');
      setPinDraft('');
      pinInputRef.current?.focus();
      return;
    }
    setPinError(null);
    setPinDraft('');
    setLockScreenOpen(false);
  };

  return (
    <div
      role="dialog"
      aria-label="Lock Screen"
      onClick={() => {
        if (stage === 'curtain') setStage('signin');
        else setPowerOpen(false);
      }}
      style={{
        backgroundImage:
          personalization.backgroundType === 'picture'
            ? `url("${personalization.wallpaper}")`
            : undefined,
        backgroundColor: personalization.solidColor,
      }}
      className="fixed inset-0 z-[180] bg-cover bg-center flex flex-col justify-between p-12 text-white select-none cursor-default"
    >
      <div
        className={`absolute inset-0 transition-all duration-300 ${
          stage === 'signin' ? 'bg-black/50 backdrop-blur-2xl' : 'bg-black/30 backdrop-blur-[2px]'
        }`}
      />

      {stage === 'curtain' ? (
        <>
          <div />
          <div className="relative z-10 flex flex-col items-start">
            <div className="text-[84px] font-light leading-none tracking-tight drop-shadow-lg tabular-nums">
              {timeStr}
            </div>
            <div className="mt-2 text-[28px] font-light drop-shadow-md">{dateStr}</div>
          </div>
          <div className="relative z-10 flex items-center justify-between text-white/90 text-[13px]">
            <span>Click anywhere or press Space / Enter to sign in</span>
            <div className="flex items-center gap-4">
              <span title={wifiEnabled && !airplaneMode ? `Connected to ${networkName}` : 'No network'}>
                {airplaneMode ? '✈' : wifiEnabled ? '📶' : '⚠'}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setStage('signin');
                }}
                className="px-4 py-1.5 bg-white/20 hover:bg-white/30 border border-white/30 text-white cursor-default"
              >
                Sign in
              </button>
            </div>
          </div>
        </>
      ) : (
        <>
          <div className="relative z-10">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setStage('curtain');
              }}
              className="px-3 py-1 bg-white/10 hover:bg-white/20 text-[12px] text-white/90 cursor-default"
            >
              ← Lock screen
            </button>
          </div>

          <form
            onSubmit={handleAttemptSignIn}
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 flex flex-col items-center justify-center gap-3 max-w-[320px] w-full mx-auto"
          >
            <div className="w-[144px] h-[144px] rounded-full bg-white/15 border border-white/30 flex items-center justify-center text-[56px] font-light shadow-2xl">
              {userName.charAt(0).toUpperCase()}
            </div>
            <div className="text-[28px] font-light tracking-tight">{userName}</div>

            {lockPin ? (
              <div className="w-full space-y-2 mt-1">
                <div className="flex items-center bg-black/50 border border-white/40 focus-within:border-[#0078d7]">
                  <input
                    ref={pinInputRef}
                    type="password"
                    value={pinDraft}
                    onChange={(e) => {
                      setPinDraft(e.target.value);
                      if (pinError) setPinError(null);
                    }}
                    placeholder="PIN"
                    aria-label="Enter PIN"
                    className="flex-1 h-[36px] px-3 bg-transparent text-[13.5px] text-white placeholder:text-white/60 outline-none"
                  />
                  <button
                    type="submit"
                    aria-label="Submit PIN"
                    className="w-[36px] h-[36px] bg-white/15 hover:bg-white/25 flex items-center justify-center text-[15px] cursor-default"
                  >
                    →
                  </button>
                </div>
                {pinError && (
                  <p role="alert" className="text-center text-[12px] text-[#ffb4b4]">
                    {pinError}
                  </p>
                )}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setPinError(null);
                      setLockScreenOpen(false);
                    }}
                    className="text-[12px] text-white/75 hover:text-white hover:underline cursor-default"
                  >
                    Unlock without PIN
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="submit"
                className="mt-2 px-9 py-2 bg-white/20 hover:bg-white/30 border border-white/40 text-[14px] text-white cursor-default"
              >
                Sign in
              </button>
            )}
          </form>

          {/* Bottom-right Power Menu */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="relative z-10 flex items-center justify-end text-[13px]"
          >
            <div className="relative">
              <button
                type="button"
                aria-label="Power options"
                onClick={() => setPowerOpen((v) => !v)}
                className="inline-flex items-center gap-2 px-3 py-1.5 bg-white/10 hover:bg-white/20 border border-white/15 cursor-default"
              >
                <svg viewBox="0 0 16 16" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.4" aria-hidden="true">
                  <path d="M5 3.3A5.5 5.5 0 1 0 11 3.3" strokeLinecap="round" />
                  <line x1="8" y1="1.8" x2="8" y2="7.5" strokeLinecap="round" />
                </svg>
                <span>Power</span>
              </button>
              {powerOpen && (
                <div className="absolute right-0 bottom-full mb-2 w-[140px] bg-[#242424] border border-white/25 shadow-2xl py-1 text-[12px]">
                  <button
                    type="button"
                    onClick={() => { setPowerOpen(false); setPowerState('sleeping'); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
                  >
                    Sleep
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPowerOpen(false); setPowerState('shutting-down'); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
                  >
                    Shut down
                  </button>
                  <button
                    type="button"
                    onClick={() => { setPowerOpen(false); setPowerState('restarting'); }}
                    className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
                  >
                    Restart
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function PowerOverlay() {
  const powerState = useDesktopStore((s) => s.powerState);
  const setPowerState = useDesktopStore((s) => s.setPowerState);
  const setLockScreenOpen = useDesktopStore((s) => s.setLockScreenOpen);
  const [poweredOff, setPoweredOff] = useState(false);

  useEffect(() => {
    if (powerState === 'running') {
      setPoweredOff(false);
      return;
    }
    if (powerState === 'restarting') {
      const t = window.setTimeout(() => {
        setPowerState('running');
        setLockScreenOpen(true);
      }, 1800);
      return () => window.clearTimeout(t);
    }
    if (powerState === 'shutting-down') {
      const t = window.setTimeout(() => {
        setPoweredOff(true);
      }, 1400);
      return () => window.clearTimeout(t);
    }
  }, [powerState, setPowerState, setLockScreenOpen]);

  if (powerState === 'running') return null;

  if (powerState === 'sleeping') {
    return (
      <div
        role="dialog"
        aria-label="Sleep Mode"
        onClick={() => {
          setPowerState('running');
          setLockScreenOpen(true);
        }}
        className="fixed inset-0 z-[195] bg-black flex flex-col items-center justify-center text-white/70 select-none cursor-pointer"
      >
        <p className="text-[15px] font-light">PC is sleeping. Click anywhere to wake up.</p>
      </div>
    );
  }

  if (poweredOff) {
    return (
      <div
        role="dialog"
        aria-label="Shut Down"
        className="fixed inset-0 z-[195] bg-black flex flex-col items-center justify-center gap-4 text-white select-none"
      >
        <p className="text-[14px] text-white/60">Windows has shut down.</p>
        <button
          type="button"
          onClick={() => {
            setPoweredOff(false);
            setPowerState('running');
            setLockScreenOpen(true);
          }}
          className="px-5 py-2 bg-[#0078d7] hover:bg-[#1084e0] text-[13px] text-white cursor-default"
        >
          Turn PC on
        </button>
      </div>
    );
  }

  return (
    <div
      role="status"
      aria-label={powerState === 'restarting' ? 'Restarting' : 'Shutting down'}
      className="fixed inset-0 z-[195] bg-[#005a9e] flex flex-col items-center justify-center gap-4 text-white select-none"
    >
      <div className="relative w-8 h-8" aria-hidden="true">
        {[0, 1, 2, 3, 4].map((idx) => (
          <span
            key={idx}
            className="win10-ring-dot"
            style={{ animationDelay: `${idx * 170}ms` }}
          />
        ))}
      </div>
      <div className="text-[20px] font-light">
        {powerState === 'restarting' ? 'Restarting' : 'Shutting down'}
      </div>
    </div>
  );
}

function WinXMenu() {
  const pos = useDesktopStore((s) => s.winXMenuPos);
  const setWinXMenuPos = useDesktopStore((s) => s.setWinXMenuPos);
  const openApp = useDesktopStore((s) => s.openApp);
  const openTerminal = useDesktopStore((s) => s.openTerminal);
  const openSettingsTab = useDesktopStore((s) => s.openSettingsTab);
  const setRunDialogOpen = useDesktopStore((s) => s.setRunDialogOpen);
  const setSearchOpen = useDesktopStore((s) => s.setSearchOpen);
  const setLockScreenOpen = useDesktopStore((s) => s.setLockScreenOpen);
  const setPowerState = useDesktopStore((s) => s.setPowerState);
  const toggleShowDesktop = useDesktopStore((s) => s.toggleShowDesktop);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pos) return;
    const onDown = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setWinXMenuPos(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setWinXMenuPos(null);
    };
    window.addEventListener('pointerdown', onDown);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('keydown', onKey);
    };
  }, [pos, setWinXMenuPos]);

  if (!pos) return null;

  const vw = typeof window !== 'undefined' ? window.innerWidth : 1280;
  const vh = typeof window !== 'undefined' ? window.innerHeight : 720;
  const menuW = 220;
  const menuH = 365;
  const left = Math.max(4, Math.min(pos.x, vw - menuW - 4));
  const top = Math.max(4, Math.min(pos.y - menuH, vh - menuH - 44));

  const itemCls =
    'w-full text-left px-4 py-1.5 text-[12px] text-white hover:bg-[#414141] cursor-default flex items-center justify-between';

  return (
    <div
      ref={menuRef}
      role="menu"
      aria-label="Quick Link menu"
      style={{ left, top, width: menuW }}
      onContextMenu={(e) => e.preventDefault()}
      className="fixed z-[98] bg-[#242424] border border-[#666666] shadow-2xl py-1 select-none"
    >
      <button type="button" className={itemCls} onClick={() => { openSettingsTab('Display'); setWinXMenuPos(null); }}>
        <span>Display settings</span>
      </button>
      <button type="button" className={itemCls} onClick={() => { openApp('settings'); setWinXMenuPos(null); }}>
        <span>Settings</span>
      </button>
      <button type="button" className={itemCls} onClick={() => { openTerminal('cmd'); setWinXMenuPos(null); }}>
        <span>Command Prompt</span>
      </button>
      <button type="button" className={itemCls} onClick={() => { openTerminal('powershell'); setWinXMenuPos(null); }}>
        <span>Windows PowerShell</span>
      </button>
      <button type="button" className={itemCls} onClick={() => { openApp('task-manager'); setWinXMenuPos(null); }}>
        <span>Task Manager</span>
      </button>
      <div className="h-px bg-white/15 my-1 mx-2" />
      <button type="button" className={itemCls} onClick={() => { openApp('explorer'); setWinXMenuPos(null); }}>
        <span>File Explorer</span>
      </button>
      <button type="button" className={itemCls} onClick={() => { setSearchOpen(true); setWinXMenuPos(null); }}>
        <span>Search</span>
      </button>
      <button type="button" className={itemCls} onClick={() => { setRunDialogOpen(true); setWinXMenuPos(null); }}>
        <span>Run</span>
      </button>
      <div className="h-px bg-white/15 my-1 mx-2" />
      <button type="button" className={itemCls} onClick={() => { setLockScreenOpen(true); setWinXMenuPos(null); }}>
        <span>Lock</span>
      </button>
      <button type="button" className={itemCls} onClick={() => { setPowerState('sleeping'); setWinXMenuPos(null); }}>
        <span>Sleep</span>
      </button>
      <button type="button" className={itemCls} onClick={() => { setPowerState('shutting-down'); setWinXMenuPos(null); }}>
        <span>Shut down</span>
      </button>
      <button type="button" className={itemCls} onClick={() => { setPowerState('restarting'); setWinXMenuPos(null); }}>
        <span>Restart</span>
      </button>
      <div className="h-px bg-white/15 my-1 mx-2" />
      <button type="button" className={itemCls} onClick={() => { toggleShowDesktop(); setWinXMenuPos(null); }}>
        <span>Desktop</span>
      </button>
    </div>
  );
}

function ToastContainer() {
  const toasts = useNotificationStore((s) => s.toasts);
  const dismissToast = useNotificationStore((s) => s.dismissToast);
  const focusAssist = useDesktopStore((s) => s.focusAssist);
  const taskbarSettings = useDesktopStore((s) => s.taskbarSettings);
  const insets = getTaskbarInsets(taskbarSettings);

  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      window.setTimeout(() => {
        dismissToast(t.id);
      }, 5000),
    );
    return () => timers.forEach((id) => window.clearTimeout(id));
  }, [toasts, dismissToast]);

  if (focusAssist || toasts.length === 0) return null;

  return (
    <div
      aria-live="polite"
      style={{
        bottom: insets.bottom + 12,
        right: insets.right + 12,
      }}
      className="fixed z-[92] flex flex-col gap-2 w-[330px] max-w-[calc(100vw-24px)] pointer-events-none"
    >
      {toasts.map((toast) => {
        const Icon = toast.kind === 'error' ? ErrorCircleRegular : CheckmarkCircleRegular;
        return (
          <div
            key={toast.id}
            onClick={() => {
              if (toast.target) {
                const { openApp } = useDesktopStore.getState();
                if ('fileId' in toast.target) {
                  const { nodes } = useFileSystemStore.getState();
                  const parentId = nodes[toast.target.fileId]?.parentId ?? toast.target.folderId;
                  openApp('explorer', nodes[parentId] ? parentId : 'this-pc', toast.target.fileId);
                } else {
                  openApp(toast.target.appId);
                }
              }
              dismissToast(toast.id);
            }}
            className="pointer-events-auto bg-[#1f1f1f]/95 backdrop-blur-xl border border-white/20 shadow-2xl p-3 text-white flex items-start gap-2.5 cursor-default hover:bg-[#2a2a2a] transition-colors"
          >
            <Icon
              aria-hidden="true"
              className={`mt-0.5 shrink-0 text-base ${toast.kind === 'error' ? 'text-[#ffa7a7]' : 'text-[#60cdff]'}`}
            />
            <div className="min-w-0 flex-1">
              <div className="text-[11px] text-white/65">{toast.source}</div>
              <div className="text-[13px] font-semibold truncate">{toast.title}</div>
              <div className="text-[12px] text-white/80 line-clamp-2">{toast.message}</div>
            </div>
            <button
              type="button"
              aria-label="Dismiss notification"
              onClick={(e) => {
                e.stopPropagation();
                dismissToast(toast.id);
              }}
              className="w-6 h-6 flex items-center justify-center hover:bg-white/10 shrink-0"
            >
              <DismissRegular />
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function SystemOverlays() {
  const nightLightEnabled = useDesktopStore((s) => s.nightLightEnabled);
  const brightness = useDesktopStore((s) => s.brightness);
  const isAltTabOpen = useDesktopStore((s) => s.isAltTabOpen);

  // Global Windows 10 keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.isComposing) return;
      const store = useDesktopStore.getState();
      if (store.powerState !== 'running') return;
      if (store.isLockScreenOpen) return;

      const key = e.key.toLowerCase();
      const winOrFallback =
        (e.metaKey && !e.ctrlKey && !e.altKey) ||
        (!e.metaKey && e.ctrlKey && e.altKey && !e.getModifierState('AltGraph'));

      // Ctrl+Shift+Esc -> Task Manager
      if (e.ctrlKey && e.shiftKey && !e.altKey && !e.metaKey && e.key === 'Escape') {
        e.preventDefault();
        store.openApp('task-manager');
        return;
      }

      // Ctrl+Esc -> Start Menu
      if (e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey && e.key === 'Escape') {
        e.preventDefault();
        store.toggleStartMenu();
        return;
      }

      // Ctrl+Win+ArrowLeft/Right or Ctrl+Alt+Shift+ArrowLeft/Right -> Virtual Desktops
      if (
        ((e.ctrlKey && e.metaKey && !e.altKey) || (e.ctrlKey && e.altKey && e.shiftKey)) &&
        (e.key === 'ArrowLeft' || e.key === 'ArrowRight')
      ) {
        e.preventDefault();
        store.switchVirtualDesktopByOffset(e.key === 'ArrowLeft' ? -1 : 1);
        return;
      }

      // Alt+Tab or Ctrl+Q -> Alt+Tab Switcher
      if ((e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'Tab') || (e.ctrlKey && !e.altKey && !e.metaKey && key === 'q')) {
        const activeDesktopWindows = store.windows.filter((w) => w.desktopId === store.activeDesktopId);
        if (activeDesktopWindows.length > 0) {
          e.preventDefault();
          if (!store.isAltTabOpen) {
            store.setAltTabState(true, activeDesktopWindows.length > 1 ? 1 : 0);
          } else {
            store.setAltTabState(true, store.altTabIndex + (e.shiftKey ? -1 : 1));
          }
        }
        return;
      }

      // Alt+F4 -> Close active window or Power menu
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.key === 'F4') {
        e.preventDefault();
        if (store.activeAppId) {
          store.closeWindow(store.activeAppId);
        } else {
          store.setWinXMenuPos({ x: 8, y: window.innerHeight - 44 });
        }
        return;
      }

      // Alt+Space -> Window Titlebar menu
      if (e.altKey && !e.ctrlKey && !e.metaKey && e.code === 'Space' && store.activeAppId) {
        const activeWin = store.windows.find((w) => w.id === store.activeAppId);
        if (activeWin) {
          e.preventDefault();
          const insets = getTaskbarInsets(store.taskbarSettings);
          store.setTitlebarMenuState({
            windowId: activeWin.id,
            x: activeWin.isMaximized ? insets.left + 8 : insets.left + activeWin.x + 8,
            y: activeWin.isMaximized ? insets.top + 32 : insets.top + activeWin.y + 32,
          });
        }
        return;
      }

      // Ctrl+W / Ctrl+Alt+W -> Close active window
      if (
        ((e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey) ||
          (e.ctrlKey && e.altKey && !e.shiftKey && !e.metaKey)) &&
        key === 'w' &&
        store.activeAppId
      ) {
        e.preventDefault();
        e.stopPropagation();
        store.closeWindow(store.activeAppId);
        return;
      }

      // Ctrl+D (when not typing in an input/editor) -> Show Desktop toggle
      if (e.ctrlKey && !e.altKey && !e.shiftKey && !e.metaKey && key === 'd' && !isEditableTarget(e.target)) {
        e.preventDefault();
        store.toggleShowDesktop();
        return;
      }

      if (!winOrFallback) return;

      if (key === 'd') {
        e.preventDefault();
        store.toggleShowDesktop();
      } else if (key === 'm') {
        e.preventDefault();
        if (e.shiftKey) store.restoreAllMinimized();
        else store.minimizeAll();
      } else if (key === 'e') {
        e.preventDefault();
        store.openApp('explorer');
      } else if (key === 'i') {
        e.preventDefault();
        store.openApp('settings');
      } else if (key === 's') {
        e.preventDefault();
        store.setSearchOpen(true);
      } else if (key === 'a') {
        e.preventDefault();
        store.setActionCenterOpen(!store.isActionCenterOpen);
      } else if (key === 'r') {
        e.preventDefault();
        store.setRunDialogOpen(true);
      } else if (key === 'l') {
        e.preventDefault();
        store.setLockScreenOpen(true);
      } else if (key === 'x') {
        e.preventDefault();
        store.setWinXMenuPos(store.winXMenuPos ? null : { x: 8, y: window.innerHeight - 44 });
      } else if (e.key === 'Tab') {
        e.preventDefault();
        store.toggleTaskView();
      } else if (e.key === 'ArrowUp') {
        if (store.snapOrMaximizeUp()) e.preventDefault();
      } else if (e.key === 'ArrowDown') {
        if (store.unSnapOrMinimizeActiveWindow()) e.preventDefault();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.key === 'Alt' || e.key === 'Control') {
        const store = useDesktopStore.getState();
        if (store.isAltTabOpen) {
          const desktopWindows = store.windows
            .filter((w) => w.desktopId === store.activeDesktopId)
            .sort((a, b) => b.zIndex - a.zIndex);
          if (desktopWindows.length > 0) {
            const idx = ((store.altTabIndex % desktopWindows.length) + desktopWindows.length) % desktopWindows.length;
            store.focusWindow(desktopWindows[idx].id);
          }
          store.setAltTabState(false, 0);
        }
      }
    };

    const handleResize = () => {
      useDesktopStore.getState().clampWindowsToViewport();
    };

    window.addEventListener('keydown', handleKeyDown, true);
    window.addEventListener('keyup', handleKeyUp, true);
    window.addEventListener('resize', handleResize);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
      window.removeEventListener('keyup', handleKeyUp, true);
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Dismiss Alt+Tab with Escape if needed
  useEffect(() => {
    if (!isAltTabOpen) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        useDesktopStore.getState().setAltTabState(false, 0);
      }
    };
    window.addEventListener('keydown', onEsc, true);
    return () => window.removeEventListener('keydown', onEsc, true);
  }, [isAltTabOpen]);

  return (
    <>
      <WinXMenu />
      <RunDialog />
      <AltTabOverlay />
      <ToastContainer />
      <LockScreenOverlay />
      <PowerOverlay />
      {nightLightEnabled && (
        <div
          aria-hidden="true"
          className="fixed inset-0 z-[190] pointer-events-none bg-[#ff9b3d]/20 mix-blend-multiply transition-opacity duration-300"
        />
      )}
      {brightness < 100 && (
        <div
          aria-hidden="true"
          style={{ opacity: ((100 - brightness) / 100) * 0.65 }}
          className="fixed inset-0 z-[191] pointer-events-none bg-black transition-opacity duration-150"
        />
      )}
    </>
  );
}
