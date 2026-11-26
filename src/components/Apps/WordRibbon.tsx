import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import type { createUniver } from '@univerjs/presets';
import {
  AlignCenterCommand,
  AlignJustifyCommand,
  AlignLeftCommand,
  AlignRightCommand,
  BulletListCommand,
  ChangeListNestingLevelCommand,
  ChangeListNestingLevelType,
  CheckListCommand,
  CreateDocTableCommand,
  DocCopyCommand,
  DocCutCommand,
  DocPasteCommand,
  DocSelectAllCommand,
  HorizontalLineCommand,
  OrderListCommand,
  ResetInlineFormatTextBackgroundColorCommand,
  ResetInlineFormatTextColorCommand,
  SetDocZoomRatioCommand,
  SetInlineFormatBoldCommand,
  SetInlineFormatCommand,
  SetInlineFormatFontFamilyCommand,
  SetInlineFormatFontSizeCommand,
  SetInlineFormatItalicCommand,
  SetInlineFormatStrikethroughCommand,
  SetInlineFormatSubscriptCommand,
  SetInlineFormatSuperscriptCommand,
  SetInlineFormatTextBackgroundColorCommand,
  SetInlineFormatTextColorCommand,
  SetInlineFormatTextFillCommand,
  SetInlineFormatUnderlineCommand,
  SetParagraphNamedStyleCommand,
} from '@univerjs/preset-docs-core';

type UniverAPI = ReturnType<typeof createUniver>['univerAPI'];

export type WordRibbonTab =
  | 'File'
  | 'Home'
  | 'Insert'
  | 'Design'
  | 'Layout'
  | 'References'
  | 'Mailings'
  | 'Review'
  | 'View'
  | 'Help';

interface WordRibbonProps {
  univerApi: UniverAPI | null;
  documentTitle: string;
  statusMessage: string;
  saving: boolean;
  exporting: boolean;
  onBackHome: () => void;
  onNew: () => void;
  onOpen: () => void;
  onSaveToWin10: () => void;
  onSaveToLocal: () => void;
  onSwitchToExcel: () => void;
  onStatus: (msg: string) => void;
}

const FONT_FAMILIES = [
  'Calibri',
  'Calibri (Body)',
  'Arial',
  'Segoe UI',
  'Times New Roman',
  'Cambria',
  'Georgia',
  'Consolas',
  'Courier New',
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72];

const PALETTE_COLORS = [
  '#000000', '#ffffff', '#eeece1', '#1f497d', '#4f81bd', '#c0504d', '#9bbb59', '#8064a2', '#4bacc6', '#f79646',
  '#7f7f7f', '#f2f2f2', '#ddd9c3', '#c6d9f0', '#dbe5f1', '#f2dcdb', '#ebf1dd', '#e5e0ec', '#dbeef3', '#fdeada',
  '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#0000ff', '#ff0000', '#000080', '#008080', '#008000', '#800080',
];

const HIGHLIGHT_COLORS = [
  '#ffff00', '#00ff00', '#00ffff', '#ff00ff', '#0000ff',
  '#ff0000', '#000080', '#008080', '#008000', '#800080',
  '#800000', '#808000', '#808080', '#c0c0c0', '#000000',
];

interface WordStylePreset {
  id: string;
  label: string;
  previewText: string;
  namedStyle?: number;
  fontFamily?: string;
  fontSize?: number;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  lineSpacing?: number;
  spaceBelow?: number;
  previewStyle: string;
}

const WORD_STYLES_PAGE_1: WordStylePreset[] = [
  { id: 'normal', label: 'Normal', previewText: 'AaBbCcDc', namedStyle: 1, fontFamily: 'Calibri', fontSize: 11, color: '#000000', bold: false, italic: false, lineSpacing: 1.15, spaceBelow: 8, previewStyle: 'text-[11.5px] text-[#222]' },
  { id: 'no-spacing', label: 'No Spacing', previewText: 'AaBbCcDc', namedStyle: 1, fontFamily: 'Calibri', fontSize: 11, color: '#000000', bold: false, italic: false, lineSpacing: 1.0, spaceBelow: 0, previewStyle: 'text-[11.5px] text-[#222]' },
  { id: 'heading-1', label: 'Heading 1', previewText: 'AaBbCc', namedStyle: 4, fontSize: 16, color: '#2f5496', bold: false, previewStyle: 'text-[14px] text-[#2f5496]' },
  { id: 'heading-2', label: 'Heading 2', previewText: 'AaBbCcD', namedStyle: 5, fontSize: 13, color: '#2f5496', bold: false, previewStyle: 'text-[12.5px] text-[#2f5496]' },
  { id: 'title', label: 'Title', previewText: 'AaBb', namedStyle: 2, fontSize: 28, color: '#000000', previewStyle: 'text-[18px] tracking-tight text-[#111]' },
  { id: 'subtitle', label: 'Subtitle', previewText: 'AaBbCcD', namedStyle: 3, fontSize: 11, color: '#595959', previewStyle: 'text-[11px] text-[#595959]' },
  { id: 'subtle-em', label: 'Subtle Em...', previewText: 'AaBbCcDc', fontSize: 11, color: '#595959', italic: true, previewStyle: 'text-[11px] italic text-[#595959]' },
  { id: 'emphasis', label: 'Emphasis', previewText: 'AaBbCcDc', fontSize: 11, color: '#000000', italic: true, previewStyle: 'text-[11px] italic text-[#222]' },
];

const WORD_STYLES_PAGE_2: WordStylePreset[] = [
  { id: 'intense-em', label: 'Intense E...', previewText: 'AaBbCcDc', fontSize: 11, color: '#4472c4', italic: true, previewStyle: 'text-[11px] italic text-[#4472c4]' },
  { id: 'strong', label: 'Strong', previewText: 'AaBbCcDc', fontSize: 11, color: '#000000', bold: true, previewStyle: 'text-[11.5px] font-bold text-[#111]' },
  { id: 'quote', label: 'Quote', previewText: 'AaBbCcD', fontSize: 11, color: '#404040', italic: true, previewStyle: 'text-[11px] italic text-[#404040]' },
  { id: 'intense-q', label: 'Intense Q...', previewText: 'AaBbCc', fontSize: 11, color: '#4472c4', italic: true, previewStyle: 'text-[11px] italic text-[#4472c4] border-y border-[#8ea9db] px-1' },
  { id: 'subtle-ref', label: 'Subtle Ref...', previewText: 'AABBCCDC', fontSize: 10, color: '#5a5a5a', previewStyle: 'text-[9.5px] tracking-wider text-[#5a5a5a]' },
  { id: 'intense-ref', label: 'Intense Re...', previewText: 'AABBCCDC', fontSize: 10, color: '#2f5496', bold: true, previewStyle: 'text-[9.5px] font-semibold tracking-wider text-[#2f5496]' },
  { id: 'book-title', label: 'Book Title', previewText: 'AaBbCcDc', fontSize: 11, color: '#000000', bold: true, italic: true, previewStyle: 'text-[11px] font-bold italic text-[#222]' },
  { id: 'list-para', label: 'List Para...', previewText: 'AaBbCcDc', fontSize: 11, color: '#000000', previewStyle: 'text-[11px] text-[#222]' },
];

type DropdownKey =
  | 'file'
  | 'qat'
  | 'paste'
  | 'changeCase'
  | 'textEffects'
  | 'highlightColor'
  | 'fontColor'
  | 'bullets'
  | 'numbering'
  | 'multilevel'
  | 'lineSpacing'
  | 'shading'
  | 'borders'
  | 'stylesMore'
  | 'findMenu'
  | 'selectMenu'
  | 'tableMenu'
  | 'marginsMenu'
  | null;

type AlignMode = 'left' | 'center' | 'right' | 'justify';

interface CopiedInlineFormat {
  ff?: string | null;
  fs?: number | null;
  bl?: number;
  it?: number;
  fg?: string | null;
  bg?: string | null;
}

function RibbonGroup({ label, children, hasDialogLauncher }: { label: string; children: ReactNode; hasDialogLauncher?: boolean }) {
  return (
    <div className="relative flex flex-col justify-between px-2 pt-1 pb-0.5 border-r border-[#d9d9d9] shrink-0 h-[84px]">
      <div className="flex items-start gap-1 flex-1">{children}</div>
      <div className="flex items-center justify-center relative text-[10px] text-[#605e5c] leading-none pt-0.5 select-none">
        <span>{label}</span>
        {hasDialogLauncher && (
          <span className="absolute right-0 bottom-0 text-[8px] text-[#7a7a7a] leading-none">↘</span>
        )}
      </div>
    </div>
  );
}

const iconBtnClass =
  'h-[22px] min-w-[22px] px-1 flex items-center justify-center rounded-[2px] text-[#262626] hover:bg-[#e1dfdd] active:bg-[#d2d0ce] cursor-default transition-colors';
const activeIconBtnClass =
  'h-[22px] min-w-[22px] px-1 flex items-center justify-center rounded-[2px] bg-[#c7d7ee] text-[#111] border border-[#9db9e2] cursor-default';
const menuPanelClass =
  'absolute left-0 top-full mt-0.5 z-50 bg-white border border-[#d2d0ce] shadow-lg py-1 min-w-[175px] text-[12px] text-[#262626]';
const menuRowClass =
  'w-full px-3 py-1.5 text-left hover:bg-[#edebe9] flex items-center justify-between gap-3 cursor-default whitespace-nowrap';

export function WordRibbon({
  univerApi,
  documentTitle,
  statusMessage,
  saving,
  exporting,
  onBackHome,
  onNew,
  onOpen,
  onSaveToWin10,
  onSaveToLocal,
  onSwitchToExcel,
  onStatus,
}: WordRibbonProps) {
  const [activeTab, setActiveTab] = useState<WordRibbonTab>('Home');
  const [ribbonCollapsed, setRibbonCollapsed] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
  const [autoSave, setAutoSave] = useState(false);
  const [searchText, setSearchText] = useState('');

  const [fontFamily, setFontFamily] = useState('Calibri');
  const [fontSize, setFontSize] = useState(11);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isStrike, setIsStrike] = useState(false);
  const [subSuper, setSubSuper] = useState<'none' | 'sub' | 'sup'>('none');
  const [align, setAlign] = useState<AlignMode>('left');
  const [highlightColor, setHighlightColor] = useState('#ffff00');
  const [fontColor, setFontColor] = useState('#ff0000');
  const [shadingColor, setShadingColor] = useState('#d9e1f2');
  const [showFormattingMarks, setShowFormattingMarks] = useState(false);
  const [activeStyleId, setActiveStyleId] = useState('normal');
  const [stylesPage, setStylesPage] = useState<0 | 1>(0);
  const [copiedFormat, setCopiedFormat] = useState<CopiedInlineFormat | null>(null);

  const [showRuler, setShowRuler] = useState(true);
  const [leftMarginPct, setLeftMarginPct] = useState(12);
  const [rightMarginPct, setRightMarginPct] = useState(12);
  const [zoomPct, setZoomPct] = useState(100);

  const [findModalOpen, setFindModalOpen] = useState(false);
  const [replaceMode, setReplaceMode] = useState(false);
  const [findQuery, setFindQuery] = useState('');
  const [replaceQuery, setReplaceQuery] = useState('');
  const [lastMatchOffset, setLastMatchOffset] = useState(0);

  const ribbonRootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!openDropdown) return;
    const onDown = (e: PointerEvent) => {
      if (ribbonRootRef.current && !ribbonRootRef.current.contains(e.target as Node)) {
        setOpenDropdown(null);
      }
    };
    window.addEventListener('pointerdown', onDown);
    return () => window.removeEventListener('pointerdown', onDown);
  }, [openDropdown]);

  const toggleDrop = (key: DropdownKey) => {
    setOpenDropdown((prev) => (prev === key ? null : key));
  };

  const execCmd = async (commandId: string, params?: Record<string, unknown>, feedback?: string) => {
    if (!univerApi) {
      onStatus('Document editor is still loading');
      return false;
    }
    try {
      const ok = await univerApi.executeCommand(commandId, params);
      if (feedback) onStatus(feedback);
      return ok;
    } catch {
      if (feedback) onStatus(feedback);
      return false;
    }
  };

  const getBodyPlainText = (): string => {
    const doc = univerApi?.getActiveDocument();
    const raw = doc?.getBody()?.dataStream ?? '';
    return raw.replace(/[\r\n\x00-\x1f]/g, (ch) => (ch === '\r' || ch === '\n' ? '\n' : ''));
  };

  const applyFontFamily = (ff: string) => {
    const normalized = ff === 'Calibri (Body)' ? 'Calibri' : ff;
    setFontFamily(ff);
    void execCmd(SetInlineFormatFontFamilyCommand.id, { value: normalized });
  };

  const applyFontSize = (pt: number) => {
    const clamped = Math.max(8, Math.min(72, pt));
    setFontSize(clamped);
    void execCmd(SetInlineFormatFontSizeCommand.id, { value: clamped });
  };

  const stepFontSize = (dir: 1 | -1) => {
    const idx = FONT_SIZES.findIndex((s) => s >= fontSize);
    const nextIdx =
      dir > 0
        ? Math.min(FONT_SIZES.length - 1, idx === -1 ? FONT_SIZES.length - 1 : idx + 1)
        : Math.max(0, (idx === -1 ? FONT_SIZES.length : idx) - 1);
    applyFontSize(FONT_SIZES[nextIdx]);
  };

  const clearFormatting = () => {
    setIsBold(false);
    setIsItalic(false);
    setIsUnderline(false);
    setIsStrike(false);
    setSubSuper('none');
    setFontFamily('Calibri');
    setFontSize(11);
    void execCmd(
      SetInlineFormatCommand.id,
      {
        preCommandId: SetInlineFormatTextFillCommand.id,
        value: {
          ff: null,
          fs: null,
          bl: 0,
          it: 0,
          ul: { s: 0 },
          st: { s: 0 },
          va: 1,
          cl: { rgb: null },
          bg: { rgb: null },
        },
      },
      'Cleared formatting',
    );
  };

  const applyWordStyle = async (preset: WordStylePreset) => {
    setActiveStyleId(preset.id);
    if (preset.namedStyle !== undefined) {
      await execCmd(SetParagraphNamedStyleCommand.id, { value: preset.namedStyle });
    }
    if (preset.fontFamily) {
      setFontFamily(preset.fontFamily);
      await execCmd(SetInlineFormatFontFamilyCommand.id, { value: preset.fontFamily });
    }
    if (preset.fontSize) {
      setFontSize(preset.fontSize);
      await execCmd(SetInlineFormatFontSizeCommand.id, { value: preset.fontSize });
    }
    if (preset.color) {
      await execCmd(SetInlineFormatTextColorCommand.id, { value: preset.color });
    }
    if (preset.bold !== undefined) {
      setIsBold(preset.bold);
      await execCmd(SetInlineFormatCommand.id, {
        preCommandId: SetInlineFormatTextFillCommand.id,
        value: { bl: preset.bold ? 1 : 0 },
      });
    }
    if (preset.italic !== undefined) {
      setIsItalic(preset.italic);
      await execCmd(SetInlineFormatCommand.id, {
        preCommandId: SetInlineFormatTextFillCommand.id,
        value: { it: preset.italic ? 1 : 0 },
      });
    }
    if (preset.lineSpacing !== undefined || preset.spaceBelow !== undefined) {
      await execCmd('doc-paragraph-setting.command', {
        paragraph: {
          ...(preset.lineSpacing !== undefined ? { lineSpacing: preset.lineSpacing } : {}),
          ...(preset.spaceBelow !== undefined ? { spaceBelow: preset.spaceBelow } : {}),
        },
      });
    }
    onStatus(`Style: ${preset.label.replace('...', '')}`);
  };

  const handleFormatPainter = () => {
    const doc = univerApi?.getActiveDocument();
    if (!doc) return;
    if (copiedFormat) {
      void execCmd(
        SetInlineFormatCommand.id,
        {
          preCommandId: SetInlineFormatTextFillCommand.id,
          value: {
            ff: copiedFormat.ff ?? undefined,
            fs: copiedFormat.fs ?? undefined,
            bl: copiedFormat.bl ?? 0,
            it: copiedFormat.it ?? 0,
            cl: copiedFormat.fg ? { rgb: copiedFormat.fg } : undefined,
            bg: copiedFormat.bg ? { rgb: copiedFormat.bg } : undefined,
          },
        },
        'Applied copied formatting',
      );
      setCopiedFormat(null);
      return;
    }

    const bodyLen = doc.getBody()?.dataStream.length ?? 0;
    const style = bodyLen > 1 ? doc.getTextRange(0, Math.min(1, bodyLen - 1)).getCommonExplicitTextStyle() : null;
    setCopiedFormat({
      ff: style?.ff ?? fontFamily,
      fs: style?.fs ?? fontSize,
      bl: isBold ? 1 : 0,
      it: isItalic ? 1 : 0,
      fg: style?.cl?.rgb ?? fontColor,
      bg: style?.bg?.rgb ?? null,
    });
    onStatus('Format Painter active — select target text & click again');
  };

  const handleChangeCase = (mode: 'lower' | 'upper' | 'title' | 'toggle') => {
    setOpenDropdown(null);
    const doc = univerApi?.getActiveDocument();
    if (!doc) return;
    const paragraphs = doc.getParagraphs();
    const first = paragraphs[0];
    if (!first) return;
    const range = first.getTextRange();
    const current = range.getText();
    if (!current.trim()) {
      onStatus('Type text in paragraph to change case');
      return;
    }
    const transformed =
      mode === 'lower'
        ? current.toLowerCase()
        : mode === 'upper'
          ? current.toUpperCase()
          : mode === 'title'
            ? current.replace(/\b\w/g, (c) => c.toUpperCase())
            : current.replace(/[a-zA-Z]/g, (c) => (c === c.toLowerCase() ? c.toUpperCase() : c.toLowerCase()));
    range.setText(transformed);
    onStatus(`Applied ${mode} case`);
  };

  const handleSortParagraphs = () => {
    const doc = univerApi?.getActiveDocument();
    if (!doc) return;
    const paragraphs = doc.getParagraphs();
    const lines = paragraphs.map((p) => p.getText().trim()).filter(Boolean);
    if (lines.length < 2) {
      onStatus('Need at least 2 paragraphs to sort A-Z');
      return;
    }
    const sorted = [...lines].sort((a, b) => a.localeCompare(b));
    sorted.forEach((line, idx) => {
      paragraphs[idx]?.setText(line);
    });
    onStatus('Sorted paragraphs A → Z');
  };

  const handleFindNext = (e?: FormEvent) => {
    e?.preventDefault();
    const doc = univerApi?.getActiveDocument();
    if (!doc || !findQuery) return;
    const stream = doc.getBody()?.dataStream ?? '';
    const lowerStream = stream.toLowerCase();
    const lowerQ = findQuery.toLowerCase();
    let idx = lowerStream.indexOf(lowerQ, lastMatchOffset);
    if (idx === -1 && lastMatchOffset > 0) {
      idx = lowerStream.indexOf(lowerQ, 0);
    }
    if (idx === -1) {
      onStatus(`No match for "${findQuery}"`);
      return;
    }
    doc.setSelection(idx, idx + findQuery.length);
    setLastMatchOffset(idx + findQuery.length);
    onStatus(`Found "${findQuery}" at offset ${idx}`);
  };

  const handleReplaceOne = () => {
    const doc = univerApi?.getActiveDocument();
    if (!doc || !findQuery) return;
    const stream = doc.getBody()?.dataStream ?? '';
    const idx = stream.toLowerCase().indexOf(findQuery.toLowerCase(), Math.max(0, lastMatchOffset - findQuery.length));
    const targetIdx = idx !== -1 ? idx : stream.toLowerCase().indexOf(findQuery.toLowerCase());
    if (targetIdx === -1) {
      onStatus(`No match for "${findQuery}"`);
      return;
    }
    doc.getTextRange(targetIdx, targetIdx + findQuery.length).setText(replaceQuery);
    doc.setSelection(targetIdx, targetIdx + replaceQuery.length);
    setLastMatchOffset(targetIdx + replaceQuery.length);
    onStatus(`Replaced 1 occurrence of "${findQuery}"`);
  };

  const handleReplaceAll = () => {
    const doc = univerApi?.getActiveDocument();
    if (!doc || !findQuery) return;
    let count = 0;
    let guard = 0;
    while (guard < 200) {
      guard += 1;
      const stream = doc.getBody()?.dataStream ?? '';
      const idx = stream.toLowerCase().indexOf(findQuery.toLowerCase());
      if (idx === -1) break;
      doc.getTextRange(idx, idx + findQuery.length).setText(replaceQuery);
      count += 1;
      if (replaceQuery.toLowerCase().includes(findQuery.toLowerCase())) break;
    }
    onStatus(count > 0 ? `Replaced ${count} match(es)` : `No match for "${findQuery}"`);
  };

  const handleSearchAction = (e: FormEvent) => {
    e.preventDefault();
    const q = searchText.trim().toLowerCase();
    if (!q) return;
    if (q.includes('bold')) { setIsBold((v) => !v); void execCmd(SetInlineFormatBoldCommand.id); }
    else if (q.includes('italic')) { setIsItalic((v) => !v); void execCmd(SetInlineFormatItalicCommand.id); }
    else if (q.includes('table')) { setActiveTab('Insert'); void execCmd(CreateDocTableCommand.id, { rowCount: 3, colCount: 3 }); }
    else if (q.includes('zoom')) { setActiveTab('View'); }
    else if (q.includes('margin') || q.includes('layout')) { setActiveTab('Layout'); }
    else {
      setFindQuery(searchText.trim());
      setReplaceMode(false);
      setFindModalOpen(true);
    }
    setSearchText('');
  };

  const applyAlignment = (mode: AlignMode) => {
    setAlign(mode);
    const cmdMap: Record<AlignMode, string> = {
      left: AlignLeftCommand.id,
      center: AlignCenterCommand.id,
      right: AlignRightCommand.id,
      justify: AlignJustifyCommand.id,
    };
    void execCmd(cmdMap[mode]);
  };

  const cleanTitle = documentTitle.replace(/\.(unidoc|docx|doc)$/i, '') || 'Document1';
  const tabs: WordRibbonTab[] = ['File', 'Home', 'Insert', 'Design', 'Layout', 'References', 'Mailings', 'Review', 'View', 'Help'];
  const visibleStyles = stylesPage === 0 ? WORD_STYLES_PAGE_1 : WORD_STYLES_PAGE_2;

  const renderPaletteGrid = (
    colors: string[],
    onPick: (color: string) => void,
    resetLabel?: string,
    onReset?: () => void,
    colsClass = 'grid-cols-10',
  ) => (
    <div className="p-2 bg-white border border-[#d2d0ce] shadow-lg w-[216px]">
      <div className={`grid ${colsClass} gap-1`}>
        {colors.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onClick={() => { onPick(c); setOpenDropdown(null); }}
            style={{ backgroundColor: c }}
            className="w-4 h-4 border border-[#bfbfbf] hover:scale-110 transition-transform cursor-default"
          />
        ))}
      </div>
      {resetLabel && onReset && (
        <button
          type="button"
          onClick={() => { onReset(); setOpenDropdown(null); }}
          className="mt-2 w-full text-left px-1.5 py-1 text-[11px] hover:bg-[#edebe9] border-t border-[#eeeeee] cursor-default"
        >
          {resetLabel}
        </button>
      )}
    </div>
  );

  return (
    <div ref={ribbonRootRef} className="shrink-0 bg-[#f3f2f1] text-[#262626] select-none relative z-30">
      {/* 1. Word Blue Top Header Bar */}
      <div className="h-[34px] bg-[#2b579a] text-white px-2.5 flex items-center justify-between gap-3 text-[12px]">
        {/* Left: AutoSave + QAT + Title */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            onClick={() => {
              const next = !autoSave;
              setAutoSave(next);
              if (next) onSaveToWin10();
              onStatus(next ? 'AutoSave On' : 'AutoSave Off');
            }}
            className="hidden sm:flex items-center gap-1.5 pr-1.5 mr-1 rounded-[2px] hover:bg-white/12 px-1 py-0.5 cursor-default"
            title="Toggle AutoSave to Win 10 Documents"
          >
            <span className="text-[11px] text-white/95">AutoSave</span>
            <span className={`inline-flex items-center w-[28px] h-[14px] rounded-full border border-white/70 px-[2px] transition-colors ${autoSave ? 'bg-white/30 justify-end' : 'bg-transparent justify-start'}`}>
              <span className="w-[8px] h-[8px] rounded-full bg-white" />
            </span>
            <span className="text-[10px] text-white/80">{autoSave ? 'On' : 'Off'}</span>
          </button>

          <button
            type="button"
            title="Back to Word Home"
            onClick={onBackHome}
            className="w-6 h-6 flex items-center justify-center rounded-[2px] hover:bg-white/15 cursor-default"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M2.5 8L8 3l5.5 5M4 6.8V13h3v-3.5h2V13h3V6.8" />
            </svg>
          </button>

          <button
            type="button"
            title="Save to Win 10 (Documents)"
            disabled={saving}
            onClick={onSaveToWin10}
            className="w-6 h-6 flex items-center justify-center rounded-[2px] hover:bg-white/15 cursor-default disabled:opacity-50"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.3">
              <path d="M2.5 2.5h9l2 2v9h-11v-11z" />
              <rect x="4.5" y="2.5" width="5" height="3.5" />
              <rect x="4.5" y="9" width="7" height="4.5" />
            </svg>
          </button>

          <button
            type="button"
            title="Undo (Ctrl+Z)"
            onClick={() => void univerApi?.undo()}
            className="w-6 h-6 flex items-center justify-center rounded-[2px] hover:bg-white/15 cursor-default"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M5 4L2 7l3 3" />
              <path d="M2 7h7a4 4 0 1 1 0 8H7" />
            </svg>
          </button>

          <button
            type="button"
            title="Redo (Ctrl+Y)"
            onClick={() => void univerApi?.redo()}
            className="w-6 h-6 flex items-center justify-center rounded-[2px] hover:bg-white/15 cursor-default"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M11 4l3 3-3 3" />
              <path d="M14 7H7a4 4 0 1 0 0 8h2" />
            </svg>
          </button>

          <div className="relative">
            <button
              type="button"
              title="Customize Quick Access Toolbar"
              onClick={() => toggleDrop('qat')}
              className="w-5 h-6 flex items-center justify-center rounded-[2px] hover:bg-white/15 cursor-default text-[9px]"
            >
              ▾
            </button>
            {openDropdown === 'qat' && (
              <div className={menuPanelClass}>
                <button type="button" onClick={() => { onNew(); setOpenDropdown(null); }} className={menuRowClass}>
                  <span>New Blank Document</span>
                </button>
                <button type="button" onClick={() => { onOpen(); setOpenDropdown(null); }} className={menuRowClass}>
                  <span>Open…</span>
                </button>
                <button type="button" onClick={() => { onSaveToLocal(); setOpenDropdown(null); }} className={menuRowClass}>
                  <span>Export .docx</span>
                </button>
                <button type="button" onClick={() => { onSwitchToExcel(); setOpenDropdown(null); }} className={menuRowClass}>
                  <span>Switch to Excel</span>
                </button>
              </div>
            )}
          </div>

          <span className="ml-2 font-normal text-white/95 truncate">{cleanTitle} - Word</span>

          {statusMessage && (
            <span role="status" className="ml-2 px-2 py-0.5 rounded bg-black/20 text-[11px] text-white/95 truncate max-w-[180px]">
              {statusMessage}
            </span>
          )}
        </div>

        {/* Center: Search Bar */}
        <form onSubmit={handleSearchAction} className="hidden sm:flex items-center flex-1 max-w-[350px] mx-2">
          <div className="flex items-center gap-2 w-full h-[24px] px-2.5 bg-white/22 hover:bg-white/28 focus-within:bg-white focus-within:text-[#262626] rounded-[2px] transition-colors">
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.5" className="shrink-0 opacity-90">
              <circle cx="7" cy="7" r="4.5" />
              <line x1="10.5" y1="10.5" x2="14" y2="14" />
            </svg>
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Search"
              aria-label="Search Word commands or text"
              className="w-full bg-transparent text-[11.5px] outline-none placeholder:text-white/85 focus:placeholder:text-[#777]"
            />
          </div>
        </form>

        {/* Right: Quick Export + User + Ribbon Display */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSaveToLocal}
            disabled={exporting}
            title="Download as .docx"
            className="hidden md:flex items-center px-2 py-0.5 rounded-[2px] bg-white/12 hover:bg-white/22 text-[11px] cursor-default"
          >
            {exporting ? 'Exporting…' : 'Export .docx'}
          </button>
          <span className="hidden md:inline text-[11.5px] text-white/90">User</span>
          <span className="w-6 h-6 rounded-full bg-[#498205] border border-white/40 flex items-center justify-center text-[10px] font-semibold">
            U
          </span>
          <button
            type="button"
            title={ribbonCollapsed ? 'Expand Ribbon' : 'Collapse Ribbon'}
            onClick={() => setRibbonCollapsed((v) => !v)}
            className="w-6 h-6 flex items-center justify-center rounded-[2px] hover:bg-white/15 cursor-default"
          >
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.3">
              <rect x="2.5" y="3" width="11" height="10" rx="1" />
              <line x1="2.5" y1="6.5" x2="13.5" y2="6.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* 2. Word Ribbon Tabs Row */}
      <div className="relative h-[28px] bg-[#f3f2f1] border-b border-[#e1dfdd] px-2 flex items-end justify-between text-[12px]">
        <div className="flex items-end gap-0.5 overflow-x-auto no-scrollbar">
          {tabs.map((tab) => {
            if (tab === 'File') {
              return (
                <div key={tab} className="relative">
                  <button
                    type="button"
                    onClick={() => toggleDrop('file')}
                    className={`px-3.5 h-[26px] flex items-center text-[12px] cursor-default transition-colors ${
                      openDropdown === 'file' ? 'bg-[#2b579a] text-white' : 'text-[#262626] hover:bg-[#e1dfdd]'
                    }`}
                  >
                    File
                  </button>
                  {openDropdown === 'file' && (
                    <div className={menuPanelClass}>
                      <button type="button" onClick={() => { onBackHome(); setOpenDropdown(null); }} className={menuRowClass}>
                        <span>Home</span>
                      </button>
                      <button type="button" onClick={() => { onNew(); setOpenDropdown(null); }} className={menuRowClass}>
                        <span>New Blank Document</span>
                      </button>
                      <button type="button" onClick={() => { onOpen(); setOpenDropdown(null); }} className={menuRowClass}>
                        <span>Open…</span>
                      </button>
                      <div className="my-1 border-t border-[#eeeeee]" />
                      <button type="button" onClick={() => { onSaveToWin10(); setOpenDropdown(null); }} className={menuRowClass}>
                        <span>{saving ? 'Saving…' : 'Save to Win 10'}</span>
                      </button>
                      <button type="button" onClick={() => { onSaveToLocal(); setOpenDropdown(null); }} className={menuRowClass}>
                        <span>{exporting ? 'Exporting…' : 'Save .docx to PC'}</span>
                      </button>
                      <div className="my-1 border-t border-[#eeeeee]" />
                      <button type="button" onClick={() => { onSwitchToExcel(); setOpenDropdown(null); }} className={menuRowClass}>
                        <span>Open Excel</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            const isActive = activeTab === tab && !ribbonCollapsed;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setRibbonCollapsed(false);
                }}
                className={`px-2.5 h-[26px] flex items-center text-[12px] cursor-default relative whitespace-nowrap transition-colors ${
                  isActive
                    ? 'text-[#2b579a] font-semibold bg-white/70 border-b-2 border-[#2b579a]'
                    : 'text-[#262626] hover:bg-[#e1dfdd]'
                }`}
              >
                {tab}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => {
            onSaveToLocal();
            onStatus('Exporting document for sharing…');
          }}
          className="hidden sm:flex items-center gap-1.5 px-2.5 h-[22px] mb-0.5 bg-white border border-[#d2d0ce] hover:bg-[#edebe9] rounded-[2px] text-[11.5px] text-[#2b579a] shrink-0 cursor-default"
        >
          <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="1.4">
            <path d="M8 2.5v8M5 5.5L8 2.5l3 3M3 10.5v3h10v-3" />
          </svg>
          <span>Share</span>
        </button>
      </div>

      {/* 3. Ribbon Command Groups Area */}
      {!ribbonCollapsed && (
        <div className="bg-[#f3f2f1] border-b border-[#d2d0ce] px-1.5 h-[90px] flex items-stretch overflow-x-auto no-scrollbar shadow-[inset_0_1px_0_#ffffff]">
          {activeTab === 'Home' && (
            <>
              {/* Clipboard */}
              <RibbonGroup label="Clipboard" hasDialogLauncher>
                <div className="relative flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => void execCmd(DocPasteCommand.id, undefined, 'Pasted')}
                    className="h-[46px] px-1.5 flex flex-col items-center justify-center rounded-[2px] hover:bg-[#e1dfdd] cursor-default"
                    title="Paste (Ctrl+V)"
                  >
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none">
                      <rect x="6" y="4" width="12" height="16" rx="1.5" fill="#d9b26f" stroke="#8a6d3b" strokeWidth="1.2" />
                      <rect x="9" y="2.5" width="6" height="3" rx="0.8" fill="#888" />
                      <rect x="10" y="9" width="9" height="11" rx="1" fill="#ffffff" stroke="#5a5a5a" strokeWidth="1.2" />
                      <line x1="12" y1="12.5" x2="17" y2="12.5" stroke="#2b579a" strokeWidth="1.2" />
                      <line x1="12" y1="15.5" x2="17" y2="15.5" stroke="#5a5a5a" strokeWidth="1.2" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleDrop('paste')}
                    className="h-[18px] px-1 text-[10.5px] flex items-center gap-0.5 rounded-[2px] hover:bg-[#e1dfdd] cursor-default"
                  >
                    <span>Paste</span>
                    <span className="text-[8px]">▾</span>
                  </button>
                  {openDropdown === 'paste' && (
                    <div className={menuPanelClass}>
                      <button type="button" onClick={() => { void execCmd(DocPasteCommand.id); setOpenDropdown(null); }} className={menuRowClass}>
                        <span>Keep Source Formatting</span>
                      </button>
                      <button type="button" onClick={() => { void execCmd(DocPasteCommand.id); setOpenDropdown(null); }} className={menuRowClass}>
                        <span>Keep Text Only</span>
                      </button>
                    </div>
                  )}
                </div>

                <div className="flex flex-col justify-between h-[64px] text-[11px]">
                  <button
                    type="button"
                    onClick={() => void execCmd(DocCutCommand.id, undefined, 'Cut')}
                    className="h-[20px] px-1.5 flex items-center gap-1.5 rounded-[2px] hover:bg-[#e1dfdd] cursor-default"
                    title="Cut (Ctrl+X)"
                  >
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="#444" strokeWidth="1.3">
                      <circle cx="4.5" cy="11.5" r="2" />
                      <circle cx="11.5" cy="11.5" r="2" />
                      <path d="M5.8 10L11 3M10.2 10L5 3" />
                    </svg>
                    <span>Cut</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void execCmd(DocCopyCommand.id, undefined, 'Copied')}
                    className="h-[20px] px-1.5 flex items-center gap-1.5 rounded-[2px] hover:bg-[#e1dfdd] cursor-default"
                    title="Copy (Ctrl+C)"
                  >
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="#444" strokeWidth="1.2">
                      <rect x="3" y="2.5" width="7" height="9" fill="#fff" />
                      <rect x="6" y="5" width="7" height="9" fill="#fff" />
                    </svg>
                    <span>Copy</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleFormatPainter}
                    className={`h-[20px] px-1.5 flex items-center gap-1.5 rounded-[2px] cursor-default ${
                      copiedFormat ? 'bg-[#c7d7ee] border border-[#9db9e2]' : 'hover:bg-[#e1dfdd]'
                    }`}
                    title="Format Painter"
                  >
                    <svg viewBox="0 0 16 16" width="12" height="12" fill="none">
                      <rect x="3" y="2" width="9" height="4.5" fill="#f3c13a" stroke="#997015" strokeWidth="1" />
                      <path d="M7.5 6.5v3l-1 4.5h2l-1-4.5" stroke="#666" strokeWidth="1.2" />
                    </svg>
                    <span className="whitespace-nowrap">Format Painter</span>
                  </button>
                </div>
              </RibbonGroup>

              {/* Font */}
              <RibbonGroup label="Font" hasDialogLauncher>
                <div className="flex flex-col justify-between h-[64px] gap-1">
                  {/* Font Row 1 */}
                  <div className="flex items-center gap-1">
                    <select
                      aria-label="Font Family"
                      value={fontFamily}
                      onChange={(e) => applyFontFamily(e.target.value)}
                      className="h-[22px] w-[112px] bg-white border border-[#c8c6c4] hover:border-[#8a8886] px-1.5 text-[11.5px] outline-none"
                    >
                      {FONT_FAMILIES.map((ff) => (
                        <option key={ff} value={ff}>{ff}</option>
                      ))}
                    </select>

                    <select
                      aria-label="Font Size"
                      value={fontSize}
                      onChange={(e) => applyFontSize(Number(e.target.value))}
                      className="h-[22px] w-[42px] bg-white border border-[#c8c6c4] hover:border-[#8a8886] px-1 text-[11.5px] outline-none"
                    >
                      {FONT_SIZES.map((sz) => (
                        <option key={sz} value={sz}>{sz}</option>
                      ))}
                    </select>

                    <button type="button" title="Increase Font Size" onClick={() => stepFontSize(1)} className={iconBtnClass}>
                      <span className="text-[12px] font-semibold">A</span>
                      <span className="text-[7px] text-[#2b579a] -mt-2">▲</span>
                    </button>
                    <button type="button" title="Decrease Font Size" onClick={() => stepFontSize(-1)} className={iconBtnClass}>
                      <span className="text-[10.5px] font-semibold">A</span>
                      <span className="text-[7px] text-[#2b579a] -mt-1.5">▼</span>
                    </button>

                    <div className="h-4 w-[1px] bg-[#d2d0ce] mx-0.5" />

                    {/* Change Case */}
                    <div className="relative">
                      <button type="button" title="Change Case" onClick={() => toggleDrop('changeCase')} className={`${iconBtnClass} gap-0.5`}>
                        <span className="text-[11px] font-medium">Aa</span>
                        <span className="text-[8px]">▾</span>
                      </button>
                      {openDropdown === 'changeCase' && (
                        <div className={menuPanelClass}>
                          <button type="button" onClick={() => handleChangeCase('lower')} className={menuRowClass}><span>lowercase</span></button>
                          <button type="button" onClick={() => handleChangeCase('upper')} className={menuRowClass}><span>UPPERCASE</span></button>
                          <button type="button" onClick={() => handleChangeCase('title')} className={menuRowClass}><span>Capitalize Each Word</span></button>
                          <button type="button" onClick={() => handleChangeCase('toggle')} className={menuRowClass}><span>tOGGLE cASE</span></button>
                        </div>
                      )}
                    </div>

                    {/* Clear All Formatting */}
                    <button type="button" title="Clear All Formatting" onClick={clearFormatting} className={iconBtnClass}>
                      <span className="text-[11px] font-semibold relative">
                        A<span className="text-[8px] text-[#c85a82] ml-0.5">⌫</span>
                      </span>
                    </button>
                  </div>

                  {/* Font Row 2 */}
                  <div className="flex items-center gap-0.5">
                    <button
                      type="button"
                      title="Bold (Ctrl+B)"
                      onClick={() => { setIsBold((v) => !v); void execCmd(SetInlineFormatBoldCommand.id); }}
                      className={isBold ? activeIconBtnClass : iconBtnClass}
                    >
                      <span className="font-bold text-[12px]">B</span>
                    </button>
                    <button
                      type="button"
                      title="Italic (Ctrl+I)"
                      onClick={() => { setIsItalic((v) => !v); void execCmd(SetInlineFormatItalicCommand.id); }}
                      className={isItalic ? activeIconBtnClass : iconBtnClass}
                    >
                      <span className="italic font-serif text-[12px]">I</span>
                    </button>
                    <button
                      type="button"
                      title="Underline (Ctrl+U)"
                      onClick={() => { setIsUnderline((v) => !v); void execCmd(SetInlineFormatUnderlineCommand.id); }}
                      className={isUnderline ? activeIconBtnClass : iconBtnClass}
                    >
                      <span className="underline text-[12px]">U</span>
                      <span className="text-[8px] ml-0.5">▾</span>
                    </button>
                    <button
                      type="button"
                      title="Strikethrough"
                      onClick={() => { setIsStrike((v) => !v); void execCmd(SetInlineFormatStrikethroughCommand.id); }}
                      className={isStrike ? activeIconBtnClass : iconBtnClass}
                    >
                      <span className="line-through text-[11.5px]">ab</span>
                    </button>
                    <button
                      type="button"
                      title="Subscript"
                      onClick={() => {
                        setSubSuper((v) => (v === 'sub' ? 'none' : 'sub'));
                        void execCmd(SetInlineFormatSubscriptCommand.id);
                      }}
                      className={subSuper === 'sub' ? activeIconBtnClass : iconBtnClass}
                    >
                      <span className="text-[11px]">x<sub className="text-[8px]">2</sub></span>
                    </button>
                    <button
                      type="button"
                      title="Superscript"
                      onClick={() => {
                        setSubSuper((v) => (v === 'sup' ? 'none' : 'sup'));
                        void execCmd(SetInlineFormatSuperscriptCommand.id);
                      }}
                      className={subSuper === 'sup' ? activeIconBtnClass : iconBtnClass}
                    >
                      <span className="text-[11px]">x<sup className="text-[8px]">2</sup></span>
                    </button>

                    <div className="h-4 w-[1px] bg-[#d2d0ce] mx-1" />

                    {/* Text Effects & Typography */}
                    <div className="relative">
                      <button type="button" title="Text Effects and Typography" onClick={() => toggleDrop('textEffects')} className={`${iconBtnClass} gap-0.5`}>
                        <span className="text-[12px] font-bold text-[#3b78d8] drop-shadow-[0_1px_1px_rgba(43,87,154,0.35)]">A</span>
                        <span className="text-[8px]">▾</span>
                      </button>
                      {openDropdown === 'textEffects' && (
                        <div className={menuPanelClass}>
                          <button type="button" onClick={() => { void execCmd(SetInlineFormatTextColorCommand.id, { value: '#2f5496' }); setOpenDropdown(null); }} className={menuRowClass}>
                            <span className="text-[#2f5496] font-semibold">Ocean Blue Accent</span>
                          </button>
                          <button type="button" onClick={() => { void execCmd(SetInlineFormatTextColorCommand.id, { value: '#c55a11' }); setOpenDropdown(null); }} className={menuRowClass}>
                            <span className="text-[#c55a11] font-semibold">Warm Copper Glow</span>
                          </button>
                          <button type="button" onClick={() => { void execCmd(ResetInlineFormatTextColorCommand.id); setOpenDropdown(null); }} className={menuRowClass}>
                            <span>Clear Text Effect</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Text Highlight Color */}
                    <div className="relative flex items-center">
                      <button
                        type="button"
                        title="Text Highlight Color"
                        onClick={() => void execCmd(SetInlineFormatTextBackgroundColorCommand.id, { value: highlightColor })}
                        className={`${iconBtnClass} flex-col py-0.5`}
                      >
                        <span className="text-[10px] leading-none font-medium">ab</span>
                        <span className="w-3.5 h-[3px] mt-0.5 border border-black/15" style={{ backgroundColor: highlightColor }} />
                      </button>
                      <button type="button" onClick={() => toggleDrop('highlightColor')} className="h-[22px] px-0.5 hover:bg-[#e1dfdd] text-[8px] cursor-default">▾</button>
                      {openDropdown === 'highlightColor' && (
                        <div className="absolute left-0 top-full mt-0.5 z-50">
                          {renderPaletteGrid(
                            HIGHLIGHT_COLORS,
                            (c) => { setHighlightColor(c); void execCmd(SetInlineFormatTextBackgroundColorCommand.id, { value: c }); },
                            'No Color',
                            () => void execCmd(ResetInlineFormatTextBackgroundColorCommand.id),
                            'grid-cols-5',
                          )}
                        </div>
                      )}
                    </div>

                    {/* Font Color */}
                    <div className="relative flex items-center">
                      <button
                        type="button"
                        title="Font Color"
                        onClick={() => void execCmd(SetInlineFormatTextColorCommand.id, { value: fontColor })}
                        className={`${iconBtnClass} flex-col py-0.5`}
                      >
                        <span className="text-[11px] leading-none font-bold">A</span>
                        <span className="w-3.5 h-[3px] mt-0.5" style={{ backgroundColor: fontColor }} />
                      </button>
                      <button type="button" onClick={() => toggleDrop('fontColor')} className="h-[22px] px-0.5 hover:bg-[#e1dfdd] text-[8px] cursor-default">▾</button>
                      {openDropdown === 'fontColor' && (
                        <div className="absolute left-0 top-full mt-0.5 z-50">
                          {renderPaletteGrid(
                            PALETTE_COLORS,
                            (c) => { setFontColor(c); void execCmd(SetInlineFormatTextColorCommand.id, { value: c }); },
                            'Automatic',
                            () => void execCmd(ResetInlineFormatTextColorCommand.id),
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </RibbonGroup>

              {/* Paragraph */}
              <RibbonGroup label="Paragraph" hasDialogLauncher>
                <div className="flex flex-col justify-between h-[64px] gap-1">
                  {/* Paragraph Row 1 */}
                  <div className="flex items-center gap-0.5">
                    {/* Bullets */}
                    <div className="relative flex items-center">
                      <button type="button" title="Bullets" onClick={() => void execCmd(BulletListCommand.id)} className={iconBtnClass}>
                        <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                          <circle cx="3" cy="4" r="1.2" /><rect x="6" y="3.3" width="8" height="1.4" />
                          <circle cx="3" cy="8" r="1.2" /><rect x="6" y="7.3" width="8" height="1.4" />
                          <circle cx="3" cy="12" r="1.2" /><rect x="6" y="11.3" width="8" height="1.4" />
                        </svg>
                      </button>
                      <button type="button" onClick={() => toggleDrop('bullets')} className="h-[22px] px-0.5 hover:bg-[#e1dfdd] text-[8px] cursor-default">▾</button>
                      {openDropdown === 'bullets' && (
                        <div className={menuPanelClass}>
                          <button type="button" onClick={() => { void execCmd(BulletListCommand.id, { value: 'BULLET_LIST' }); setOpenDropdown(null); }} className={menuRowClass}><span>• Standard Bullet</span></button>
                          <button type="button" onClick={() => { void execCmd(BulletListCommand.id, { value: 'BULLET_LIST_1' }); setOpenDropdown(null); }} className={menuRowClass}><span>◦ Hollow Circle</span></button>
                          <button type="button" onClick={() => { void execCmd(BulletListCommand.id, { value: 'BULLET_LIST_2' }); setOpenDropdown(null); }} className={menuRowClass}><span>▪ Square Bullet</span></button>
                          <button type="button" onClick={() => { void execCmd(CheckListCommand.id); setOpenDropdown(null); }} className={menuRowClass}><span>☑ Checklist</span></button>
                        </div>
                      )}
                    </div>

                    {/* Numbering */}
                    <div className="relative flex items-center">
                      <button type="button" title="Numbering" onClick={() => void execCmd(OrderListCommand.id)} className={iconBtnClass}>
                        <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                          <text x="1.5" y="5.5" fontSize="4.8" fontFamily="sans-serif">1</text><rect x="6" y="3.3" width="8" height="1.4" />
                          <text x="1.5" y="9.5" fontSize="4.8" fontFamily="sans-serif">2</text><rect x="6" y="7.3" width="8" height="1.4" />
                          <text x="1.5" y="13.5" fontSize="4.8" fontFamily="sans-serif">3</text><rect x="6" y="11.3" width="8" height="1.4" />
                        </svg>
                      </button>
                      <button type="button" onClick={() => toggleDrop('numbering')} className="h-[22px] px-0.5 hover:bg-[#e1dfdd] text-[8px] cursor-default">▾</button>
                      {openDropdown === 'numbering' && (
                        <div className={menuPanelClass}>
                          <button type="button" onClick={() => { void execCmd(OrderListCommand.id, { value: 'ORDER_LIST' }); setOpenDropdown(null); }} className={menuRowClass}><span>1. 2. 3.</span></button>
                          <button type="button" onClick={() => { void execCmd(OrderListCommand.id, { value: 'ORDER_LIST_1' }); setOpenDropdown(null); }} className={menuRowClass}><span>a. b. c.</span></button>
                          <button type="button" onClick={() => { void execCmd(OrderListCommand.id, { value: 'ORDER_LIST_2' }); setOpenDropdown(null); }} className={menuRowClass}><span>i. ii. iii.</span></button>
                        </div>
                      )}
                    </div>

                    {/* Multilevel List */}
                    <div className="relative flex items-center">
                      <button type="button" title="Multilevel List" onClick={() => toggleDrop('multilevel')} className={`${iconBtnClass} gap-0.5`}>
                        <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                          <rect x="2" y="3" width="10" height="1.3" />
                          <rect x="5" y="7.2" width="8" height="1.3" />
                          <rect x="8" y="11.4" width="6" height="1.3" />
                        </svg>
                        <span className="text-[8px]">▾</span>
                      </button>
                      {openDropdown === 'multilevel' && (
                        <div className={menuPanelClass}>
                          <button type="button" onClick={() => { void execCmd(OrderListCommand.id); setOpenDropdown(null); }} className={menuRowClass}><span>1 / a / i Outline</span></button>
                          <button type="button" onClick={() => { void execCmd(BulletListCommand.id); setOpenDropdown(null); }} className={menuRowClass}><span>• / ◦ / ▪ Multi-bullet</span></button>
                        </div>
                      )}
                    </div>

                    <div className="h-4 w-[1px] bg-[#d2d0ce] mx-0.5" />

                    {/* Decrease / Increase Indent */}
                    <button
                      type="button"
                      title="Decrease Indent"
                      onClick={() => {
                        void execCmd(ChangeListNestingLevelCommand.id, { type: ChangeListNestingLevelType.decrease });
                        void execCmd('doc-paragraph-setting.command', { paragraph: { indentStart: 0 } });
                      }}
                      className={iconBtnClass}
                    >
                      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.2">
                        <path d="M5 5L2.5 7.5 5 10" />
                        <path d="M7 4h7M7 7.5h7M7 11h7" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      title="Increase Indent"
                      onClick={() => {
                        void execCmd(ChangeListNestingLevelCommand.id, { type: ChangeListNestingLevelType.increase });
                        void execCmd('doc-paragraph-setting.command', { paragraph: { indentStart: 36 } });
                      }}
                      className={iconBtnClass}
                    >
                      <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.2">
                        <path d="M2.5 5L5 7.5 2.5 10" />
                        <path d="M7 4h7M7 7.5h7M7 11h7" />
                      </svg>
                    </button>

                    <div className="h-4 w-[1px] bg-[#d2d0ce] mx-0.5" />

                    {/* Sort A->Z */}
                    <button type="button" title="Sort Paragraphs A-Z" onClick={handleSortParagraphs} className={iconBtnClass}>
                      <span className="text-[10px] font-semibold leading-none text-[#2b579a]">A<span className="text-[#444]">↓</span>Z</span>
                    </button>

                    {/* Show/Hide ¶ */}
                    <button
                      type="button"
                      title="Show/Hide Formatting Marks (¶)"
                      onClick={() => {
                        const next = !showFormattingMarks;
                        setShowFormattingMarks(next);
                        onStatus(next ? 'Formatting marks visible (¶)' : 'Formatting marks hidden');
                      }}
                      className={showFormattingMarks ? activeIconBtnClass : iconBtnClass}
                    >
                      <span className="text-[12px] font-serif">¶</span>
                    </button>
                  </div>

                  {/* Paragraph Row 2 */}
                  <div className="flex items-center gap-0.5">
                    {(['left', 'center', 'right', 'justify'] as AlignMode[]).map((mode) => (
                      <button
                        key={mode}
                        type="button"
                        title={`Align ${mode.charAt(0).toUpperCase() + mode.slice(1)}`}
                        onClick={() => applyAlignment(mode)}
                        className={align === mode ? activeIconBtnClass : iconBtnClass}
                      >
                        <svg viewBox="0 0 16 16" width="13" height="13" fill="currentColor">
                          {mode === 'left' && (
                            <>
                              <rect x="2" y="3" width="12" height="1.3" /><rect x="2" y="6.3" width="8" height="1.3" />
                              <rect x="2" y="9.6" width="12" height="1.3" /><rect x="2" y="12.8" width="9" height="1.3" />
                            </>
                          )}
                          {mode === 'center' && (
                            <>
                              <rect x="2" y="3" width="12" height="1.3" /><rect x="4" y="6.3" width="8" height="1.3" />
                              <rect x="2" y="9.6" width="12" height="1.3" /><rect x="3.5" y="12.8" width="9" height="1.3" />
                            </>
                          )}
                          {mode === 'right' && (
                            <>
                              <rect x="2" y="3" width="12" height="1.3" /><rect x="6" y="6.3" width="8" height="1.3" />
                              <rect x="2" y="9.6" width="12" height="1.3" /><rect x="5" y="12.8" width="9" height="1.3" />
                            </>
                          )}
                          {mode === 'justify' && (
                            <>
                              <rect x="2" y="3" width="12" height="1.3" /><rect x="2" y="6.3" width="12" height="1.3" />
                              <rect x="2" y="9.6" width="12" height="1.3" /><rect x="2" y="12.8" width="12" height="1.3" />
                            </>
                          )}
                        </svg>
                      </button>
                    ))}

                    <div className="h-4 w-[1px] bg-[#d2d0ce] mx-0.5" />

                    {/* Line and Paragraph Spacing */}
                    <div className="relative">
                      <button type="button" title="Line and Paragraph Spacing" onClick={() => toggleDrop('lineSpacing')} className={`${iconBtnClass} gap-0.5`}>
                        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.2">
                          <path d="M3 4v8M1.8 5.2L3 4l1.2 1.2M1.8 10.8L3 12l1.2-1.2" stroke="#2b579a" />
                          <path d="M6.5 4h7.5M6.5 8h7.5M6.5 12h7.5" />
                        </svg>
                        <span className="text-[8px]">▾</span>
                      </button>
                      {openDropdown === 'lineSpacing' && (
                        <div className={menuPanelClass}>
                          {[1.0, 1.15, 1.5, 2.0, 2.5].map((ls) => (
                            <button
                              key={ls}
                              type="button"
                              onClick={() => {
                                void execCmd('doc-paragraph-setting.command', { paragraph: { lineSpacing: ls } }, `Line spacing ${ls}`);
                                setOpenDropdown(null);
                              }}
                              className={menuRowClass}
                            >
                              <span>{ls.toFixed(ls === 1.15 ? 2 : 1)}</span>
                            </button>
                          ))}
                          <div className="my-1 border-t border-[#eeeeee]" />
                          <button
                            type="button"
                            onClick={() => {
                              void execCmd('doc-paragraph-setting.command', { paragraph: { spaceAbove: 10, spaceBelow: 10 } }, 'Added paragraph spacing');
                              setOpenDropdown(null);
                            }}
                            className={menuRowClass}
                          >
                            <span>Add Space Before/After</span>
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Shading */}
                    <div className="relative flex items-center">
                      <button
                        type="button"
                        title="Shading"
                        onClick={() => void execCmd(SetInlineFormatTextBackgroundColorCommand.id, { value: shadingColor })}
                        className={iconBtnClass}
                      >
                        <svg viewBox="0 0 16 16" width="13" height="13" fill="none">
                          <path d="M4 8l4-4 4 4-4 4-4-4z" fill="#e5e0ec" stroke="#444" strokeWidth="1.1" />
                          <rect x="2" y="13" width="12" height="2" fill={shadingColor} />
                        </svg>
                      </button>
                      <button type="button" onClick={() => toggleDrop('shading')} className="h-[22px] px-0.5 hover:bg-[#e1dfdd] text-[8px] cursor-default">▾</button>
                      {openDropdown === 'shading' && (
                        <div className="absolute left-0 top-full mt-0.5 z-50">
                          {renderPaletteGrid(
                            PALETTE_COLORS,
                            (c) => { setShadingColor(c); void execCmd(SetInlineFormatTextBackgroundColorCommand.id, { value: c }); },
                            'No Color',
                            () => void execCmd(ResetInlineFormatTextBackgroundColorCommand.id),
                          )}
                        </div>
                      )}
                    </div>

                    {/* Borders */}
                    <div className="relative flex items-center">
                      <button
                        type="button"
                        title="Horizontal Line / Borders"
                        onClick={() => void execCmd(HorizontalLineCommand.id, undefined, 'Inserted horizontal divider')}
                        className={iconBtnClass}
                      >
                        <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.1">
                          <rect x="2.5" y="2.5" width="11" height="11" strokeDasharray="1.5 1.5" />
                          <line x1="2.5" y1="13.5" x2="13.5" y2="13.5" stroke="#111" strokeWidth="1.5" />
                        </svg>
                      </button>
                      <button type="button" onClick={() => toggleDrop('borders')} className="h-[22px] px-0.5 hover:bg-[#e1dfdd] text-[8px] cursor-default">▾</button>
                      {openDropdown === 'borders' && (
                        <div className={menuPanelClass}>
                          <button type="button" onClick={() => { void execCmd(HorizontalLineCommand.id, undefined, 'Inserted Horizontal Line'); setOpenDropdown(null); }} className={menuRowClass}>
                            <span>Horizontal Line</span>
                          </button>
                          <button type="button" onClick={() => { void execCmd(CreateDocTableCommand.id, { rowCount: 1, colCount: 1 }, 'Inserted Bordered Box'); setOpenDropdown(null); }} className={menuRowClass}>
                            <span>Paragraph Box (1×1)</span>
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </RibbonGroup>

              {/* Styles Gallery */}
              <RibbonGroup label="Styles" hasDialogLauncher>
                <div className="relative flex items-stretch bg-white border border-[#c8c6c4] h-[64px]">
                  <div className="flex items-stretch gap-0.5 p-0.5 overflow-x-auto max-w-[490px] no-scrollbar">
                    {visibleStyles.map((preset) => {
                      const active = activeStyleId === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => void applyWordStyle(preset)}
                          className={`w-[58px] h-full px-1 flex flex-col items-center justify-between py-1 rounded-[1px] cursor-default transition-colors shrink-0 ${
                            active
                              ? 'border border-[#2b579a] bg-[#eef4fc]'
                              : 'border border-transparent hover:border-[#c8c6c4] hover:bg-[#faf9f8]'
                          }`}
                        >
                          <div className="flex-1 flex items-center justify-center overflow-hidden w-full">
                            <span className={`truncate leading-none ${preset.previewStyle}`}>{preset.previewText}</span>
                          </div>
                          <span className="text-[9.5px] text-[#444] truncate w-full text-center leading-tight">
                            {preset.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Mini Styles Scroller (Up / Down / More) */}
                  <div className="flex flex-col border-l border-[#d2d0ce] w-[15px] bg-[#f8f8f8]">
                    <button
                      type="button"
                      title="Previous Styles Row"
                      onClick={() => setStylesPage(0)}
                      className="flex-1 flex items-center justify-center hover:bg-[#e1dfdd] text-[7px] cursor-default"
                    >
                      ▲
                    </button>
                    <button
                      type="button"
                      title="Next Styles Row"
                      onClick={() => setStylesPage(1)}
                      className="flex-1 flex items-center justify-center hover:bg-[#e1dfdd] text-[7px] border-t border-[#e1dfdd] cursor-default"
                    >
                      ▼
                    </button>
                    <button
                      type="button"
                      title="More Styles"
                      onClick={() => toggleDrop('stylesMore')}
                      className="flex-1 flex items-center justify-center hover:bg-[#e1dfdd] text-[7px] border-t border-[#e1dfdd] cursor-default"
                    >
                      ⧨
                    </button>
                  </div>

                  {openDropdown === 'stylesMore' && (
                    <div className="absolute right-0 top-full mt-0.5 z-50 bg-white border border-[#d2d0ce] shadow-lg p-2 w-[380px] grid grid-cols-4 gap-1">
                      {[...WORD_STYLES_PAGE_1, ...WORD_STYLES_PAGE_2].map((preset) => (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => { void applyWordStyle(preset); setOpenDropdown(null); }}
                          className="p-1.5 border border-[#e1dfdd] hover:border-[#2b579a] hover:bg-[#eef4fc] flex flex-col items-center gap-0.5 cursor-default"
                        >
                          <span className={`truncate max-w-full ${preset.previewStyle}`}>{preset.previewText}</span>
                          <span className="text-[9.5px] text-[#444] truncate max-w-full">{preset.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </RibbonGroup>

              {/* Editing */}
              <RibbonGroup label="Editing">
                <div className="flex flex-col justify-between h-[64px] text-[11.5px]">
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => {
                        setFindModalOpen(true);
                        setReplaceMode(false);
                      }}
                      className="h-[20px] px-1.5 flex items-center gap-1.5 rounded-[2px] hover:bg-[#e1dfdd] cursor-default w-full"
                    >
                      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="#2b579a" strokeWidth="1.5">
                        <circle cx="6.5" cy="6.5" r="4" />
                        <line x1="9.5" y1="9.5" x2="13.5" y2="13.5" />
                      </svg>
                      <span>Find</span>
                      <span className="text-[8px] ml-auto">▾</span>
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setFindModalOpen(true);
                      setReplaceMode(true);
                    }}
                    className="h-[20px] px-1.5 flex items-center gap-1.5 rounded-[2px] hover:bg-[#e1dfdd] cursor-default"
                  >
                    <span className="text-[10px] font-semibold text-[#2b579a]">ab</span>
                    <span>Replace</span>
                  </button>

                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => toggleDrop('selectMenu')}
                      className="h-[20px] px-1.5 flex items-center gap-1.5 rounded-[2px] hover:bg-[#e1dfdd] cursor-default w-full"
                    >
                      <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="#444" strokeWidth="1.3">
                        <path d="M4 2.5l7.5 5.5-3.4.9 1.6 3.6-1.4.6-1.6-3.6-2.7 2.2z" />
                      </svg>
                      <span>Select</span>
                      <span className="text-[8px] ml-auto">▾</span>
                    </button>
                    {openDropdown === 'selectMenu' && (
                      <div className={menuPanelClass}>
                        <button
                          type="button"
                          onClick={() => {
                            void execCmd(DocSelectAllCommand.id, undefined, 'Selected all text');
                            setOpenDropdown(null);
                          }}
                          className={menuRowClass}
                        >
                          <span>Select All</span>
                          <span className="text-[10px] text-[#777]">Ctrl+A</span>
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </RibbonGroup>
            </>
          )}

          {activeTab === 'Insert' && (
            <>
              <RibbonGroup label="Pages">
                <button
                  type="button"
                  onClick={() => {
                    const doc = univerApi?.getActiveDocument();
                    if (doc) {
                      const offset = Math.max(0, (doc.getBody()?.dataStream.length ?? 2) - 2);
                      doc.insertHorizontalRule(offset);
                      onStatus('Inserted page divider');
                    }
                  }}
                  className="h-[62px] px-2.5 flex flex-col items-center justify-center rounded-[2px] hover:bg-[#e1dfdd] text-[11px] cursor-default"
                >
                  <span className="text-[18px] text-[#2b579a]">📄</span>
                  <span>Page Divider</span>
                </button>
              </RibbonGroup>
              <RibbonGroup label="Tables">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toggleDrop('tableMenu')}
                    className="h-[62px] px-2.5 flex flex-col items-center justify-center rounded-[2px] hover:bg-[#e1dfdd] text-[11px] cursor-default"
                  >
                    <span className="text-[18px] text-[#2b579a]">⊞</span>
                    <span>Table ▾</span>
                  </button>
                  {openDropdown === 'tableMenu' && (
                    <div className={menuPanelClass}>
                      {[
                        [2, 2],
                        [3, 3],
                        [4, 3],
                        [5, 4],
                      ].map(([r, c]) => (
                        <button
                          key={`${r}x${c}`}
                          type="button"
                          onClick={() => {
                            void execCmd(CreateDocTableCommand.id, { rowCount: r, colCount: c }, `Inserted ${r}×${c} table`);
                            setOpenDropdown(null);
                          }}
                          className={menuRowClass}
                        >
                          <span>Insert {r} × {c} Table</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </RibbonGroup>
              <RibbonGroup label="Text & Symbols">
                <button
                  type="button"
                  onClick={() => {
                    const doc = univerApi?.getActiveDocument();
                    if (doc) {
                      const stamp = new Date().toLocaleDateString();
                      const offset = Math.max(0, (doc.getBody()?.dataStream.length ?? 2) - 2);
                      doc.insertText(offset, stamp);
                      onStatus(`Inserted date: ${stamp}`);
                    }
                  }}
                  className="h-[62px] px-2.5 flex flex-col items-center justify-center rounded-[2px] hover:bg-[#e1dfdd] text-[11px] cursor-default"
                >
                  <span className="text-[18px] text-[#2b579a]">📅</span>
                  <span>Date & Time</span>
                </button>
                <button
                  type="button"
                  onClick={() => void execCmd(HorizontalLineCommand.id, undefined, 'Inserted horizontal line')}
                  className="h-[62px] px-2.5 flex flex-col items-center justify-center rounded-[2px] hover:bg-[#e1dfdd] text-[11px] cursor-default"
                >
                  <span className="text-[18px] text-[#2b579a]">―</span>
                  <span>Horizontal Line</span>
                </button>
              </RibbonGroup>
            </>
          )}

          {activeTab === 'Design' && (
            <RibbonGroup label="Document Formatting">
              {[
                { name: 'Classic Office', ff: 'Calibri', color: '#2f5496' },
                { name: 'Editorial Serif', ff: 'Georgia', color: '#1f4e78' },
                { name: 'Modern Clean', ff: 'Segoe UI', color: '#2b579a' },
                { name: 'Technical Mono', ff: 'Consolas', color: '#333333' },
              ].map((theme) => (
                <button
                  key={theme.name}
                  type="button"
                  onClick={() => {
                    applyFontFamily(theme.ff);
                    setFontColor(theme.color);
                    void execCmd(SetInlineFormatTextColorCommand.id, { value: theme.color });
                    onStatus(`Theme applied: ${theme.name}`);
                  }}
                  className="h-[62px] px-3 flex flex-col items-center justify-center rounded-[2px] bg-white border border-[#d2d0ce] hover:border-[#2b579a] text-[11px] cursor-default"
                >
                  <span style={{ color: theme.color, fontFamily: theme.ff }} className="text-[15px] font-semibold">Aa</span>
                  <span>{theme.name}</span>
                </button>
              ))}
            </RibbonGroup>
          )}

          {activeTab === 'Layout' && (
            <>
              <RibbonGroup label="Page Setup">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => toggleDrop('marginsMenu')}
                    className="h-[62px] px-2.5 flex flex-col items-center justify-center rounded-[2px] hover:bg-[#e1dfdd] text-[11px] cursor-default"
                  >
                    <span className="text-[17px] text-[#2b579a]">▯</span>
                    <span>Margins ▾</span>
                  </button>
                  {openDropdown === 'marginsMenu' && (
                    <div className={menuPanelClass}>
                      <button type="button" onClick={() => { setLeftMarginPct(12); setRightMarginPct(12); onStatus('Margins: Normal (1")'); setOpenDropdown(null); }} className={menuRowClass}><span>Normal (1")</span></button>
                      <button type="button" onClick={() => { setLeftMarginPct(6); setRightMarginPct(6); onStatus('Margins: Narrow (0.5")'); setOpenDropdown(null); }} className={menuRowClass}><span>Narrow (0.5")</span></button>
                      <button type="button" onClick={() => { setLeftMarginPct(18); setRightMarginPct(18); onStatus('Margins: Wide (1.5")'); setOpenDropdown(null); }} className={menuRowClass}><span>Wide (1.5")</span></button>
                    </div>
                  )}
                </div>
              </RibbonGroup>
              <RibbonGroup label="Paragraph">
                <div className="flex flex-col justify-center gap-1 text-[11px]">
                  <div className="flex items-center gap-1.5">
                    <span className="w-14 text-[#555]">Indent Left</span>
                    <button type="button" onClick={() => void execCmd('doc-paragraph-setting.command', { paragraph: { indentStart: 0 } }, 'Left indent: 0pt')} className="px-2 py-0.5 bg-white border border-[#c8c6c4] hover:bg-[#edebe9]">0 pt</button>
                    <button type="button" onClick={() => void execCmd('doc-paragraph-setting.command', { paragraph: { indentStart: 36 } }, 'Left indent: 36pt')} className="px-2 py-0.5 bg-white border border-[#c8c6c4] hover:bg-[#edebe9]">36 pt</button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-14 text-[#555]">Spacing</span>
                    <button type="button" onClick={() => void execCmd('doc-paragraph-setting.command', { paragraph: { spaceAbove: 0, spaceBelow: 0 } }, 'Compact spacing')} className="px-2 py-0.5 bg-white border border-[#c8c6c4] hover:bg-[#edebe9]">0 pt</button>
                    <button type="button" onClick={() => void execCmd('doc-paragraph-setting.command', { paragraph: { spaceAbove: 8, spaceBelow: 8 } }, 'Standard spacing')} className="px-2 py-0.5 bg-white border border-[#c8c6c4] hover:bg-[#edebe9]">8 pt</button>
                  </div>
                </div>
              </RibbonGroup>
            </>
          )}

          {activeTab === 'References' && (
            <RibbonGroup label="Table of Contents & Headings">
              <button type="button" onClick={() => void applyWordStyle(WORD_STYLES_PAGE_1[2])} className="h-[62px] px-3 flex flex-col items-center justify-center rounded-[2px] hover:bg-[#e1dfdd] text-[11px] cursor-default">
                <span className="text-[15px] font-bold text-[#2b579a]">H1</span>
                <span>Heading 1</span>
              </button>
              <button type="button" onClick={() => void applyWordStyle(WORD_STYLES_PAGE_1[3])} className="h-[62px] px-3 flex flex-col items-center justify-center rounded-[2px] hover:bg-[#e1dfdd] text-[11px] cursor-default">
                <span className="text-[15px] font-bold text-[#2b579a]">H2</span>
                <span>Heading 2</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  const doc = univerApi?.getActiveDocument();
                  if (doc) {
                    const offset = Math.max(0, (doc.getBody()?.dataStream.length ?? 2) - 2);
                    doc.insertText(offset, '[1] ');
                    onStatus('Inserted footnote marker [1]');
                  }
                }}
                className="h-[62px] px-3 flex flex-col items-center justify-center rounded-[2px] hover:bg-[#e1dfdd] text-[11px] cursor-default"
              >
                <span className="text-[15px] font-serif text-[#2b579a]">AB¹</span>
                <span>Insert Footnote</span>
              </button>
            </RibbonGroup>
          )}

          {activeTab === 'Mailings' && (
            <RibbonGroup label="Write & Insert Fields">
              {['«FirstName»', '«LastName»', '«Company»', '«Email»'].map((token) => (
                <button
                  key={token}
                  type="button"
                  onClick={() => {
                    const doc = univerApi?.getActiveDocument();
                    if (doc) {
                      const offset = Math.max(0, (doc.getBody()?.dataStream.length ?? 2) - 2);
                      doc.insertText(offset, `${token} `);
                      onStatus(`Inserted field ${token}`);
                    }
                  }}
                  className="h-[62px] px-2.5 flex flex-col items-center justify-center rounded-[2px] hover:bg-[#e1dfdd] text-[11px] cursor-default"
                >
                  <span className="text-[13px] font-mono text-[#2b579a]">{token}</span>
                  <span className="text-[10px] text-[#555]">Merge Field</span>
                </button>
              ))}
            </RibbonGroup>
          )}

          {activeTab === 'Review' && (
            <RibbonGroup label="Proofing">
              <button
                type="button"
                onClick={() => {
                  const txt = getBodyPlainText().trim();
                  const words = txt ? txt.split(/\s+/).length : 0;
                  const chars = txt.length;
                  onStatus(`Word Count: ${words} words, ${chars} chars`);
                }}
                className="h-[62px] px-3 flex flex-col items-center justify-center rounded-[2px] hover:bg-[#e1dfdd] text-[11px] cursor-default"
              >
                <span className="text-[16px] font-semibold text-[#2b579a]">123</span>
                <span>Word Count</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setFindModalOpen(true);
                  setReplaceMode(true);
                }}
                className="h-[62px] px-3 flex flex-col items-center justify-center rounded-[2px] hover:bg-[#e1dfdd] text-[11px] cursor-default"
              >
                <span className="text-[16px] font-semibold text-[#2b579a]">ABC✓</span>
                <span>Find & Replace</span>
              </button>
            </RibbonGroup>
          )}

          {activeTab === 'View' && (
            <>
              <RibbonGroup label="Show">
                <label className="h-[62px] px-2.5 flex items-center gap-1.5 text-[11.5px] cursor-default">
                  <input type="checkbox" checked={showRuler} onChange={(e) => setShowRuler(e.target.checked)} />
                  <span>Ruler</span>
                </label>
              </RibbonGroup>
              <RibbonGroup label="Zoom">
                {[75, 100, 125, 150].map((pct) => (
                  <button
                    key={pct}
                    type="button"
                    onClick={() => {
                      setZoomPct(pct);
                      void execCmd(SetDocZoomRatioCommand.id, { zoomRatio: pct / 100 }, `Zoom ${pct}%`);
                    }}
                    className={`h-[62px] px-3 flex flex-col items-center justify-center rounded-[2px] text-[11px] cursor-default ${
                      zoomPct === pct ? 'bg-[#c7d7ee] border border-[#9db9e2]' : 'hover:bg-[#e1dfdd]'
                    }`}
                  >
                    <span className="text-[14px] font-semibold text-[#2b579a]">{pct}%</span>
                    <span>Zoom</span>
                  </button>
                ))}
              </RibbonGroup>
            </>
          )}

          {activeTab === 'Help' && (
            <RibbonGroup label="Word Help">
              <div className="flex flex-col justify-center gap-1 px-2 text-[11px] text-[#444]">
                <div><strong>Shortcuts:</strong> Ctrl+B (Bold), Ctrl+I (Italic), Ctrl+U (Underline), Ctrl+Z (Undo), Ctrl+Y (Redo)</div>
                <div><strong>Files:</strong> Save to Win 10 Documents (.unidoc) or Export .docx directly to your PC.</div>
              </div>
            </RibbonGroup>
          )}
        </div>
      )}

      {/* 4. Horizontal Word Ruler Bar */}
      {showRuler && (
        <div className="h-[22px] bg-[#e6e6e6] flex items-center relative px-2">
          {/* Left Tab Stop Indicator */}
          <div
            title="Left Tab"
            className="w-[14px] h-[14px] bg-white border border-[#9e9e9e] flex items-center justify-center text-[9px] text-[#333] font-bold shrink-0"
          >
            L
          </div>

          {/* Centered Printable Ruler Strip matching Word Page */}
          <div className="flex-1 flex justify-center overflow-hidden px-4">
            <div className="w-full max-w-[760px] h-[14px] flex items-center relative bg-[#bdbdbd] border-y border-[#a6a6a6]">
              <div
                style={{ left: `${leftMarginPct}%`, right: `${rightMarginPct}%` }}
                className="absolute top-0 bottom-0 bg-white flex items-center justify-between px-1"
              >
                {/* Left Indent Markers */}
                <span
                  title="First Line / Hanging Indent"
                  className="absolute -left-[4px] top-0 w-0 h-0 border-l-[4px] border-r-[4px] border-t-[5px] border-l-transparent border-r-transparent border-t-[#555]"
                />
                <span
                  title="Left Indent"
                  className="absolute -left-[4px] bottom-0 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[5px] border-l-transparent border-r-transparent border-b-[#555]"
                />
                {/* Right Indent Marker */}
                <span
                  title="Right Indent"
                  className="absolute -right-[4px] bottom-0 w-0 h-0 border-l-[4px] border-r-[4px] border-b-[5px] border-l-transparent border-r-transparent border-b-[#555]"
                />

                {['1', '2', '3', '4', '5', '6', '7'].map((inch) => (
                  <div key={inch} className="flex items-center justify-between flex-1 px-1 text-[9px] text-[#444] leading-none">
                    <span className="h-[3px] w-[1px] bg-[#888]" />
                    <span className="h-[5px] w-[1px] bg-[#666]" />
                    <span className="h-[3px] w-[1px] bg-[#888]" />
                    <span>{inch}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 5. Find & Replace Modal */}
      {findModalOpen && (
        <div className="absolute right-4 top-[156px] z-50 w-[300px] bg-white border border-[#c8c6c4] shadow-xl p-3 text-[12px]">
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-[#2b579a]">
              {replaceMode ? 'Find and Replace' : 'Find in Document'}
            </span>
            <button
              type="button"
              onClick={() => setFindModalOpen(false)}
              className="px-1 text-[#666] hover:text-black cursor-default"
            >
              ✕
            </button>
          </div>
          <form onSubmit={handleFindNext} className="space-y-2">
            <input
              type="text"
              value={findQuery}
              onChange={(e) => { setFindQuery(e.target.value); setLastMatchOffset(0); }}
              placeholder="Find what…"
              autoFocus
              className="w-full h-[26px] px-2 border border-[#c8c6c4] outline-none focus:border-[#2b579a]"
            />
            {replaceMode && (
              <input
                type="text"
                value={replaceQuery}
                onChange={(e) => setReplaceQuery(e.target.value)}
                placeholder="Replace with…"
                className="w-full h-[26px] px-2 border border-[#c8c6c4] outline-none focus:border-[#2b579a]"
              />
            )}
            <div className="flex items-center justify-end gap-1.5 pt-1">
              <button type="submit" className="px-2.5 py-1 bg-[#2b579a] text-white hover:bg-[#234781] rounded-[2px] cursor-default">
                Find Next
              </button>
              {replaceMode && (
                <>
                  <button type="button" onClick={handleReplaceOne} className="px-2.5 py-1 bg-[#f3f2f1] border border-[#c8c6c4] hover:bg-[#e1dfdd] rounded-[2px] cursor-default">
                    Replace
                  </button>
                  <button type="button" onClick={handleReplaceAll} className="px-2.5 py-1 bg-[#f3f2f1] border border-[#c8c6c4] hover:bg-[#e1dfdd] rounded-[2px] cursor-default">
                    All
                  </button>
                </>
              )}
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
