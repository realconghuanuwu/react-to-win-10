import { useEffect, useMemo, useRef, useState } from 'react';
import { createUniver, LocaleType, mergeLocales } from '@univerjs/presets';
import { UniverDocsCorePreset } from '@univerjs/preset-docs-core';
import UniverPresetDocsCoreEnUS from '@univerjs/preset-docs-core/locales/en-US';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import '@univerjs/preset-docs-core/lib/index.css';
import '@univerjs/preset-sheets-core/lib/index.css';
import { useDesktopStore } from '../../store/useDesktopStore';
import { useFileSystemStore } from '../../store/useFileSystemStore';
import { WordHomeScreen } from './WordHomeScreen';

export type OfficeMode = 'word' | 'excel';

interface OfficeAppProps {
  mode: OfficeMode;
  windowId: string;
}

type WordView = 'home' | 'editor';

const DEFAULT_DOC_TITLE = 'Document1.unidoc';
const DEFAULT_SHEET_TITLE = 'Book1.unisheet';

function createStarterWorkbookSnapshot(title: string) {
  return {
    id: `sheet-${Date.now()}`,
    name: title,
    sheetOrder: ['sheet-1'],
    sheets: {
      'sheet-1': {
        id: 'sheet-1',
        name: 'Sheet1',
        rowCount: 100,
        columnCount: 26,
        cellData: {
          0: {
            0: { v: 'Item', s: { bl: 1 } },
            1: { v: 'Category', s: { bl: 1 } },
            2: { v: 'Qty', s: { bl: 1 } },
            3: { v: 'Unit Price', s: { bl: 1 } },
            4: { v: 'Total', s: { bl: 1 } },
          },
          1: {
            0: { v: 'Windows 10 Pro License' },
            1: { v: 'Software' },
            2: { v: 2 },
            3: { v: 199 },
            4: { f: '=C2*D2' },
          },
          2: {
            0: { v: 'Microsoft 365 Family' },
            1: { v: 'Subscription' },
            2: { v: 1 },
            3: { v: 99 },
            4: { f: '=C3*D3' },
          },
          3: {
            0: { v: 'Total Budget', s: { bl: 1 } },
            4: { f: '=SUM(E2:E3)', s: { bl: 1 } },
          },
        },
      },
    },
  };
}

export function OfficeApp({ mode, windowId }: OfficeAppProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerApiRef = useRef<ReturnType<typeof createUniver>['univerAPI'] | null>(null);

  const officeActiveFileId = useDesktopStore((state) => state.officeActiveFileId);
  const officeOpenNonce = useDesktopStore((state) => state.officeOpenNonce);
  const openApp = useDesktopStore((state) => state.openApp);
  const setWindowTitle = useDesktopStore((state) => state.setWindowTitle);

  const nodes = useFileSystemStore((state) => state.nodes);
  const createTextFile = useFileSystemStore((state) => state.createTextFile);
  const updateFileContent = useFileSystemStore((state) => state.updateFileContent);

  const extension = mode === 'word' ? '.unidoc' : '.unisheet';
  const defaultTitle = mode === 'word' ? DEFAULT_DOC_TITLE : DEFAULT_SHEET_TITLE;
  const brandColor = mode === 'word' ? '#2b579a' : '#107c41';
  const brandHover = mode === 'word' ? 'hover:bg-[#1a3c70]' : 'hover:bg-[#0c6434]';
  const appLabel = mode === 'word' ? 'Word' : 'Excel';

  // Word shows home screen on first open; Excel goes straight to editor
  const [view, setView] = useState<WordView>(mode === 'word' ? 'home' : 'editor');
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState<string>(defaultTitle);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showOpenModal, setShowOpenModal] = useState<boolean>(false);
  const [reloadNonce, setReloadNonce] = useState<number>(0);

  // Sync incoming file open from Desktop / Explorer => go straight to editor
  useEffect(() => {
    if (officeOpenNonce === 0) return;
    if (officeActiveFileId && nodes[officeActiveFileId]?.kind === 'file') {
      const targetNode = nodes[officeActiveFileId];
      const lower = targetNode.name.toLowerCase();
      const matchesMode =
        mode === 'word'
          ? lower.endsWith('.unidoc') || lower.endsWith('.doc') || lower.endsWith('.docx')
          : lower.endsWith('.unisheet') || lower.endsWith('.xls') || lower.endsWith('.xlsx');
      if (matchesMode) {
        setCurrentFileId(targetNode.id);
        setDocumentTitle(targetNode.name);
        setView('editor');
        setReloadNonce((n) => n + 1);
      }
    }
  }, [officeActiveFileId, officeOpenNonce, mode, nodes]);

  // Update window title bar
  useEffect(() => {
    if (view === 'home') {
      setWindowTitle(windowId, appLabel);
    } else {
      setWindowTitle(windowId, `${documentTitle} - ${appLabel}`);
    }
  }, [windowId, documentTitle, appLabel, view, setWindowTitle]);

  // Auto-dismiss status toast
  useEffect(() => {
    if (!statusMessage) return;
    const timer = window.setTimeout(() => setStatusMessage(''), 2600);
    return () => window.clearTimeout(timer);
  }, [statusMessage]);

  // Mount / remount UniverJS when entering editor view
  useEffect(() => {
    if (view !== 'editor') return;
    const host = containerRef.current;
    if (!host) return;

    const container = document.createElement('div');
    container.style.width = '100%';
    container.style.height = '100%';
    host.append(container);

    const { univer, univerAPI } =
      mode === 'word'
        ? createUniver({
            locale: LocaleType.EN_US,
            locales: { [LocaleType.EN_US]: mergeLocales(UniverPresetDocsCoreEnUS) },
            presets: [UniverDocsCorePreset({ container })],
          })
        : createUniver({
            locale: LocaleType.EN_US,
            locales: { [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS) },
            presets: [UniverSheetsCorePreset({ container })],
          });

    univerApiRef.current = univerAPI;

    // Load saved snapshot or create fresh document
    let parsedSnapshot: Record<string, unknown> | null = null;
    if (currentFileId) {
      const fileNode = useFileSystemStore.getState().nodes[currentFileId];
      if (fileNode?.kind === 'file' && fileNode.content) {
        try {
          parsedSnapshot = JSON.parse(fileNode.content) as Record<string, unknown>;
        } catch {
          parsedSnapshot = null;
        }
      }
    }

    if (mode === 'word') {
      if (parsedSnapshot) {
        univerAPI.createDocument(
          parsedSnapshot as Parameters<typeof univerAPI.createDocument>[0],
        );
      } else {
        const doc = univerAPI.createDocument({
          id: `doc-${Date.now()}`,
          title: documentTitle,
        });
        try {
          doc.insertText(
            0,
            'Welcome to Microsoft Word (UniverJS)\rStart typing your document here.',
          );
        } catch {
          // blank document is fine
        }
      }
    } else {
      const sheetData = (parsedSnapshot ??
        createStarterWorkbookSnapshot(documentTitle)) as Parameters<
        typeof univerAPI.createWorkbook
      >[0];
      univerAPI.createWorkbook(sheetData);
    }

    return () => {
      univerApiRef.current = null;
      queueMicrotask(() => {
        univer.dispose();
        container.remove();
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, view, reloadNonce]);

  // All saved Word/Excel files from virtual FS
  const savedOfficeFiles = useMemo(() => {
    return Object.values(nodes)
      .filter((n) => {
        if (n.kind !== 'file' || n.parentId === 'recycle-bin') return false;
        const lower = n.name.toLowerCase();
        return mode === 'word'
          ? lower.endsWith('.unidoc') || lower.endsWith('.doc') || lower.endsWith('.docx')
          : lower.endsWith('.unisheet') || lower.endsWith('.xls') || lower.endsWith('.xlsx');
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
  }, [nodes, mode]);

  // ── Helpers ───────────────────────────────────────────────────────────────

  const getCurrentSnapshotJson = (): string | null => {
    const api = univerApiRef.current;
    if (!api) return null;
    if (mode === 'word') {
      const doc = api.getActiveDocument();
      if (!doc) return null;
      return JSON.stringify(doc.save());
    }
    const wb = api.getActiveWorkbook();
    if (!wb) return null;
    return JSON.stringify(wb.save());
  };

  const handleNew = () => {
    setCurrentFileId(null);
    setDocumentTitle(defaultTitle);
    setView('editor');
    setReloadNonce((n) => n + 1);
  };

  const handleNewWelcome = () => {
    setCurrentFileId(null);
    setDocumentTitle(defaultTitle);
    setView('editor');
    setReloadNonce((n) => n + 1);
  };

  const handleOpenFileFromHome = (fileId: string) => {
    const target = nodes[fileId];
    if (!target || target.kind !== 'file') return;
    setCurrentFileId(target.id);
    setDocumentTitle(target.name);
    setView('editor');
    setReloadNonce((n) => n + 1);
  };

  const handleOpenSavedFile = (fileId: string) => {
    const target = nodes[fileId];
    if (!target || target.kind !== 'file') return;
    setCurrentFileId(target.id);
    setDocumentTitle(target.name);
    setShowOpenModal(false);
    setView('editor');
    setReloadNonce((n) => n + 1);
    setStatusMessage(`Opened ${target.name}`);
  };

  /** Save to virtual Win10 FS (Documents folder) */
  const handleSaveToWin10 = () => {
    const serialized = getCurrentSnapshotJson();
    if (!serialized) { setStatusMessage('Nothing to save'); return; }

    if (currentFileId && nodes[currentFileId]?.kind === 'file') {
      updateFileContent(currentFileId, serialized);
      setStatusMessage(`Saved "${nodes[currentFileId].name}" to This PC`);
      return;
    }

    const baseName =
      documentTitle.replace(/\.(unidoc|unisheet)$/i, '') ||
      (mode === 'word' ? 'Document' : 'Book');
    const desiredName = `${baseName}${extension}`;
    const targetFolderId = nodes.documents ? 'documents' : 'desktop';
    const createdId = createTextFile(targetFolderId, desiredName, serialized);
    if (createdId) {
      const createdNode = useFileSystemStore.getState().nodes[createdId];
      setCurrentFileId(createdId);
      if (createdNode) {
        setDocumentTitle(createdNode.name);
        setStatusMessage(`Saved to Documents\\${createdNode.name}`);
      }
    }
  };

  /** Download to real local PC as .json (browser download API) */
  const handleSaveToLocal = () => {
    const serialized = getCurrentSnapshotJson();
    if (!serialized) { setStatusMessage('Nothing to save'); return; }
    const blob = new Blob([serialized], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${documentTitle.replace(/\.(unidoc|unisheet)$/i, '')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatusMessage('Saved to your local PC (Downloads)');
  };

  // ── Render: Word Home Screen ──────────────────────────────────────────────
  if (mode === 'word' && view === 'home') {
    return (
      <WordHomeScreen
        recentFiles={savedOfficeFiles}
        onNewBlank={handleNew}
        onNewWelcome={handleNewWelcome}
        onOpenFile={handleOpenFileFromHome}
        onOpenFromPc={() => setShowOpenModal(true)}
      />
    );
  }

  // ── Render: Editor (Word or Excel) ────────────────────────────────────────
  return (
    <div
      data-testid={`office-${mode}-app`}
      className="flex-1 flex flex-col bg-[#f3f2f1] overflow-hidden select-none relative"
    >
      {/* Office Top Action Bar */}
      <div
        style={{ backgroundColor: brandColor }}
        className="h-9 px-3 flex items-center justify-between text-white text-[12px] shrink-0 border-b border-black/15"
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Back to Home (Word only) */}
          {mode === 'word' && (
            <button
              type="button"
              onClick={() => setView('home')}
              title="Back to Word Home"
              className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors cursor-default ${brandHover}`}
            >
              <svg viewBox="0 0 10 10" width="10" height="10" fill="currentColor" aria-hidden="true">
                <path d="M6.5 1.5l-4 3.5 4 3.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
              </svg>
              Home
            </button>
          )}
          <img
            src={mode === 'word' ? '/assets/icons/word.svg' : '/assets/icons/excel.svg'}
            alt=""
            className="w-4 h-4 object-contain shrink-0"
          />
          <span className="font-semibold tracking-tight">{appLabel}</span>
          <span className="text-white/50">|</span>
          <span className="truncate max-w-[200px] text-white/95 font-normal">
            {documentTitle}
          </span>
          {statusMessage && (
            <span className="ml-2 px-2 py-0.5 rounded bg-black/20 text-[11px] text-white/90 truncate">
              {statusMessage}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleNew}
            className={`px-2.5 py-1 rounded text-[12px] transition-colors cursor-default ${brandHover}`}
          >
            New
          </button>
          <button
            type="button"
            onClick={() => setShowOpenModal(true)}
            className={`px-2.5 py-1 rounded text-[12px] transition-colors cursor-default ${brandHover}`}
          >
            Open
          </button>
          <button
            type="button"
            onClick={handleSaveToWin10}
            className={`px-2.5 py-1 rounded text-[12px] font-medium bg-white/15 transition-colors cursor-default ${brandHover}`}
          >
            Save to Win 10
          </button>
          <button
            type="button"
            onClick={handleSaveToLocal}
            className={`px-2.5 py-1 rounded text-[12px] font-medium bg-white/15 transition-colors cursor-default ${brandHover}`}
          >
            Save to PC
          </button>
          <span className="mx-1 h-4 w-[1px] bg-white/25" />
          <button
            type="button"
            onClick={() => openApp(mode === 'word' ? 'excel' : 'word')}
            className={`px-2.5 py-1 rounded text-[12px] transition-colors cursor-default ${brandHover}`}
          >
            Open {mode === 'word' ? 'Excel' : 'Word'}
          </button>
        </div>
      </div>

      {/* UniverJS Mount Container */}
      <div
        ref={containerRef}
        className="flex-1 min-h-0 w-full relative overflow-hidden bg-white"
      />

      {/* Open Saved File Modal */}
      {showOpenModal && (
        <div
          className="absolute inset-0 z-50 bg-black/35 flex items-center justify-center p-4"
          onClick={() => setShowOpenModal(false)}
        >
          <div
            className="w-full max-w-md bg-white border border-[#cccccc] shadow-2xl text-[#222222] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{ backgroundColor: brandColor }}
              className="px-4 py-2.5 text-white flex items-center justify-between"
            >
              <span className="text-[13px] font-semibold">
                Open {appLabel} File ({extension})
              </span>
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="text-white/85 hover:text-white text-[14px] px-1 cursor-default"
              >
                ✕
              </button>
            </div>
            <div className="p-3 max-h-64 overflow-y-auto win10-scroll">
              {savedOfficeFiles.length === 0 ? (
                <p className="text-[12px] text-[#666666] py-6 text-center">
                  No saved {extension} files found. Click <strong>Save to Win 10</strong> to store a file in Documents.
                </p>
              ) : (
                <ul className="divide-y divide-[#eeeeee]">
                  {savedOfficeFiles.map((file) => (
                    <li key={file.id}>
                      <button
                        type="button"
                        onClick={() => handleOpenSavedFile(file.id)}
                        className="w-full text-left px-3 py-2 hover:bg-[#f3f2f1] flex items-center justify-between text-[12px] cursor-default"
                      >
                        <span className="font-medium truncate">{file.name}</span>
                        <span className="text-[11px] text-[#777777] shrink-0 ml-2">
                          {new Date(file.modifiedAt).toLocaleTimeString()}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div className="px-4 py-2 bg-[#f3f2f1] border-t border-[#e0e0e0] flex justify-end">
              <button
                type="button"
                onClick={() => setShowOpenModal(false)}
                className="px-3 py-1 bg-white border border-[#cccccc] hover:bg-[#e8e8e8] text-[12px] cursor-default"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
