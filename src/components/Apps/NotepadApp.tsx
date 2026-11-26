import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import { useDesktopStore } from '../../store/useDesktopStore';
import { useFileSystemStore, type FsNode } from '../../store/useFileSystemStore';

interface NotepadAppProps {
  windowId: string;
}

type TopMenuKey = 'file' | 'edit' | 'format' | 'view' | 'help' | null;
type DialogMode = 'open' | 'saveAs' | 'font' | 'about' | null;

const FONT_FAMILIES = [
  { label: 'Consolas', value: 'Consolas, "Courier New", monospace' },
  { label: 'Lucida Console', value: '"Lucida Console", Monaco, monospace' },
  { label: 'Courier New', value: '"Courier New", Courier, monospace' },
  { label: 'Segoe UI', value: '"Segoe UI", sans-serif' },
];

const FONT_SIZES = [10, 11, 12, 14, 16, 18, 20, 24];

function computeCursorLineCol(text: string, selectionStart: number): { line: number; col: number } {
  const before = text.slice(0, selectionStart);
  const lines = before.split('\n');
  return {
    line: lines.length,
    col: (lines[lines.length - 1]?.length ?? 0) + 1,
  };
}

function formatWin10TimeDate(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0');
  const mm = String(date.getMinutes()).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const mo = String(date.getMonth() + 1).padStart(2, '0');
  const yyyy = date.getFullYear();
  return `${hh}:${mm} ${dd}/${mo}/${yyyy}`;
}

export function NotepadApp({ windowId }: NotepadAppProps) {
  const nodes = useFileSystemStore((state) => state.nodes);
  const createTextFile = useFileSystemStore((state) => state.createTextFile);
  const updateFileContent = useFileSystemStore((state) => state.updateFileContent);

  const notepadActiveFileId = useDesktopStore((state) => state.notepadActiveFileId);
  const notepadOpenNonce = useDesktopStore((state) => state.notepadOpenNonce);
  const setWindowTitle = useDesktopStore((state) => state.setWindowTitle);
  const closeWindow = useDesktopStore((state) => state.closeWindow);

  const [currentFileId, setCurrentFileId] = useState<string | null>(notepadActiveFileId);
  const [text, setText] = useState<string>(() => {
    if (notepadActiveFileId && nodes[notepadActiveFileId]?.kind === 'file') {
      return nodes[notepadActiveFileId].content ?? '';
    }
    return '';
  });
  const [savedText, setSavedText] = useState<string>(text);
  const [wordWrap, setWordWrap] = useState<boolean>(true);
  const [showStatusBar, setShowStatusBar] = useState<boolean>(true);
  const [zoom, setZoom] = useState<number>(100);
  const [fontFamily, setFontFamily] = useState<string>(FONT_FAMILIES[0].value);
  const [fontSizePt, setFontSizePt] = useState<number>(11);
  const [cursorPos, setCursorPos] = useState<{ line: number; col: number }>({ line: 1, col: 1 });
  const [openMenu, setOpenMenu] = useState<TopMenuKey>(null);
  const [zoomSubmenuOpen, setZoomSubmenuOpen] = useState<boolean>(false);
  const [dialogMode, setDialogMode] = useState<DialogMode>(null);
  const [pickerFolderId, setPickerFolderId] = useState<string>('desktop');
  const [pickerFileName, setPickerFileName] = useState<string>('New Text Document.txt');
  const [selectedPickerFileId, setSelectedPickerFileId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const menuBarRef = useRef<HTMLDivElement | null>(null);

  const currentFile = currentFileId ? nodes[currentFileId] : undefined;
  const isDirty = text !== savedText;

  // Sync whenever a file is opened externally (e.g. double-clicking a .txt on Desktop/Explorer)
  useEffect(() => {
    if (notepadOpenNonce === 0) return;
    if (notepadActiveFileId && nodes[notepadActiveFileId]?.kind === 'file') {
      const fileContent = nodes[notepadActiveFileId].content ?? '';
      setCurrentFileId(notepadActiveFileId);
      setText(fileContent);
      setSavedText(fileContent);
      setCursorPos({ line: 1, col: 1 });
      window.setTimeout(() => textareaRef.current?.focus(), 0);
    } else if (notepadActiveFileId === null) {
      setCurrentFileId(null);
      setText('');
      setSavedText('');
      setCursorPos({ line: 1, col: 1 });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [notepadActiveFileId, notepadOpenNonce]);

  // Keep window title synced like Windows 10 Notepad
  useEffect(() => {
    const fileLabel = currentFile?.name ?? 'Untitled';
    setWindowTitle(windowId, `${isDirty ? '*' : ''}${fileLabel} - Notepad`);
  }, [windowId, currentFile?.name, isDirty, setWindowTitle]);

  useEffect(() => {
    if (!openMenu) {
      setZoomSubmenuOpen(false);
      return;
    }
    const handleOutside = (e: PointerEvent) => {
      if (menuBarRef.current && !menuBarRef.current.contains(e.target as Node)) {
        setOpenMenu(null);
      }
    };
    window.addEventListener('pointerdown', handleOutside);
    return () => window.removeEventListener('pointerdown', handleOutside);
  }, [openMenu]);

  const updateCursorFromElement = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    setCursorPos(computeCursorLineCol(el.value, el.selectionStart ?? 0));
  }, []);

  const handleNew = useCallback(() => {
    setCurrentFileId(null);
    setText('');
    setSavedText('');
    setCursorPos({ line: 1, col: 1 });
    setOpenMenu(null);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  }, []);

  const handleOpenDialog = useCallback(() => {
    setPickerFolderId(currentFile?.parentId && nodes[currentFile.parentId] ? currentFile.parentId : 'desktop');
    setSelectedPickerFileId(null);
    setDialogMode('open');
    setOpenMenu(null);
  }, [currentFile?.parentId, nodes]);

  const handleSaveAsDialog = useCallback(() => {
    setPickerFolderId(currentFile?.parentId && nodes[currentFile.parentId] ? currentFile.parentId : 'desktop');
    setPickerFileName(currentFile?.name ?? 'New Text Document.txt');
    setDialogMode('saveAs');
    setOpenMenu(null);
  }, [currentFile, nodes]);

  const handleSave = useCallback(() => {
    setOpenMenu(null);
    if (currentFileId && nodes[currentFileId]?.kind === 'file') {
      updateFileContent(currentFileId, text);
      setSavedText(text);
      return;
    }
    handleSaveAsDialog();
  }, [currentFileId, nodes, text, updateFileContent, handleSaveAsDialog]);

  const insertAtCursor = useCallback(
    (snippet: string) => {
      const el = textareaRef.current;
      if (!el) {
        setText((prev) => prev + snippet);
        return;
      }
      const start = el.selectionStart ?? text.length;
      const end = el.selectionEnd ?? text.length;
      const next = text.slice(0, start) + snippet + text.slice(end);
      setText(next);
      const nextPos = start + snippet.length;
      window.setTimeout(() => {
        el.focus();
        el.setSelectionRange(nextPos, nextPos);
        setCursorPos(computeCursorLineCol(next, nextPos));
      }, 0);
    },
    [text],
  );

  const handleInsertTimeDate = useCallback(() => {
    insertAtCursor(formatWin10TimeDate(new Date()));
    setOpenMenu(null);
  }, [insertAtCursor]);

  const handleSelectAll = useCallback(() => {
    setOpenMenu(null);
    const el = textareaRef.current;
    if (!el) return;
    el.focus();
    el.select();
    updateCursorFromElement();
  }, [updateCursorFromElement]);

  const handleEditorKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      if (e.shiftKey) handleSaveAsDialog();
      else handleSave();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'o') {
      e.preventDefault();
      handleOpenDialog();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'n') {
      e.preventDefault();
      handleNew();
      return;
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === '=' || e.key === '+')) {
      e.preventDefault();
      setZoom((z) => Math.min(500, z + 10));
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '-') {
      e.preventDefault();
      setZoom((z) => Math.max(10, z - 10));
      return;
    }
    if ((e.ctrlKey || e.metaKey) && e.key === '0') {
      e.preventDefault();
      setZoom(100);
      return;
    }
    if (e.key === 'F5') {
      e.preventDefault();
      handleInsertTimeDate();
    }
  };

  const writableFolders = useMemo(
    () =>
      Object.values(nodes)
        .filter((n) => n.kind === 'folder' || n.kind === 'drive')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [nodes],
  );

  const pickerFiles = useMemo(
    () =>
      Object.values(nodes)
        .filter((n) => n.parentId === pickerFolderId && n.kind === 'file')
        .sort((a, b) => a.name.localeCompare(b.name)),
    [nodes, pickerFolderId],
  );

  const confirmOpenFile = (file: FsNode) => {
    setCurrentFileId(file.id);
    const content = file.content ?? '';
    setText(content);
    setSavedText(content);
    setDialogMode(null);
    setCursorPos({ line: 1, col: 1 });
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const confirmSaveAs = () => {
    const trimmed = pickerFileName.trim() || 'New Text Document.txt';
    const finalName = trimmed.toLowerCase().endsWith('.txt') ? trimmed : `${trimmed}.txt`;

    // Overwrite if same name exists in target folder
    const existing = Object.values(nodes).find(
      (n) =>
        n.parentId === pickerFolderId &&
        n.kind === 'file' &&
        n.name.toLowerCase() === finalName.toLowerCase(),
    );
    if (existing) {
      updateFileContent(existing.id, text);
      setCurrentFileId(existing.id);
      setSavedText(text);
    } else {
      const createdId = createTextFile(pickerFolderId, finalName, text);
      if (createdId) {
        setCurrentFileId(createdId);
        setSavedText(text);
      }
    }
    setDialogMode(null);
    window.setTimeout(() => textareaRef.current?.focus(), 0);
  };

  const menuBtnClass = (active: boolean) =>
    [
      'px-2 py-0.5 text-[12px] text-[#1f1f1f] cursor-default transition-colors',
      active ? 'bg-[#e5f3ff] outline outline-1 outline-[#99d1ff]' : 'hover:bg-[#e5f3ff]',
    ].join(' ');

  const dropRowClass =
    'w-full flex items-center justify-between px-4 py-1 text-[12px] text-[#1f1f1f] hover:bg-[#90c8f6]/45 cursor-default text-left';

  const computedPx = Math.round(((fontSizePt * 96) / 72) * (zoom / 100));

  return (
    <div className="relative flex flex-col flex-1 min-h-0 bg-white text-black select-none">
      {/* Classic Windows 10 Menu Bar */}
      <div
        ref={menuBarRef}
        className="relative flex items-center h-[22px] px-1 bg-white border-b border-[#f0f0f0] shrink-0 z-20"
      >
        {/* File */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'file' ? null : 'file'))}
            onMouseEnter={() => {
              if (openMenu) setOpenMenu('file');
            }}
            className={menuBtnClass(openMenu === 'file')}
          >
            File
          </button>
          {openMenu === 'file' && (
            <div className="absolute left-0 top-full w-[205px] bg-[#f2f2f2] border border-[#cccccc] shadow-[2px_3px_8px_rgba(0,0,0,0.2)] py-1 z-30">
              <button type="button" onClick={handleNew} className={dropRowClass}>
                <span>New</span>
                <span className="text-[11px] text-[#666666]">Ctrl+N</span>
              </button>
              <button type="button" onClick={handleOpenDialog} className={dropRowClass}>
                <span>Open...</span>
                <span className="text-[11px] text-[#666666]">Ctrl+O</span>
              </button>
              <button type="button" onClick={handleSave} className={dropRowClass}>
                <span>Save</span>
                <span className="text-[11px] text-[#666666]">Ctrl+S</span>
              </button>
              <button type="button" onClick={handleSaveAsDialog} className={dropRowClass}>
                <span>Save As...</span>
                <span className="text-[11px] text-[#666666]">Ctrl+Shift+S</span>
              </button>
              <div className="h-px bg-[#d7d7d7] my-1 mx-2" />
              <button
                type="button"
                onClick={() => closeWindow(windowId)}
                className={dropRowClass}
              >
                <span>Exit</span>
              </button>
            </div>
          )}
        </div>

        {/* Edit */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'edit' ? null : 'edit'))}
            onMouseEnter={() => {
              if (openMenu) setOpenMenu('edit');
            }}
            className={menuBtnClass(openMenu === 'edit')}
          >
            Edit
          </button>
          {openMenu === 'edit' && (
            <div className="absolute left-0 top-full w-[195px] bg-[#f2f2f2] border border-[#cccccc] shadow-[2px_3px_8px_rgba(0,0,0,0.2)] py-1 z-30">
              <button
                type="button"
                onClick={() => {
                  textareaRef.current?.focus();
                  document.execCommand('undo');
                  setOpenMenu(null);
                }}
                className={dropRowClass}
              >
                <span>Undo</span>
                <span className="text-[11px] text-[#666666]">Ctrl+Z</span>
              </button>
              <div className="h-px bg-[#d7d7d7] my-1 mx-2" />
              <button
                type="button"
                onClick={() => {
                  const el = textareaRef.current;
                  if (el) {
                    const selected = el.value.slice(el.selectionStart, el.selectionEnd);
                    if (selected) {
                      void navigator.clipboard?.writeText(selected);
                      const start = el.selectionStart;
                      const next = el.value.slice(0, start) + el.value.slice(el.selectionEnd);
                      setText(next);
                    }
                  }
                  setOpenMenu(null);
                }}
                className={dropRowClass}
              >
                <span>Cut</span>
                <span className="text-[11px] text-[#666666]">Ctrl+X</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = textareaRef.current;
                  if (el) {
                    const selected = el.value.slice(el.selectionStart, el.selectionEnd);
                    if (selected) void navigator.clipboard?.writeText(selected);
                  }
                  setOpenMenu(null);
                }}
                className={dropRowClass}
              >
                <span>Copy</span>
                <span className="text-[11px] text-[#666666]">Ctrl+C</span>
              </button>
              <button
                type="button"
                onClick={async () => {
                  try {
                    const clip = await navigator.clipboard?.readText();
                    if (clip) insertAtCursor(clip);
                  } catch {
                    // Clipboard read blocked
                  }
                  setOpenMenu(null);
                }}
                className={dropRowClass}
              >
                <span>Paste</span>
                <span className="text-[11px] text-[#666666]">Ctrl+V</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const el = textareaRef.current;
                  if (el && el.selectionEnd > el.selectionStart) {
                    setText(el.value.slice(0, el.selectionStart) + el.value.slice(el.selectionEnd));
                  }
                  setOpenMenu(null);
                }}
                className={dropRowClass}
              >
                <span>Delete</span>
                <span className="text-[11px] text-[#666666]">Del</span>
              </button>
              <div className="h-px bg-[#d7d7d7] my-1 mx-2" />
              <button type="button" onClick={handleSelectAll} className={dropRowClass}>
                <span>Select All</span>
                <span className="text-[11px] text-[#666666]">Ctrl+A</span>
              </button>
              <button type="button" onClick={handleInsertTimeDate} className={dropRowClass}>
                <span>Time/Date</span>
                <span className="text-[11px] text-[#666666]">F5</span>
              </button>
            </div>
          )}
        </div>

        {/* Format */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'format' ? null : 'format'))}
            onMouseEnter={() => {
              if (openMenu) setOpenMenu('format');
            }}
            className={menuBtnClass(openMenu === 'format')}
          >
            Format
          </button>
          {openMenu === 'format' && (
            <div className="absolute left-0 top-full w-[170px] bg-[#f2f2f2] border border-[#cccccc] shadow-[2px_3px_8px_rgba(0,0,0,0.2)] py-1 z-30">
              <button
                type="button"
                onClick={() => {
                  setWordWrap((v) => !v);
                  setOpenMenu(null);
                }}
                className={dropRowClass}
              >
                <span className="flex items-center gap-2">
                  <span className="w-3 inline-block">{wordWrap ? '✓' : ''}</span>
                  <span>Word Wrap</span>
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setDialogMode('font');
                  setOpenMenu(null);
                }}
                className={dropRowClass}
              >
                <span className="flex items-center gap-2">
                  <span className="w-3 inline-block" />
                  <span>Font...</span>
                </span>
              </button>
            </div>
          )}
        </div>

        {/* View */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'view' ? null : 'view'))}
            onMouseEnter={() => {
              if (openMenu) setOpenMenu('view');
            }}
            className={menuBtnClass(openMenu === 'view')}
          >
            View
          </button>
          {openMenu === 'view' && (
            <div className="absolute left-0 top-full w-[170px] bg-[#f2f2f2] border border-[#cccccc] shadow-[2px_3px_8px_rgba(0,0,0,0.2)] py-1 z-30">
              <div
                onMouseEnter={() => setZoomSubmenuOpen(true)}
                onMouseLeave={() => setZoomSubmenuOpen(false)}
                className={`${dropRowClass} relative`}
              >
                <span className="flex items-center gap-2">
                  <span className="w-3 inline-block" />
                  <span>Zoom</span>
                </span>
                <span className="text-[10px]">▸</span>

                {zoomSubmenuOpen && (
                  <div className="absolute left-full top-[-4px] w-[205px] bg-[#f2f2f2] border border-[#cccccc] shadow-[2px_3px_8px_rgba(0,0,0,0.2)] py-1 z-40">
                    <button
                      type="button"
                      onClick={() => {
                        setZoom((z) => Math.min(500, z + 10));
                        setOpenMenu(null);
                      }}
                      className={dropRowClass}
                    >
                      <span>Zoom In</span>
                      <span className="text-[11px] text-[#666666]">Ctrl+Plus</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setZoom((z) => Math.max(10, z - 10));
                        setOpenMenu(null);
                      }}
                      className={dropRowClass}
                    >
                      <span>Zoom Out</span>
                      <span className="text-[11px] text-[#666666]">Ctrl+Minus</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setZoom(100);
                        setOpenMenu(null);
                      }}
                      className={dropRowClass}
                    >
                      <span>Restore Default Zoom</span>
                      <span className="text-[11px] text-[#666666]">Ctrl+0</span>
                    </button>
                  </div>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowStatusBar((v) => !v);
                  setOpenMenu(null);
                }}
                className={dropRowClass}
              >
                <span className="flex items-center gap-2">
                  <span className="w-3 inline-block">{showStatusBar ? '✓' : ''}</span>
                  <span>Status Bar</span>
                </span>
              </button>
            </div>
          )}
        </div>

        {/* Help */}
        <div className="relative">
          <button
            type="button"
            onClick={() => setOpenMenu((m) => (m === 'help' ? null : 'help'))}
            onMouseEnter={() => {
              if (openMenu) setOpenMenu('help');
            }}
            className={menuBtnClass(openMenu === 'help')}
          >
            Help
          </button>
          {openMenu === 'help' && (
            <div className="absolute left-0 top-full w-[160px] bg-[#f2f2f2] border border-[#cccccc] shadow-[2px_3px_8px_rgba(0,0,0,0.2)] py-1 z-30">
              <button
                type="button"
                onClick={() => {
                  setDialogMode('about');
                  setOpenMenu(null);
                }}
                className={dropRowClass}
              >
                <span>About Notepad</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Editor Area */}
      <textarea
        ref={textareaRef}
        value={text}
        wrap={wordWrap ? 'soft' : 'off'}
        spellCheck={false}
        onChange={(e) => {
          setText(e.target.value);
          setCursorPos(computeCursorLineCol(e.target.value, e.target.selectionStart ?? 0));
        }}
        onKeyDown={handleEditorKeyDown}
        onKeyUp={updateCursorFromElement}
        onClick={updateCursorFromElement}
        aria-label="Notepad editor"
        style={{
          fontFamily,
          fontSize: `${computedPx}px`,
          lineHeight: 1.35,
        }}
        className="flex-1 w-full resize-none border-0 outline-none bg-white text-black px-1.5 py-1 select-text overflow-auto"
      />

      {/* Windows 10 Status Bar */}
      {showStatusBar && (
        <footer className="flex items-center justify-end h-[22px] bg-[#f0f0f0] border-t border-[#d9d9d9] text-[11.5px] text-[#333333] shrink-0">
          <div className="w-[130px] px-2.5 border-l border-[#d4d4d4] tabular-nums truncate">
            Ln {cursorPos.line}, Col {cursorPos.col}
          </div>
          <div className="w-[54px] px-2.5 border-l border-[#d4d4d4] tabular-nums">{zoom}%</div>
          <div className="w-[115px] px-2.5 border-l border-[#d4d4d4] truncate">
            Windows (CRLF)
          </div>
          <div className="w-[75px] px-2.5 border-l border-[#d4d4d4] truncate">UTF-8</div>
        </footer>
      )}

      {/* Open / Save As / Font / About Dialogs */}
      {dialogMode && (
        <div
          onClick={() => setDialogMode(null)}
          className="absolute inset-0 bg-black/35 flex items-center justify-center z-40 p-4"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[440px] bg-[#f0f0f0] border border-[#999999] shadow-2xl text-[12px] text-[#1f1f1f]"
          >
            <div className="flex items-center justify-between px-3 py-2 bg-white border-b border-[#dcdcdc]">
              <span className="font-medium">
                {dialogMode === 'open'
                  ? 'Open'
                  : dialogMode === 'saveAs'
                    ? 'Save As'
                    : dialogMode === 'font'
                      ? 'Font'
                      : 'About Notepad'}
              </span>
              <button
                type="button"
                onClick={() => setDialogMode(null)}
                className="w-6 h-5 flex items-center justify-center hover:bg-[#e81123] hover:text-white cursor-default"
              >
                ×
              </button>
            </div>

            {(dialogMode === 'open' || dialogMode === 'saveAs') && (
              <div className="p-3 space-y-3">
                <div className="flex items-center gap-2">
                  <span className="w-16 text-[#555555]">Folder:</span>
                  <select
                    value={pickerFolderId}
                    onChange={(e) => {
                      setPickerFolderId(e.target.value);
                      setSelectedPickerFileId(null);
                    }}
                    className="flex-1 h-[26px] px-2 bg-white border border-[#adadad] outline-none"
                  >
                    {writableFolders.map((folder) => (
                      <option key={folder.id} value={folder.id}>
                        {folder.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="h-[150px] bg-white border border-[#adadad] overflow-y-auto p-1">
                  {pickerFiles.length === 0 ? (
                    <div className="h-full flex items-center justify-center text-[#777777]">
                      No text documents in this folder
                    </div>
                  ) : (
                    pickerFiles.map((file) => (
                      <button
                        key={file.id}
                        type="button"
                        onClick={() => {
                          setSelectedPickerFileId(file.id);
                          setPickerFileName(file.name);
                        }}
                        onDoubleClick={() => {
                          if (dialogMode === 'open') confirmOpenFile(file);
                          else {
                            setPickerFileName(file.name);
                            confirmSaveAs();
                          }
                        }}
                        className={[
                          'w-full flex items-center gap-2 px-2 py-1 text-left cursor-default',
                          selectedPickerFileId === file.id
                            ? 'bg-[#cce8ff]'
                            : 'hover:bg-[#e5f3ff]',
                        ].join(' ')}
                      >
                        <img src={file.icon} alt="" className="w-4 h-4 object-contain" />
                        <span className="truncate">{file.name}</span>
                      </button>
                    ))
                  )}
                </div>

                {dialogMode === 'saveAs' && (
                  <div className="flex items-center gap-2">
                    <span className="w-16 text-[#555555]">File name:</span>
                    <input
                      type="text"
                      value={pickerFileName}
                      onChange={(e) => setPickerFileName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') confirmSaveAs();
                      }}
                      className="flex-1 h-[26px] px-2 bg-white border border-[#0078d7] outline-none"
                    />
                  </div>
                )}

                <div className="flex justify-end gap-2 pt-1">
                  {dialogMode === 'open' ? (
                    <button
                      type="button"
                      disabled={!selectedPickerFileId}
                      onClick={() => {
                        const file = pickerFiles.find((f) => f.id === selectedPickerFileId);
                        if (file) confirmOpenFile(file);
                      }}
                      className="px-4 py-1 bg-[#e1e1e1] enabled:hover:bg-[#e5f1fb] border border-[#adadad] disabled:opacity-50 cursor-default"
                    >
                      Open
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={confirmSaveAs}
                      className="px-4 py-1 bg-[#e1e1e1] hover:bg-[#e5f1fb] border border-[#adadad] cursor-default"
                    >
                      Save
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setDialogMode(null)}
                    className="px-4 py-1 bg-[#e1e1e1] hover:bg-[#e5f1fb] border border-[#adadad] cursor-default"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {dialogMode === 'font' && (
              <div className="p-4 space-y-3">
                <div>
                  <label className="block mb-1 text-[#555555]">Font:</label>
                  <select
                    value={fontFamily}
                    onChange={(e) => setFontFamily(e.target.value)}
                    className="w-full h-[28px] px-2 bg-white border border-[#adadad] outline-none"
                  >
                    {FONT_FAMILIES.map((f) => (
                      <option key={f.label} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block mb-1 text-[#555555]">Size:</label>
                  <select
                    value={fontSizePt}
                    onChange={(e) => setFontSizePt(Number(e.target.value))}
                    className="w-full h-[28px] px-2 bg-white border border-[#adadad] outline-none"
                  >
                    {FONT_SIZES.map((sz) => (
                      <option key={sz} value={sz}>
                        {sz} pt
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setDialogMode(null)}
                    className="px-4 py-1 bg-[#e1e1e1] hover:bg-[#e5f1fb] border border-[#adadad] cursor-default"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}

            {dialogMode === 'about' && (
              <div className="p-4 space-y-3">
                <div className="flex items-center gap-3">
                  <img src="/assets/icons/notepad.png" alt="" className="w-10 h-10 object-contain" />
                  <div>
                    <div className="text-[14px] font-semibold">Windows 10 Notepad</div>
                    <div className="text-[#555555]">React + IndexedDB Text Editor</div>
                  </div>
                </div>
                <p className="text-[#444444]">
                  Supports creating, editing, and saving `.txt` documents directly into your browser IndexedDB virtual file system.
                </p>
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={() => setDialogMode(null)}
                    className="px-4 py-1 bg-[#e1e1e1] hover:bg-[#e5f1fb] border border-[#adadad] cursor-default"
                  >
                    OK
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
