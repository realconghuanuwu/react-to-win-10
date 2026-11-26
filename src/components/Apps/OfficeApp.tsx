import { useEffect, useMemo, useRef, useState } from 'react';
import { createUniver, LocaleType, mergeLocales, type IDocumentData, type IWorkbookData } from '@univerjs/presets';
import { UniverDocsCorePreset } from '@univerjs/preset-docs-core';
import UniverPresetDocsCoreEnUS from '@univerjs/preset-docs-core/locales/en-US';
import { UniverSheetsCorePreset } from '@univerjs/preset-sheets-core';
import UniverPresetSheetsCoreEnUS from '@univerjs/preset-sheets-core/locales/en-US';
import '@univerjs/preset-docs-core/lib/index.css';
import '@univerjs/preset-sheets-core/lib/index.css';
import { useDesktopStore } from '../../store/useDesktopStore';
import { useFileSystemStore, waitForFileSystemWrite } from '../../store/useFileSystemStore';
import { notify } from '../../store/useNotificationStore';
import { OfficeHomeScreen } from './OfficeHomeScreen';

export type OfficeMode = 'word' | 'excel';

interface OfficeAppProps {
  mode: OfficeMode;
  windowId: string;
}

type WordView = 'home' | 'editor';

const DEFAULT_DOC_TITLE = 'Document1.unidoc';
const DEFAULT_SHEET_TITLE = 'Book1.unisheet';

function createBlankWorkbookSnapshot(title: string) {
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
        cellData: {},
      },
    },
  };
}

export function OfficeApp({ mode, windowId }: OfficeAppProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const univerApiRef = useRef<ReturnType<typeof createUniver>['univerAPI'] | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const importedSnapshot = useRef<object | null>(null);
  const importRequest = useRef(0);

  const officeActiveFileId = useDesktopStore((state) => state.officeActiveFileId);
  const officeOpenNonce = useDesktopStore((state) => state.officeOpenNonce);
  const openApp = useDesktopStore((state) => state.openApp);
  const setWindowTitle = useDesktopStore((state) => state.setWindowTitle);

  const nodes = useFileSystemStore((state) => state.nodes);
  const createTextFile = useFileSystemStore((state) => state.createTextFile);
  const updateFileContent = useFileSystemStore((state) => state.updateFileContent);

  const extension = mode === 'word' ? '.unidoc' : '.unisheet';
  const officeExtension = mode === 'word' ? '.docx' : '.xlsx';
  const defaultTitle = mode === 'word' ? DEFAULT_DOC_TITLE : DEFAULT_SHEET_TITLE;
  const brandColor = mode === 'word' ? '#2b579a' : '#107c41';
  const brandHover = mode === 'word' ? 'hover:bg-[#1a3c70]' : 'hover:bg-[#0c6434]';
  const appLabel = mode === 'word' ? 'Word' : 'Excel';

  // Both Word and Excel show home screen on first open
  const [view, setView] = useState<WordView>('home');
  const [currentFileId, setCurrentFileId] = useState<string | null>(null);
  const [documentTitle, setDocumentTitle] = useState<string>(defaultTitle);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [showOpenModal, setShowOpenModal] = useState<boolean>(false);
  const [reloadNonce, setReloadNonce] = useState<number>(0);
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState('');
  const [exporting, setExporting] = useState(false);
  const [saving, setSaving] = useState(false);
  const notificationSource = mode === 'word' ? 'Word' : 'Excel';

  useEffect(() => () => { importRequest.current++; }, []);

  // Sync incoming file open from Desktop / Explorer => go straight to editor
  useEffect(() => {
    if (officeOpenNonce === 0) return;
    const nodes = useFileSystemStore.getState().nodes;
    if (officeActiveFileId && nodes[officeActiveFileId]?.kind === 'file') {
      const targetNode = nodes[officeActiveFileId];
      const lower = targetNode.name.toLowerCase();
      const matchesMode =
        mode === 'word'
          ? lower.endsWith('.unidoc') || lower.endsWith('.doc') || lower.endsWith('.docx')
          : lower.endsWith('.unisheet') || lower.endsWith('.xls') || lower.endsWith('.xlsx');
      if (matchesMode) {
        importRequest.current++;
        setImporting(false);
        importedSnapshot.current = null;
        setCurrentFileId(targetNode.id);
        setDocumentTitle(targetNode.name);
        setView('editor');
        setShowOpenModal(false);
        setReloadNonce((n) => n + 1);
      }
    }
  }, [officeActiveFileId, officeOpenNonce, mode]);

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

    // Apply gray canvas background (like real Word/Excel) after UniverJS mounts
    const applyCanvasBg = () => {
      // UniverJS wraps canvas in a div with overflow:hidden – set bg on that wrapper
      const canvasEl = container.querySelector<HTMLElement>('canvas');
      if (canvasEl?.parentElement) {
        canvasEl.parentElement.style.backgroundColor = '#b2b2b2';
      }
      // Also set on the top-level scrollable area inside container
      const scrollArea = container.querySelector<HTMLElement>('[class*="viewport"], [class*="canvas-container"], [class*="scroll"]');
      if (scrollArea) scrollArea.style.backgroundColor = '#b2b2b2';
      // Set on container root itself
      container.style.backgroundColor = '#b2b2b2';
    };
    // Try immediately and after a short delay (UniverJS renders asynchronously)
    applyCanvasBg();
    const bgTimer = window.setTimeout(applyCanvasBg, 300);
    // Also watch DOM mutations in case UniverJS injects canvas later
    const bgObserver = new MutationObserver(applyCanvasBg);
    bgObserver.observe(container, { childList: true, subtree: true });
    const stopObserver = window.setTimeout(() => bgObserver.disconnect(), 3000);

    // Load saved snapshot or create fresh document
    let parsedSnapshot = importedSnapshot.current;
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
        univerAPI.createDocument({
          id: `doc-${Date.now()}`,
          title: documentTitle,
        });
      }
    } else {
      const sheetData = (parsedSnapshot ??
        createBlankWorkbookSnapshot(documentTitle)) as Parameters<
        typeof univerAPI.createWorkbook
      >[0];
      univerAPI.createWorkbook(sheetData);
    }

    return () => {
      window.clearTimeout(bgTimer);
      window.clearTimeout(stopObserver);
      bgObserver.disconnect();
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

  const getCurrentSnapshot = () => {
    const api = univerApiRef.current;
    if (!api) return null;
    if (mode === 'word') {
      const doc = api.getActiveDocument();
      if (!doc) return null;
      return doc.save();
    }
    const wb = api.getActiveWorkbook();
    if (!wb) return null;
    return wb.save();
  };

  const handleNew = () => {
    importedSnapshot.current = null;
    setCurrentFileId(null);
    setDocumentTitle(defaultTitle);
    setView('editor');
    setReloadNonce((n) => n + 1);
  };

  const handleOpenSavedFile = (fileId: string) => {
    const target = nodes[fileId];
    if (!target || target.kind !== 'file') return;
    importedSnapshot.current = null;
    setCurrentFileId(target.id);
    setDocumentTitle(target.name);
    setShowOpenModal(false);
    setView('editor');
    setReloadNonce((n) => n + 1);
    setStatusMessage(`Opened ${target.name}`);
  };

  /** Save to virtual Win10 FS (Documents folder) */
  const handleSaveToWin10 = async () => {
    setSaving(true);
    try {
      const snapshot = getCurrentSnapshot();
      if (!snapshot) { setStatusMessage('Nothing to save'); return; }
      const serialized = JSON.stringify(snapshot);
      let fileId = currentFileId;
      if (fileId && useFileSystemStore.getState().nodes[fileId]?.kind === 'file') {
        updateFileContent(fileId, serialized);
      } else {
        const baseName = documentTitle.replace(/\.(unidoc|unisheet|docx?|xlsx?)$/i, '') ||
          (mode === 'word' ? 'Document' : 'Book');
        fileId = createTextFile(nodes.documents ? 'documents' : 'desktop', `${baseName}${extension}`, serialized);
        if (fileId) {
          setCurrentFileId(fileId);
          setDocumentTitle(useFileSystemStore.getState().nodes[fileId].name);
        }
      }
      if (!fileId) throw new Error('The destination folder is unavailable.');
      const saved = useFileSystemStore.getState().nodes[fileId];
      await waitForFileSystemWrite();
      const message = `Saved "${saved.name}" to Win 10.`;
      setStatusMessage(message);
      notify({
        source: notificationSource,
        title: 'File saved',
        message,
        kind: 'success',
        target: { fileId, folderId: saved.parentId ?? 'this-pc' },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not write the file to local storage.';
      setStatusMessage('Could not save to Win 10.');
      notify({ source: notificationSource, title: 'Could not save to Win 10', message, kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const handleOpenLocal = async (file: File) => {
    const request = ++importRequest.current;
    setImporting(true);
    setImportError('');
    try {
      if (!file.name.toLowerCase().endsWith(officeExtension)) {
        throw new Error(`Choose a ${officeExtension} file.`);
      }
      if (file.size > 32 * 1024 * 1024) throw new Error('This file exceeds 32 MB.');
      const buffer = await file.arrayBuffer();
      const snapshot = mode === 'word'
        ? (await import('./officeDocx')).importDocx(buffer, file.name)
        : await (await import('./officeXlsx')).importXlsx(buffer, file.name);
      if (request !== importRequest.current) return;
      importedSnapshot.current = snapshot;
      setCurrentFileId(null);
      setDocumentTitle(file.name);
      setShowOpenModal(false);
      setView('editor');
      setReloadNonce((n) => n + 1);
      setStatusMessage(`Opened ${file.name}`);
    } catch (error) {
      if (request === importRequest.current) {
        setImportError(error instanceof Error ? `Could not open file. ${error.message}` : 'Could not open file.');
      }
    } finally {
      if (request === importRequest.current) setImporting(false);
    }
  };

  const handleSaveToLocal = async () => {
    const snapshot = getCurrentSnapshot();
    if (!snapshot) { setStatusMessage('Nothing to save'); return; }
    setExporting(true);
    try {
      const blob = mode === 'word'
        ? (await import('./officeDocx')).exportDocx(snapshot as IDocumentData)
        : await (await import('./officeXlsx')).exportXlsx(snapshot as IWorkbookData);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${documentTitle.replace(/\.(unidoc|unisheet|docx?|xlsx?)$/i, '')}${officeExtension}`;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1_000);
      const message = `Browser download started for "${link.download}".`;
      setStatusMessage(message);
      notify({ source: notificationSource, title: 'Browser download started', message, kind: 'success' });
    } catch {
      const message = `Could not export ${officeExtension}.`;
      setStatusMessage(message);
      notify({ source: notificationSource, title: 'Export failed', message, kind: 'error' });
    } finally {
      setExporting(false);
    }
  };

  const showOpen = () => {
    setImportError('');
    setShowOpenModal(true);
  };

  const closeOpen = () => {
    if (importing) return;
    setShowOpenModal(false);
  };

  // ── Render: Editor (Word or Excel) ────────────────────────────────────────
  return (
    <div
      data-testid={view === 'editor' ? `office-${mode}-app` : undefined}
      className="flex-1 flex flex-col bg-[#f3f2f1] overflow-hidden select-none relative"
    >
      {view === 'home' ? (
        <OfficeHomeScreen mode={mode} recentFiles={savedOfficeFiles} onNewBlank={handleNew}
          onOpenFile={handleOpenSavedFile} onOpenFromPc={showOpen} />
      ) : <>
      {/* Office Top Action Bar */}
      <div
        style={{ backgroundColor: brandColor }}
        className="h-9 px-3 flex items-center justify-between text-white text-[12px] shrink-0 border-b border-black/15"
      >
        <div className="flex items-center gap-2 min-w-0">
          {/* Back to Home (Word & Excel) */}
          <button
            type="button"
            onClick={() => setView('home')}
            title={`Back to ${appLabel} Home`}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[11px] transition-colors cursor-default ${brandHover}`}
          >
            <svg viewBox="0 0 10 10" width="10" height="10" fill="currentColor" aria-hidden="true">
              <path d="M6.5 1.5l-4 3.5 4 3.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </svg>
            Home
          </button>
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
            <span role="status" className="ml-2 px-2 py-0.5 rounded bg-black/20 text-[11px] text-white/90 truncate">
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
            onClick={showOpen}
            className={`px-2.5 py-1 rounded text-[12px] transition-colors cursor-default ${brandHover}`}
          >
            Open
          </button>
          <button
            type="button"
            onClick={handleSaveToWin10}
            disabled={saving}
            className={`px-2.5 py-1 rounded text-[12px] font-medium bg-white/15 transition-colors cursor-default ${brandHover}`}
          >
            {saving ? 'Saving…' : 'Save to Win 10'}
          </button>
          <button
            type="button"
            onClick={handleSaveToLocal}
            disabled={exporting}
            className={`px-2.5 py-1 rounded text-[12px] font-medium bg-white/15 transition-colors cursor-default ${brandHover}`}
          >
            {exporting ? 'Exporting…' : `Save ${officeExtension} to PC`}
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
        className="flex-1 min-h-0 w-full relative overflow-hidden bg-[#b2b2b2]"
      />
      </>}

      {/* Open Saved File Modal */}
      {showOpenModal && (
        <div
          className="absolute inset-0 z-50 bg-black/35 flex items-center justify-center p-4"
          onClick={closeOpen}
        >
          <div
            className="w-full max-w-md bg-white border border-[#cccccc] shadow-2xl text-[#222222] flex flex-col"
            role="dialog"
            aria-modal="true"
            aria-label={`Open ${appLabel} file`}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{ backgroundColor: brandColor }}
              className="px-4 py-2.5 text-white flex items-center justify-between"
            >
              <span className="text-[13px] font-semibold">
                Open {appLabel} file
              </span>
              <button
                type="button"
                onClick={closeOpen}
                disabled={importing}
                aria-label="Close"
                className="text-white/85 hover:text-white text-[14px] px-1 cursor-default"
              >
                ✕
              </button>
            </div>
            <div className="px-3 py-3 border-b border-[#eeeeee]">
              <input ref={fileInputRef} type="file" accept={officeExtension} hidden
                onChange={(event) => {
                  const file = event.currentTarget.files?.[0];
                  event.currentTarget.value = '';
                  if (file) void handleOpenLocal(file);
                }} />
              <button type="button" onClick={() => fileInputRef.current?.click()} disabled={importing}
                className="px-3 py-1.5 bg-white border border-[#cccccc] hover:bg-[#e8e8e8] text-[12px]">
                {importing ? 'Opening…' : `Browse this PC (${officeExtension})`}
              </button>
              <p className="mt-2 text-[11px] text-[#605e5c]">
                {mode === 'word'
                  ? 'Supports text and basic formatting. Complex layouts, tables and images may be simplified or omitted.'
                  : 'Supports cell data, basic formulas and number formats. Charts, merged cells and advanced formatting may be omitted.'}
              </p>
              {importError && <p role="alert" className="mt-2 text-[12px] text-[#a4262c] break-words">{importError}</p>}
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
                        disabled={importing}
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
                onClick={closeOpen}
                disabled={importing}
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
