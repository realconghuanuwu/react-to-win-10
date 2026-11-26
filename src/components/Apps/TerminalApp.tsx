import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from 'react';
import { useDesktopStore } from '../../store/useDesktopStore';
import { useFileSystemStore } from '../../store/useFileSystemStore';
import {
  buildBannerLines,
  executeTerminalCommand,
  formatPrompt,
  getAutocompleteSuggestions,
  getInitialCwdId,
  nextLineId,
  TERMINAL_THEMES,
  type OutputTone,
  type TerminalLine,
  type TerminalProfile,
  type TerminalTheme,
} from './terminal/terminalEngine';

interface TerminalAppProps {
  windowId: string;
}

interface TerminalTabState {
  id: string;
  profile: TerminalProfile;
  title: string;
  cwdId: string;
  lines: TerminalLine[];
  history: string[];
  historyIndex: number;
  draftInput: string;
  customColors: { bg?: string; fg?: string } | null;
}

function createTabState(
  profile: TerminalProfile,
  cwdId: string,
): TerminalTabState {
  return {
    id: `term-tab-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    profile,
    title: profile === 'powershell' ? 'Windows PowerShell' : 'Command Prompt',
    cwdId,
    lines: buildBannerLines(profile),
    history: [],
    historyIndex: -1,
    draftInput: '',
    customColors: null,
  };
}

function ProfileBadge({ profile }: { profile: TerminalProfile }) {
  if (profile === 'powershell') {
    return (
      <span className="inline-flex items-center justify-center w-4 h-3.5 rounded-[2px] bg-[#1b6ec2] text-white text-[8.5px] font-bold font-mono tracking-tight shrink-0">
        PS
      </span>
    );
  }
  return (
    <span className="inline-flex items-center justify-center w-4 h-3.5 rounded-[2px] bg-[#2b2b2b] border border-white/25 text-white/90 text-[8.5px] font-bold font-mono shrink-0">
      &gt;_
    </span>
  );
}

export function TerminalApp({ windowId }: TerminalAppProps) {
  const nodes = useFileSystemStore((s) => s.nodes);
  const storageUsedBytes = useFileSystemStore((s) => s.storageUsedBytes);
  const storageQuotaBytes = useFileSystemStore((s) => s.storageQuotaBytes);
  const createFolder = useFileSystemStore((s) => s.createFolder);
  const createTextFile = useFileSystemStore((s) => s.createTextFile);
  const updateFileContent = useFileSystemStore((s) => s.updateFileContent);
  const renameNode = useFileSystemStore((s) => s.renameNode);
  const deleteNodes = useFileSystemStore((s) => s.deleteNodes);
  const moveNodes = useFileSystemStore((s) => s.moveNodes);

  const windows = useDesktopStore((s) => s.windows);
  const activeAppId = useDesktopStore((s) => s.activeAppId);
  const userName = useDesktopStore((s) => s.userName);
  const wifiEnabled = useDesktopStore((s) => s.wifiEnabled);
  const airplaneMode = useDesktopStore((s) => s.airplaneMode);
  const networkName = useDesktopStore((s) => s.networkName);
  const terminalStartProfile = useDesktopStore((s) => s.terminalStartProfile);
  const terminalOpenNonce = useDesktopStore((s) => s.terminalOpenNonce);
  const openApp = useDesktopStore((s) => s.openApp);
  const openNotepadFile = useDesktopStore((s) => s.openNotepadFile);
  const openPhotoFile = useDesktopStore((s) => s.openPhotoFile);
  const openOfficeFile = useDesktopStore((s) => s.openOfficeFile);
  const closeWindow = useDesktopStore((s) => s.closeWindow);
  const setWindowTitle = useDesktopStore((s) => s.setWindowTitle);

  const initialProfile: TerminalProfile = terminalStartProfile ?? 'cmd';
  const [tabs, setTabs] = useState<TerminalTabState[]>(() => [
    createTabState(initialProfile, getInitialCwdId(nodes)),
  ]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0]?.id ?? '');
  const [themeId, setThemeId] = useState<TerminalTheme['id']>(
    initialProfile === 'powershell' ? 'powershell-blue' : 'campbell',
  );
  const [fontSize, setFontSize] = useState<number>(13);
  const [menuOpen, setMenuOpen] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);
  const [isPingingTabId, setIsPingingTabId] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const pingTimersRef = useRef<number[]>([]);
  const handledNonceRef = useRef<number>(terminalOpenNonce);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId],
  );

  const theme = useMemo(
    () => TERMINAL_THEMES.find((t) => t.id === themeId) ?? TERMINAL_THEMES[0],
    [themeId],
  );

  const effectiveBg =
    activeTab?.customColors?.bg ??
    (activeTab?.profile === 'powershell' && themeId === 'campbell' ? '#012456' : theme.bg);
  const effectiveFg = activeTab?.customColors?.fg ?? theme.fg;

  const stopPingTimers = useCallback(() => {
    pingTimersRef.current.forEach((id) => window.clearTimeout(id));
    pingTimersRef.current = [];
    setIsPingingTabId(null);
  }, []);

  useEffect(() => stopPingTimers, [stopPingTimers]);

  // Open requested profile tab when launched externally (Win+R `cmd`/`powershell`, Win+X)
  useEffect(() => {
    if (terminalOpenNonce === handledNonceRef.current) return;
    handledNonceRef.current = terminalOpenNonce;
    const requested = terminalStartProfile;
    if (!requested) return;
    setTabs((prev) => {
      const created = createTabState(requested, getInitialCwdId(nodes));
      setActiveTabId(created.id);
      return [...prev, created];
    });
    window.setTimeout(() => inputRef.current?.focus(), 20);
  }, [terminalOpenNonce, terminalStartProfile, nodes]);

  useEffect(() => {
    if (!activeTab) return;
    setWindowTitle(windowId, `${activeTab.title} - Windows Terminal`);
  }, [windowId, activeTab, setWindowTitle]);

  useEffect(() => {
    if (activeAppId === windowId) {
      window.setTimeout(() => inputRef.current?.focus(), 0);
    }
  }, [activeAppId, windowId, activeTabId]);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [activeTab?.lines.length, activeTabId]);

  useEffect(() => {
    if (!menuOpen && !contextMenu) return;
    const closeMenus = (e: PointerEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
      setContextMenu(null);
    };
    window.addEventListener('pointerdown', closeMenus);
    return () => window.removeEventListener('pointerdown', closeMenus);
  }, [menuOpen, contextMenu]);

  const updateTab = useCallback(
    (tabId: string, updater: (prev: TerminalTabState) => TerminalTabState) => {
      setTabs((prev) => prev.map((t) => (t.id === tabId ? updater(t) : t)));
    },
    [],
  );

  const handleNewTab = useCallback(
    (profile: TerminalProfile) => {
      const created = createTabState(profile, getInitialCwdId(nodes));
      setTabs((prev) => [...prev, created]);
      setActiveTabId(created.id);
      setMenuOpen(false);
      window.setTimeout(() => inputRef.current?.focus(), 0);
    },
    [nodes],
  );

  const handleCloseTab = useCallback(
    (tabId: string) => {
      if (isPingingTabId === tabId) stopPingTimers();
      setTabs((prev) => {
        if (prev.length <= 1) {
          closeWindow(windowId);
          return prev;
        }
        const idx = prev.findIndex((t) => t.id === tabId);
        const next = prev.filter((t) => t.id !== tabId);
        if (tabId === activeTabId) {
          const fallback = next[Math.max(0, idx - 1)] ?? next[0];
          if (fallback) setActiveTabId(fallback.id);
        }
        return next;
      });
    },
    [activeTabId, closeWindow, isPingingTabId, stopPingTimers, windowId],
  );

  const startPingForTab = useCallback(
    (tabId: string, host: string, count = 4) => {
      stopPingTimers();
      setIsPingingTabId(tabId);
      const fakeIp = host === 'localhost' || host === '127.0.0.1' ? '127.0.0.1' : '142.250.190.78';
      const append = (text: string, tone: OutputTone = 'normal') =>
        updateTab(tabId, (t) => ({
          ...t,
          lines: [...t.lines, { id: nextLineId(), text, tone }],
        }));

      append('');
      append(`Pinging ${host} [${fakeIp}] with 32 bytes of data:`, 'info');

      const times: number[] = [];
      for (let i = 0; i < count; i += 1) {
        const timer = window.setTimeout(() => {
          const ms = host === 'localhost' || host === '127.0.0.1' ? 1 : 11 + Math.floor(Math.random() * 14);
          times.push(ms);
          append(`Reply from ${fakeIp}: bytes=32 time=${ms}ms TTL=117`);

          if (i === count - 1) {
            const min = Math.min(...times);
            const max = Math.max(...times);
            const avg = Math.round(times.reduce((a, b) => a + b, 0) / times.length);
            append('');
            append(`Ping statistics for ${fakeIp}:`, 'info');
            append(`    Packets: Sent = ${count}, Received = ${count}, Lost = 0 (0% loss),`);
            append('Approximate round trip times in milli-seconds:');
            append(`    Minimum = ${min}ms, Maximum = ${max}ms, Average = ${avg}ms`);
            setIsPingingTabId(null);
            window.setTimeout(() => inputRef.current?.focus(), 0);
          }
        }, (i + 1) * 340);
        pingTimersRef.current.push(timer);
      }
    },
    [stopPingTimers, updateTab],
  );

  const submitCommand = useCallback(() => {
    if (!activeTab || isPingingTabId === activeTab.id) return;
    const raw = activeTab.draftInput;
    const promptPrefix = formatPrompt(activeTab.profile, activeTab.cwdId, nodes);
    const trimmed = raw.trim();

    let nextHistory = activeTab.history;
    if (trimmed) {
      nextHistory = [raw, ...activeTab.history.filter((item) => item !== raw)].slice(0, 60);
    }

    const promptLine: TerminalLine = {
      id: nextLineId(),
      text: `${promptPrefix}${raw}`,
      tone: 'prompt',
    };

    let cleared = false;
    let exited = false;
    let nextCwd = activeTab.cwdId;
    let nextTitle = activeTab.title;
    let nextCustomColors = activeTab.customColors;
    const asyncLines: TerminalLine[] = [];

    const output = executeTerminalCommand(raw, {
      cwdId: activeTab.cwdId,
      profile: activeTab.profile,
      userName,
      wifiEnabled,
      airplaneMode,
      networkName,
      windows,
      nodes,
      storageUsedBytes,
      storageQuotaBytes,
      fsActions: {
        createFolder,
        createTextFile,
        updateFileContent,
        renameNode,
        deleteNodes,
        moveNodes,
      },
      desktopActions: {
        openApp,
        openNotepadFile,
        openPhotoFile,
        openOfficeFile,
        closeWindow,
      },
      tabActions: {
        clearScreen: () => {
          cleared = true;
        },
        setCwdId: (id) => {
          nextCwd = id;
        },
        setTitle: (title) => {
          nextTitle = title;
        },
        setCustomColors: (colors) => {
          nextCustomColors = colors;
        },
        exitTab: () => {
          exited = true;
        },
        appendAsyncLine: (line) => {
          asyncLines.push(line);
        },
        startPing: (host, count) => {
          startPingForTab(activeTab.id, host, count);
        },
      },
    });

    if (exited) {
      handleCloseTab(activeTab.id);
      return;
    }

    updateTab(activeTab.id, (prev) => ({
      ...prev,
      cwdId: nextCwd,
      title: nextTitle,
      customColors: nextCustomColors,
      history: nextHistory,
      historyIndex: -1,
      draftInput: '',
      lines: cleared
        ? [...output, ...asyncLines]
        : [...prev.lines, promptLine, ...output, ...asyncLines],
    }));
  }, [
    activeTab,
    airplaneMode,
    closeWindow,
    createFolder,
    createTextFile,
    deleteNodes,
    handleCloseTab,
    isPingingTabId,
    moveNodes,
    networkName,
    nodes,
    openApp,
    openNotepadFile,
    openOfficeFile,
    openPhotoFile,
    renameNode,
    startPingForTab,
    storageQuotaBytes,
    storageUsedBytes,
    updateFileContent,
    updateTab,
    userName,
    wifiEnabled,
    windows,
  ]);

  const handleInputKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (!activeTab) return;

    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 't') {
      e.preventDefault();
      handleNewTab(activeTab.profile);
      return;
    }

    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'w') {
      e.preventDefault();
      handleCloseTab(activeTab.id);
      return;
    }

    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'l') {
      e.preventDefault();
      updateTab(activeTab.id, (prev) => ({ ...prev, lines: [] }));
      return;
    }

    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'c') {
      const selected = window.getSelection()?.toString() ?? '';
      if (selected.length > 0) return; // Allow native copy
      e.preventDefault();
      if (isPingingTabId === activeTab.id) {
        stopPingTimers();
        updateTab(activeTab.id, (prev) => ({
          ...prev,
          lines: [...prev.lines, { id: nextLineId(), text: '^C', tone: 'warn' }],
        }));
        return;
      }
      const promptPrefix = formatPrompt(activeTab.profile, activeTab.cwdId, nodes);
      updateTab(activeTab.id, (prev) => ({
        ...prev,
        draftInput: '',
        historyIndex: -1,
        lines: [
          ...prev.lines,
          { id: nextLineId(), text: `${promptPrefix}${prev.draftInput}^C`, tone: 'prompt' },
        ],
      }));
      return;
    }

    if (e.ctrlKey && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      setFontSize((s) => Math.min(22, s + 1));
      return;
    }
    if (e.ctrlKey && e.key === '-') {
      e.preventDefault();
      setFontSize((s) => Math.max(10, s - 1));
      return;
    }
    if (e.ctrlKey && e.key === '0') {
      e.preventDefault();
      setFontSize(13);
      return;
    }

    if (e.key === 'Enter') {
      e.preventDefault();
      submitCommand();
      return;
    }

    if (e.key === 'Tab') {
      e.preventDefault();
      const { completed, suggestions } = getAutocompleteSuggestions(
        activeTab.cwdId,
        activeTab.draftInput,
        nodes,
      );
      if (completed !== activeTab.draftInput) {
        updateTab(activeTab.id, (prev) => ({ ...prev, draftInput: completed }));
      } else if (suggestions.length > 1) {
        const promptPrefix = formatPrompt(activeTab.profile, activeTab.cwdId, nodes);
        updateTab(activeTab.id, (prev) => ({
          ...prev,
          lines: [
            ...prev.lines,
            { id: nextLineId(), text: `${promptPrefix}${prev.draftInput}`, tone: 'prompt' },
            { id: nextLineId(), text: suggestions.join('    '), tone: 'muted' },
          ],
        }));
      }
      return;
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (activeTab.history.length === 0) return;
      const nextIdx = Math.min(activeTab.history.length - 1, activeTab.historyIndex + 1);
      updateTab(activeTab.id, (prev) => ({
        ...prev,
        historyIndex: nextIdx,
        draftInput: prev.history[nextIdx] ?? prev.draftInput,
      }));
      return;
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const nextIdx = activeTab.historyIndex - 1;
      if (nextIdx < 0) {
        updateTab(activeTab.id, (prev) => ({
          ...prev,
          historyIndex: -1,
          draftInput: '',
        }));
      } else {
        updateTab(activeTab.id, (prev) => ({
          ...prev,
          historyIndex: nextIdx,
          draftInput: prev.history[nextIdx] ?? '',
        }));
      }
    }
  };

  const getLineColor = (tone: OutputTone | undefined): string => {
    switch (tone) {
      case 'error':
        return '#f48771';
      case 'success':
        return '#89d185';
      case 'warn':
        return '#cca700';
      case 'info':
        return '#60cdff';
      case 'muted':
        return theme.mutedFg;
      case 'prompt':
        return theme.promptFg;
      default:
        return effectiveFg;
    }
  };

  const handleViewportMouseUp = () => {
    const selected = window.getSelection()?.toString() ?? '';
    if (!selected) {
      inputRef.current?.focus();
    }
  };

  const handleContextMenu = (e: ReactMouseEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY });
  };

  const handleCopySelection = async () => {
    const selected = window.getSelection()?.toString() ?? '';
    if (selected && navigator.clipboard) {
      await navigator.clipboard.writeText(selected).catch(() => undefined);
    }
    setContextMenu(null);
    inputRef.current?.focus();
  };

  const handlePasteClipboard = async () => {
    setContextMenu(null);
    if (!activeTab || !navigator.clipboard) return;
    try {
      const clipText = await navigator.clipboard.readText();
      if (clipText) {
        updateTab(activeTab.id, (prev) => ({
          ...prev,
          draftInput: `${prev.draftInput}${clipText.replace(/\r?\n/g, ' ')}`,
        }));
      }
    } catch {
      // Clipboard read denied in headless/sandbox environments
    }
    inputRef.current?.focus();
  };

  const promptText = activeTab ? formatPrompt(activeTab.profile, activeTab.cwdId, nodes) : 'C:\\>';

  return (
    <div className="flex-1 min-h-0 flex flex-col bg-[#1f1f1f] text-white select-none">
      {/* Windows Terminal Tab Strip */}
      <div
        data-terminal-tabs="true"
        className="flex items-end h-[34px] px-2 pt-1 bg-[#1f1f1f] border-b border-white/10 gap-1 shrink-0"
      >
        <div className="flex items-end gap-1 overflow-x-auto no-scrollbar max-w-[calc(100%-76px)]">
          {tabs.map((tab) => {
            const isTabActive = tab.id === activeTab?.id;
            const tabBg = isTabActive ? effectiveBg : 'transparent';
            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isTabActive}
                onClick={() => {
                  setActiveTabId(tab.id);
                  window.setTimeout(() => inputRef.current?.focus(), 0);
                }}
                onMouseDown={(e) => {
                  if (e.button === 1) {
                    e.preventDefault();
                    handleCloseTab(tab.id);
                  }
                }}
                style={{ backgroundColor: tabBg }}
                className={[
                  'group flex items-center gap-2 h-[30px] min-w-[140px] max-w-[220px] px-2.5 rounded-t-[6px] text-[12px] cursor-default transition-colors',
                  isTabActive
                    ? 'text-white border-t border-x border-white/15'
                    : 'text-white/75 hover:bg-white/10',
                ].join(' ')}
              >
                <ProfileBadge profile={tab.profile} />
                <span className="truncate flex-1">{tab.title}</span>
                <button
                  type="button"
                  aria-label={`Close ${tab.title}`}
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCloseTab(tab.id);
                  }}
                  className="w-4 h-4 rounded-[3px] flex items-center justify-center text-white/60 hover:text-white hover:bg-white/15 text-[13px] leading-none"
                >
                  ×
                </button>
              </div>
            );
          })}
        </div>

        {/* New Tab (+) and Profile/Settings Dropdown */}
        <div ref={menuRef} className="relative flex items-center h-[28px] mb-[1px] shrink-0">
          <button
            type="button"
            title="New Tab (Ctrl+Shift+T)"
            aria-label="New Tab"
            onClick={() => handleNewTab(activeTab?.profile ?? 'cmd')}
            className="w-7 h-7 rounded-l-[4px] flex items-center justify-center text-white/85 hover:bg-white/12 text-[15px] leading-none cursor-default"
          >
            +
          </button>
          <button
            type="button"
            title="Open profile or appearance menu"
            aria-label="Terminal menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
            className="w-6 h-7 rounded-r-[4px] flex items-center justify-center text-white/80 hover:bg-white/12 text-[10px] border-l border-white/10 cursor-default"
          >
            ▾
          </button>

          {menuOpen && (
            <div
              role="menu"
              className="absolute left-0 top-full mt-1 w-[230px] bg-[#2b2b2b] border border-[#555555] shadow-2xl py-1 text-[12px] text-white z-40"
            >
              <div className="px-3 py-1 text-[10.5px] uppercase tracking-wider text-white/50">
                New Tab Profile
              </div>
              <button
                type="button"
                onClick={() => handleNewTab('cmd')}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#414141] text-left cursor-default"
              >
                <ProfileBadge profile="cmd" />
                <span>Command Prompt</span>
              </button>
              <button
                type="button"
                onClick={() => handleNewTab('powershell')}
                className="w-full flex items-center gap-2.5 px-3 py-1.5 hover:bg-[#414141] text-left cursor-default"
              >
                <ProfileBadge profile="powershell" />
                <span>Windows PowerShell</span>
              </button>

              <div className="h-px bg-white/15 my-1" />
              <div className="px-3 py-1 text-[10.5px] uppercase tracking-wider text-white/50">
                Color Scheme
              </div>
              {TERMINAL_THEMES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setThemeId(item.id);
                    if (activeTab) {
                      updateTab(activeTab.id, (prev) => ({ ...prev, customColors: null }));
                    }
                    setMenuOpen(false);
                  }}
                  className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#414141] text-left cursor-default"
                >
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3 h-3 rounded-sm border border-white/30"
                      style={{ backgroundColor: item.bg }}
                    />
                    <span>{item.label}</span>
                  </div>
                  {themeId === item.id && <span className="text-[#60cdff]">✓</span>}
                </button>
              ))}

              <div className="h-px bg-white/15 my-1" />
              <div className="px-3 py-1 flex items-center justify-between">
                <span className="text-white/75">Font Size</span>
                <div className="flex items-center gap-1">
                  {[12, 13, 15, 17].map((sz) => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setFontSize(sz)}
                      className={`px-1.5 py-0.5 text-[11px] rounded cursor-default ${
                        fontSize === sz ? 'bg-[#0078d7] text-white' : 'bg-white/10 hover:bg-white/20'
                      }`}
                    >
                      {sz}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Console Buffer */}
      <div
        ref={scrollRef}
        onMouseUp={handleViewportMouseUp}
        onContextMenu={handleContextMenu}
        style={{
          backgroundColor: effectiveBg,
          color: effectiveFg,
          fontSize: `${fontSize}px`,
          lineHeight: 1.45,
          fontFamily: "'Cascadia Mono', Consolas, 'Lucida Console', 'Courier New', monospace",
        }}
        className="win10-scroll flex-1 min-h-0 overflow-y-auto px-3.5 py-2.5 select-text cursor-text"
      >
        {activeTab?.lines.map((line) => (
          <div
            key={line.id}
            style={{ color: getLineColor(line.tone) }}
            className="whitespace-pre-wrap break-all min-h-[1.45em]"
          >
            {line.text}
          </div>
        ))}

        {/* Live Prompt Input Line */}
        {activeTab && isPingingTabId !== activeTab.id ? (
          <div className="flex items-center flex-nowrap min-h-[1.45em]">
            <span
              style={{ color: theme.promptFg }}
              className="whitespace-pre shrink-0"
            >
              {promptText}
            </span>
            <input
              ref={inputRef}
              type="text"
              value={activeTab.draftInput}
              onChange={(e) =>
                updateTab(activeTab.id, (prev) => ({ ...prev, draftInput: e.target.value }))
              }
              onKeyDown={handleInputKeyDown}
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
              autoCorrect="off"
              aria-label="Terminal command input"
              style={{ color: effectiveFg, caretColor: '#ffffff' }}
              className="flex-1 min-w-[60px] bg-transparent border-0 outline-none p-0 m-0 font-inherit text-inherit leading-inherit"
            />
          </div>
        ) : (
          <div className="text-white/60 text-[12px] pt-1">
            Running command... Press Ctrl+C to interrupt.
          </div>
        )}
      </div>

      {/* Right-Click Context Menu */}
      {contextMenu && (
        <div
          role="menu"
          onPointerDown={(e) => e.stopPropagation()}
          style={{
            left: Math.min(contextMenu.x, (typeof window !== 'undefined' ? window.innerWidth : 1200) - 210),
            top: Math.min(contextMenu.y, (typeof window !== 'undefined' ? window.innerHeight : 700) - 180),
          }}
          className="fixed z-[110] w-[200px] bg-[#2b2b2b] border border-[#666666] shadow-2xl py-1 text-[12px] text-white select-none"
        >
          <button
            type="button"
            onClick={() => void handleCopySelection()}
            className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={() => void handlePasteClipboard()}
            className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
          >
            Paste
          </button>
          <div className="h-px bg-white/15 my-1" />
          <button
            type="button"
            onClick={() => {
              if (activeTab) updateTab(activeTab.id, (prev) => ({ ...prev, lines: [] }));
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
          >
            Clear Buffer (Ctrl+L)
          </button>
          <button
            type="button"
            onClick={() => {
              handleNewTab('cmd');
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
          >
            New Command Prompt Tab
          </button>
          <button
            type="button"
            onClick={() => {
              handleNewTab('powershell');
              setContextMenu(null);
            }}
            className="w-full text-left px-3 py-1.5 hover:bg-[#414141] cursor-default"
          >
            New PowerShell Tab
          </button>
        </div>
      )}
    </div>
  );
}
