import { useEffect, useMemo, useRef, useState } from 'react';
import { createUniver, DocumentFlavor, LocaleType, mergeLocales, type IDocumentData, type IWorkbookData } from '@univerjs/presets';
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
import { ExcelRibbon } from './ExcelRibbon';
import { WordRibbon } from './WordRibbon';

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
  const [officeUniverApi, setOfficeUniverApi] = useState<ReturnType<typeof createUniver>['univerAPI'] | null>(null);
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
            presets: [
              UniverDocsCorePreset({
                container,
                header: false,
                toolbar: false,
              }),
            ],
          })
        : createUniver({
            locale: LocaleType.EN_US,
            locales: { [LocaleType.EN_US]: mergeLocales(UniverPresetSheetsCoreEnUS) },
            presets: [
              UniverSheetsCorePreset({
                container,
                header: false,
                toolbar: false,
                formulaBar: false,
              }),
            ],
          });

    univerApiRef.current = univerAPI;
    setOfficeUniverApi(univerAPI);

    // Apply Microsoft Word workspace gray (#e6e6e6) around the white page
    const applyCanvasBg = () => {
      if (mode === 'excel') return;
      const wordGray = '#e6e6e6';
      container.style.backgroundColor = wordGray;
      container.style.setProperty('--univer-gray-100', wordGray);
      container.style.setProperty('--univer-gray-0', wordGray);
      const canvasEl = container.querySelector<HTMLElement>('canvas');
      if (canvasEl) {
        if (canvasEl.style.backgroundColor !== wordGray) {
          canvasEl.style.backgroundColor = wordGray;
        }
        if (canvasEl.parentElement) {
          canvasEl.parentElement.style.backgroundColor = wordGray;
        }
      }
      const scrollArea = container.querySelector<HTMLElement>('[class*="viewport"], [class*="canvas-container"], [class*="scroll"]');
      if (scrollArea) scrollArea.style.backgroundColor = wordGray;
    };
    // Try immediately and after a short delay (UniverJS renders asynchronously)
    applyCanvasBg();
    const bgTimer = window.setTimeout(applyCanvasBg, 300);
    // Also watch DOM mutations in case UniverJS injects or restyles canvas later
    const bgObserver = new MutationObserver(applyCanvasBg);
    bgObserver.observe(container, { childList: true, subtree: true, attributes: true, attributeFilter: ['style'] });
    const stopObserver = window.setTimeout(() => bgObserver.disconnect(), 4000);

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
          documentStyle: {
            documentFlavor: DocumentFlavor.TRADITIONAL,
          },
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
      setOfficeUniverApi(null);
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
      {mode === 'excel' ? (
        <ExcelRibbon
          univerApi={officeUniverApi}
          documentTitle={documentTitle}
          statusMessage={statusMessage}
          saving={saving}
          exporting={exporting}
          onBackHome={() => setView('home')}
          onNew={handleNew}
          onOpen={showOpen}
          onSaveToWin10={handleSaveToWin10}
          onSaveToLocal={handleSaveToLocal}
          onSwitchToWord={() => openApp('word')}
          onStatus={setStatusMessage}
        />
      ) : (
        <WordRibbon
          univerApi={officeUniverApi}
          documentTitle={documentTitle}
          statusMessage={statusMessage}
          saving={saving}
          exporting={exporting}
          onBackHome={() => setView('home')}
          onNew={handleNew}
          onOpen={showOpen}
          onSaveToWin10={handleSaveToWin10}
          onSaveToLocal={handleSaveToLocal}
          onSwitchToExcel={() => openApp('excel')}
          onStatus={setStatusMessage}
        />
      )}

      {/* Editor Canvas + Optional Word Vertical Ruler */}
      <div className={`flex-1 min-h-0 w-full flex overflow-hidden ${mode === 'word' ? 'bg-[#e6e6e6]' : 'bg-white'}`}>
        {mode === 'word' && (
          <div
            aria-hidden="true"
            className="hidden sm:flex w-[18px] bg-[#e6e6e6] flex-col items-center py-6 shrink-0 select-none"
          >
            <div className="w-[10px] flex-1 max-h-[540px] flex flex-col border-x border-[#b3b0ad] overflow-hidden">
              <div className="h-[54px] bg-[#c8c6c4] border-b border-[#b3b0ad]" />
              <div className="flex-1 bg-white flex flex-col justify-between py-2 items-center text-[7.5px] text-[#595959]">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => (
                  <span key={n} className="leading-none">{n}</span>
                ))}
              </div>
              <div className="h-[54px] bg-[#c8c6c4] border-t border-[#b3b0ad]" />
            </div>
          </div>
        )}
        <div
          ref={containerRef}
          className={`flex-1 min-w-0 min-h-0 h-full relative overflow-hidden ${mode === 'excel' ? 'bg-white excel-univer-host' : 'bg-[#e6e6e6] word-univer-host'}`}
        />
      </div>
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
