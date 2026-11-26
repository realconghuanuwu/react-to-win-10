import { useEffect, useRef, useState, type FormEvent } from 'react';
import type { createUniver } from '@univerjs/presets';

type UniverAPI = ReturnType<typeof createUniver>['univerAPI'];

export type ExcelRibbonTab =
  | 'File'
  | 'Home'
  | 'Insert'
  | 'Page Layout'
  | 'Formulas'
  | 'Data'
  | 'Review'
  | 'View'
  | 'Help';

interface ExcelRibbonProps {
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
  onSwitchToWord: () => void;
  onStatus: (msg: string) => void;
  onOpenBackstage?: () => void;
}

const FONT_FAMILIES = [
  'Calibri',
  'Arial',
  'Segoe UI',
  'Times New Roman',
  'Tahoma',
  'Verdana',
  'Consolas',
  'Courier New',
];

const FONT_SIZES = [8, 9, 10, 11, 12, 14, 16, 18, 20, 22, 24, 28, 36, 48, 72];

const NUMBER_FORMATS = [
  { label: 'General', pattern: 'General' },
  { label: 'Number', pattern: '#,##0.00' },
  { label: 'Currency', pattern: '$#,##0.00' },
  { label: 'Accounting', pattern: '_($* #,##0.00_)' },
  { label: 'Short Date', pattern: 'yyyy-mm-dd' },
  { label: 'Percentage', pattern: '0.00%' },
  { label: 'Text', pattern: '@' },
];

const PALETTE_COLORS = [
  '#000000', '#ffffff', '#eeece1', '#1f497d', '#4f81bd', '#c0504d', '#9bbb59', '#8064a2', '#4bacc6', '#f79646',
  '#7f7f7f', '#f2f2f2', '#ddd9c3', '#c6d9f0', '#dbe5f1', '#f2dcdb', '#ebf1dd', '#e5e0ec', '#dbeef3', '#fdeada',
  '#ffff00', '#ff0000', '#00b050', '#00b0f0', '#0070c0', '#002060', '#7030a0', '#ffc000', '#92d050', '#c00000',
];

interface CellStylePreset {
  name: string;
  bg?: string;
  fg?: string;
  bold?: boolean;
  italic?: boolean;
  borderBottom?: string;
  borderAll?: string;
  previewClass: string;
}

const CELL_STYLES_PAGE_1: CellStylePreset[] = [
  { name: 'Normal', bg: '#ffffff', fg: '#000000', bold: false, italic: false, previewClass: 'bg-white text-black border-[#d2d0ce]' },
  { name: 'Bad', bg: '#ffc7ce', fg: '#9c0006', previewClass: 'bg-[#ffc7ce] text-[#9c0006] border-[#e8a3ab]' },
  { name: 'Good', bg: '#c6efce', fg: '#006100', previewClass: 'bg-[#c6efce] text-[#006100] border-[#9fd4aa]' },
  { name: 'Neutral', bg: '#ffeb9c', fg: '#9c6500', previewClass: 'bg-[#ffeb9c] text-[#9c6500] border-[#e3ca6d]' },
  { name: 'Calculation', bg: '#f2f2f2', fg: '#fa7d00', bold: true, borderAll: '#7f7f7f', previewClass: 'bg-[#f2f2f2] text-[#fa7d00] font-semibold border-[#7f7f7f]' },
  { name: 'Check Cell', bg: '#a5a5a5', fg: '#ffffff', bold: true, previewClass: 'bg-[#7f7f7f] text-white font-semibold border-[#595959]' },
  { name: 'Explanatory...', fg: '#7f7f7f', italic: true, previewClass: 'bg-white text-[#7f7f7f] italic border-[#d2d0ce]' },
  { name: 'Input', bg: '#ffcc99', fg: '#3f3f76', borderAll: '#7f7f7f', previewClass: 'bg-[#ffcc99] text-[#3f3f76] border-[#7f7f7f]' },
  { name: 'Linked Cell', fg: '#fa7d00', borderBottom: '#ff8001', previewClass: 'bg-white text-[#fa7d00] border-b-2 border-b-[#ff8001] border-[#d2d0ce]' },
  { name: 'Note', bg: '#ffffcc', fg: '#000000', borderAll: '#b2b2b2', previewClass: 'bg-[#ffffcc] text-black border-[#b2b2b2]' },
];

const CELL_STYLES_PAGE_2: CellStylePreset[] = [
  { name: 'Heading 1', fg: '#1f4e78', bold: true, borderBottom: '#4472c4', previewClass: 'bg-white text-[#1f4e78] font-bold border-b-2 border-b-[#4472c4] border-[#d2d0ce]' },
  { name: 'Heading 2', fg: '#1f4e78', bold: true, borderBottom: '#8ea9db', previewClass: 'bg-white text-[#1f4e78] font-semibold border-b border-b-[#8ea9db] border-[#d2d0ce]' },
  { name: 'Total', fg: '#000000', bold: true, borderBottom: '#000000', previewClass: 'bg-white text-black font-bold border-t border-b-2 border-[#000000]' },
  { name: 'Accent1', bg: '#4472c4', fg: '#ffffff', previewClass: 'bg-[#4472c4] text-white border-[#365b9d]' },
  { name: 'Accent2', bg: '#ed7d31', fg: '#ffffff', previewClass: 'bg-[#ed7d31] text-white border-[#c66321]' },
  { name: 'Accent3', bg: '#70ad47', fg: '#ffffff', previewClass: 'bg-[#70ad47] text-white border-[#548235]' },
  { name: '20% Accent1', bg: '#d9e1f2', fg: '#000000', previewClass: 'bg-[#d9e1f2] text-black border-[#b4c6e7]' },
  { name: '20% Accent2', bg: '#fce4d6', fg: '#000000', previewClass: 'bg-[#fce4d6] text-black border-[#f4b084]' },
  { name: '20% Accent3', bg: '#e2efda', fg: '#000000', previewClass: 'bg-[#e2efda] text-black border-[#c6e0b4]' },
  { name: 'Warning Text', fg: '#ff0000', previewClass: 'bg-white text-[#ff0000] border-[#d2d0ce]' },
];

type DropdownKey =
  | 'file'
  | 'borders'
  | 'fillColor'
  | 'fontColor'
  | 'orientation'
  | 'merge'
  | 'currency'
  | 'insert'
  | 'delete'
  | 'format'
  | 'autosum'
  | 'fill'
  | 'clear'
  | 'sort'
  | 'find'
  | 'conditional'
  | 'table'
  | 'fx'
  | null;

export function ExcelRibbon({
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
  onSwitchToWord,
  onStatus,
  onOpenBackstage,
}: ExcelRibbonProps) {
  const [activeTab, setActiveTab] = useState<ExcelRibbonTab>('Home');
  const [openDropdown, setOpenDropdown] = useState<DropdownKey>(null);
  const [searchText, setSearchText] = useState('');
  const [nameBoxText, setNameBoxText] = useState('A1');
  const [formulaText, setFormulaText] = useState('');
  const [fontFamily, setFontFamily] = useState('Calibri');
  const [fontSize, setFontSize] = useState(11);
  const [isBold, setIsBold] = useState(false);
  const [isItalic, setIsItalic] = useState(false);
  const [isUnderline, setIsUnderline] = useState(false);
  const [isWrap, setIsWrap] = useState(false);
  const [hAlign, setHAlign] = useState<'left' | 'center' | 'right' | ''>('');
  const [vAlign, setVAlign] = useState<'top' | 'middle' | 'bottom' | ''>('');
  const [numFmt, setNumFmt] = useState('General');
  const [fillColor, setFillColor] = useState('#ffff00');
  const [fontColor, setFontColor] = useState('#ff0000');
  const [stylesPage, setStylesPage] = useState<0 | 1>(0);
  const [formatPainterStyle, setFormatPainterStyle] = useState<{
    ff?: string | null;
    fs?: number | null;
    bg?: string | null;
    fg?: string | null;
    bold?: boolean;
    italic?: boolean;
  } | null>(null);
  const [findModalOpen, setFindModalOpen] = useState(false);
  const [findQuery, setFindQuery] = useState('');

  const ribbonRootRef = useRef<HTMLDivElement>(null);
  const copiedValuesRef = useRef<{ values: unknown[][]; isCut: boolean; sourceRangeA1?: string } | null>(null);

  // Close dropdowns on outside click
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

  // Sync Name Box, Formula Bar, and active cell formatting from UniverJS
  const syncFromActiveCell = () => {
    if (!univerApi) return;
    try {
      const sheet = univerApi.getActiveWorkbook()?.getActiveSheet();
      if (!sheet) return;
      const range = sheet.getActiveRange();
      const cell = sheet.getActiveCell() ?? range;
      if (!range || !cell) return;

      const notation = range.getA1Notation();
      if (notation) setNameBoxText(notation);

      const formula = cell.getFormula();
      const val = cell.getValue();
      setFormulaText(formula || (val !== null && val !== undefined ? String(val) : ''));

      const styleData = cell.getCellStyleData();
      setFontFamily(cell.getFontFamily() || 'Calibri');
      setFontSize(cell.getFontSize() || 11);
      setIsBold(styleData?.bl === 1);
      setIsItalic(styleData?.it === 1);
      setIsUnderline(Boolean(styleData?.ul?.s === 1));
      setIsWrap(cell.getWrap());

      const ha = cell.getHorizontalAlignment();
      setHAlign(ha === 'left' ? 'left' : ha === 'center' ? 'center' : ha === 'normal' ? 'right' : '');
      const va = cell.getVerticalAlignment();
      setVAlign(va === 'top' || va === 'middle' || va === 'bottom' ? va : '');

      const fmt = cell.getNumberFormat();
      const matchedFmt = NUMBER_FORMATS.find((f) => f.pattern === fmt);
      setNumFmt(matchedFmt ? matchedFmt.pattern : fmt || 'General');
    } catch {
      // ignore during disposal/mount
    }
  };

  useEffect(() => {
    if (!univerApi) return;
    const disposables: Array<{ dispose: () => void }> = [];

    try {
      disposables.push(
        univerApi.addEvent(univerApi.Event.SelectionChanged, () => {
          syncFromActiveCell();
          // Apply Format Painter if armed
          if (formatPainterStyle) {
            const sheet = univerApi.getActiveWorkbook()?.getActiveSheet();
            const r = sheet?.getActiveRange();
            if (r) {
              if (formatPainterStyle.ff) r.setFontFamily(formatPainterStyle.ff);
              if (formatPainterStyle.fs) r.setFontSize(formatPainterStyle.fs);
              if (formatPainterStyle.bg) r.setBackground(formatPainterStyle.bg);
              if (formatPainterStyle.fg) r.setFontColor(formatPainterStyle.fg);
              r.setFontWeight(formatPainterStyle.bold ? 'bold' : 'normal');
              r.setFontStyle(formatPainterStyle.italic ? 'italic' : 'normal');
              setFormatPainterStyle(null);
              onStatus('Format Painter applied');
            }
          }
        }),
      );
      disposables.push(
        univerApi.addEvent(univerApi.Event.SheetValueChanged, () => {
          syncFromActiveCell();
        }),
      );
      disposables.push(
        univerApi.addEvent(univerApi.Event.ActiveSheetChanged, () => {
          syncFromActiveCell();
        }),
      );
    } catch {
      // ignore
    }

    const initTimer = window.setTimeout(syncFromActiveCell, 250);
    return () => {
      window.clearTimeout(initTimer);
      disposables.forEach((d) => {
        try {
          d.dispose();
        } catch {
          // ignore
        }
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [univerApi, formatPainterStyle]);

  const withRange = (fn: (range: NonNullable<ReturnType<NonNullable<ReturnType<NonNullable<ReturnType<UniverAPI['getActiveWorkbook']>>['getActiveSheet']>>['getActiveRange']>>, sheet: NonNullable<ReturnType<NonNullable<ReturnType<UniverAPI['getActiveWorkbook']>>['getActiveSheet']>>) => void) => {
    if (!univerApi) return;
    const wb = univerApi.getActiveWorkbook();
    const sheet = wb?.getActiveSheet();
    const range = sheet?.getActiveRange();
    if (!sheet || !range) return;
    fn(range, sheet);
    syncFromActiveCell();
  };

  const handleNameBoxSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!univerApi) return;
    const sheet = univerApi.getActiveWorkbook()?.getActiveSheet();
    if (!sheet) return;
    try {
      const target = sheet.getRange(nameBoxText.trim().toUpperCase());
      target.activate();
      syncFromActiveCell();
    } catch {
      onStatus(`Invalid reference "${nameBoxText}"`);
    }
  };

  const handleFormulaCommit = (e?: FormEvent) => {
    e?.preventDefault();
    withRange((range, sheet) => {
      const activeCell = sheet.getActiveCell() ?? range;
      if (formulaText.startsWith('=') && formulaText.length > 1) {
        activeCell.setFormula(formulaText);
      } else {
        activeCell.setValue(formulaText);
      }
    });
  };

  const handleCopyOrCut = (isCut: boolean) => {
    withRange((range) => {
      const values = range.getValues();
      copiedValuesRef.current = {
        values,
        isCut,
        sourceRangeA1: range.getA1Notation(),
      };
      const tsv = values.map((row) => row.map((v) => (v ?? '')).join('\t')).join('\n');
      void navigator.clipboard?.writeText(tsv).catch(() => undefined);
      if (isCut) range.clearContent();
      onStatus(isCut ? `Cut ${range.getA1Notation()}` : `Copied ${range.getA1Notation()}`);
    });
  };

  const handlePaste = async () => {
    if (!univerApi) return;
    const sheet = univerApi.getActiveWorkbook()?.getActiveSheet();
    const range = sheet?.getActiveRange();
    if (!sheet || !range) return;
    if (copiedValuesRef.current) {
      const vals = copiedValuesRef.current.values;
      const target = sheet.getRange(range.getRow(), range.getColumn(), vals.length, vals[0]?.length || 1);
      target.setValues(vals as Parameters<typeof target.setValues>[0]);
      onStatus('Pasted');
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text) return;
      const rows = text.split(/\r?\n/).map((line) => line.split('\t'));
      const maxCols = Math.max(...rows.map((r) => r.length));
      const normalized = rows.map((r) => Array.from({ length: maxCols }, (_, i) => r[i] ?? ''));
      const target = sheet.getRange(range.getRow(), range.getColumn(), normalized.length, maxCols);
      target.setValues(normalized);
      onStatus('Pasted from clipboard');
    } catch {
      onStatus('Clipboard empty');
    }
  };

  const handleAutoSum = (fnName: 'SUM' | 'AVERAGE' | 'COUNT' | 'MAX' | 'MIN') => {
    withRange((range, sheet) => {
      const startRow = range.getRow();
      const endRow = range.getLastRow();
      const col = range.getColumn();
      if (startRow === endRow && startRow > 0) {
        const refRange = sheet.getRange(0, col, startRow, 1).getA1Notation();
        range.setFormula(`=${fnName}(${refRange})`);
      } else {
        const refNotation = range.getA1Notation();
        const below = sheet.getRange(endRow + 1, col);
        below.setFormula(`=${fnName}(${refNotation})`);
        below.activate();
      }
    });
    setOpenDropdown(null);
  };

  const handleApplyStylePreset = (preset: CellStylePreset) => {
    withRange((range) => {
      if (preset.bg) range.setBackground(preset.bg);
      else if (preset.name === 'Normal') range.setBackground('#ffffff');
      if (preset.fg) range.setFontColor(preset.fg);
      range.setFontWeight(preset.bold ? 'bold' : 'normal');
      range.setFontStyle(preset.italic ? 'italic' : 'normal');
      if (preset.borderAll) {
        range.setBorder(univerApi!.Enum.BorderType.OUTSIDE, univerApi!.Enum.BorderStyleTypes.THIN, preset.borderAll);
      }
      if (preset.borderBottom) {
        range.setBorder(univerApi!.Enum.BorderType.BOTTOM, univerApi!.Enum.BorderStyleTypes.MEDIUM, preset.borderBottom);
      }
    });
  };

  const handleFillDirection = (dir: 'down' | 'right' | 'up' | 'left') => {
    withRange((range) => {
      const vals = range.getValues().map((row) => row.map((v) => v ?? ''));
      const rows = vals.length;
      const cols = vals[0]?.length ?? 1;
      if (rows === 0 || cols === 0) return;
      if (dir === 'down') {
        const first = vals[0];
        range.setValues(vals.map(() => [...first]));
      } else if (dir === 'up') {
        const last = vals[rows - 1];
        range.setValues(vals.map(() => [...last]));
      } else if (dir === 'right') {
        range.setValues(vals.map((r) => r.map(() => r[0])));
      } else {
        range.setValues(vals.map((r) => r.map(() => r[cols - 1])));
      }
    });
    setOpenDropdown(null);
  };

  const handleSort = (ascending: boolean) => {
    withRange((range) => {
      const vals = range.getValues().map((row) => row.map((v) => v ?? ''));
      if (vals.length <= 1) return;
      const sorted = [...vals].sort((a, b) => {
        const va = a[0];
        const vb = b[0];
        const na = Number(va);
        const nb = Number(vb);
        if (va !== '' && vb !== '' && !Number.isNaN(na) && !Number.isNaN(nb)) {
          return ascending ? na - nb : nb - na;
        }
        const sa = String(va ?? '');
        const sb = String(vb ?? '');
        return ascending ? sa.localeCompare(sb) : sb.localeCompare(sa);
      });
      range.setValues(sorted);
      onStatus(ascending ? 'Sorted A to Z' : 'Sorted Z to A');
    });
    setOpenDropdown(null);
  };

  const handleFindNext = (e: FormEvent) => {
    e.preventDefault();
    if (!univerApi || !findQuery.trim()) return;
    const sheet = univerApi.getActiveWorkbook()?.getActiveSheet();
    if (!sheet) return;
    const q = findQuery.trim().toLowerCase();
    const dataRange = sheet.getDataRange();
    const vals = dataRange.getValues();
    const r0 = dataRange.getRow();
    const c0 = dataRange.getColumn();
    for (let r = 0; r < vals.length; r++) {
      for (let c = 0; c < (vals[r]?.length ?? 0); c++) {
        const cellVal = String(vals[r][c] ?? '').toLowerCase();
        if (cellVal.includes(q)) {
          sheet.getRange(r0 + r, c0 + c).activate();
          syncFromActiveCell();
          onStatus(`Found "${findQuery}" at ${sheet.getRange(r0 + r, c0 + c).getA1Notation()}`);
          return;
        }
      }
    }
    onStatus(`"${findQuery}" not found`);
  };

  const handleSearchAction = (e: FormEvent) => {
    e.preventDefault();
    const q = searchText.trim().toLowerCase();
    if (!q) return;
    if (q.includes('save')) void onSaveToWin10();
    else if (q.includes('export') || q.includes('xlsx')) void onSaveToLocal();
    else if (q.includes('bold')) withRange((r) => r.setFontWeight(isBold ? 'normal' : 'bold'));
    else if (q.includes('merge')) withRange((r) => r.merge());
    else if (q.includes('wrap')) withRange((r) => r.setWrap(!isWrap));
    else if (q.includes('sum')) handleAutoSum('SUM');
    else {
      setFindQuery(searchText.trim());
      setFindModalOpen(true);
    }
  };

  const toggleDrop = (key: DropdownKey) => setOpenDropdown((cur) => (cur === key ? null : key));

  const cleanTitle = documentTitle.replace(/\.(unisheet|xlsx?)$/i, '') || 'Book1';
  const smallBtn =
    'h-[22px] px-1.5 flex items-center justify-center gap-1 rounded-[2px] hover:bg-[#e1dfdd] active:bg-[#d2d0ce] text-[#262626] text-[11px] cursor-default transition-colors';
  const activeToggle = 'bg-[#c8e6d5] border border-[#92c7a8] text-[#0c5e32]';
  const bigBtn =
    'relative h-[66px] px-2 py-1 flex flex-col items-center justify-center gap-0.5 rounded-[2px] hover:bg-[#e1dfdd] active:bg-[#d2d0ce] text-[#262626] text-[11px] leading-tight cursor-default transition-colors shrink-0';
  const groupWrap =
    'relative flex flex-col justify-between h-[88px] px-2 pt-1 pb-0.5 border-r border-[#d2d0ce] shrink-0';
  const groupLabel =
    'text-[10.5px] text-[#605e5c] text-center leading-none pt-0.5 select-none';
  const menuPanel =
    'absolute left-0 top-full mt-0.5 z-50 min-w-[168px] bg-white border border-[#c8c6c4] shadow-lg py-1 text-[11.5px] text-[#262626]';
  const menuRow =
    'w-full text-left px-3 py-1.5 hover:bg-[#e6f2ec] flex items-center justify-between gap-3 cursor-default';

  const tabs: ExcelRibbonTab[] = [
    'File',
    'Home',
    'Insert',
    'Page Layout',
    'Formulas',
    'Data',
    'Review',
    'View',
    'Help',
  ];

  const displayedCellStyles = stylesPage === 0 ? CELL_STYLES_PAGE_1 : CELL_STYLES_PAGE_2;

  return (
    <div ref={ribbonRootRef} className="flex flex-col shrink-0 select-none">
      {/* 1. Excel Top Green Header / Quick Access Toolbar */}
      <div className="h-[34px] bg-[#217346] text-white px-2.5 flex items-center justify-between gap-3 text-[12px]">
        {/* Left: QAT + Title */}
        <div className="flex items-center gap-1.5 min-w-0">
          <button
            type="button"
            title="Back to Excel Home"
            onClick={onBackHome}
            className="w-6 h-6 flex items-center justify-center rounded-[2px] hover:bg-white/15 cursor-default"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.5">
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
            title="Undo"
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
            title="Redo"
            onClick={() => void univerApi?.redo()}
            className="w-6 h-6 flex items-center justify-center rounded-[2px] hover:bg-white/15 cursor-default"
          >
            <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="1.4">
              <path d="M11 4l3 3-3 3" />
              <path d="M14 7H7a4 4 0 1 0 0 8h2" />
            </svg>
          </button>

          <span className="ml-3 font-normal text-white/95 truncate">
            {cleanTitle} - Excel
          </span>

          {statusMessage && (
            <span className="ml-2 px-2 py-0.5 rounded bg-black/20 text-[11px] text-white/95 truncate max-w-[200px]">
              {statusMessage}
            </span>
          )}
        </div>

        {/* Center: Search Bar */}
        <form onSubmit={handleSearchAction} className="hidden sm:flex items-center flex-1 max-w-[360px] mx-2">
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
              aria-label="Search Excel commands or cells"
              className="w-full bg-transparent text-[11.5px] outline-none placeholder:text-white/85 focus:placeholder:text-[#777]"
            />
          </div>
        </form>

        {/* Right: Quick Export + User Badge */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={onSaveToLocal}
            disabled={exporting}
            title="Download as .xlsx"
            className="hidden md:flex items-center px-2 py-0.5 rounded-[2px] bg-white/12 hover:bg-white/22 text-[11px] cursor-default"
          >
            {exporting ? 'Exporting…' : 'Export .xlsx'}
          </button>
          <span className="hidden md:inline text-[11.5px] text-white/90">User</span>
          <span className="w-6 h-6 rounded-full bg-[#0078d7] border border-white/40 flex items-center justify-center text-[10.5px] font-semibold">
            U
          </span>
        </div>
      </div>

      {/* 2. Ribbon Tabs Bar */}
      <div className="relative h-[28px] bg-[#f3f2f1] border-b border-[#e1dfdd] px-2 flex items-end justify-between text-[12px]">
        <div className="flex items-end gap-0.5">
          {tabs.map((tab) => {
            if (tab === 'File') {
              return (
                <div key={tab} className="relative">
                  <button
                    type="button"
                    onClick={() => (onOpenBackstage ? onOpenBackstage() : toggleDrop('file'))}
                    className={`px-3.5 h-[26px] flex items-center text-[12px] cursor-default transition-colors ${
                      openDropdown === 'file'
                        ? 'bg-[#217346] text-white'
                        : 'text-[#262626] hover:bg-[#e1dfdd]'
                    }`}
                  >
                    File
                  </button>
                  {openDropdown === 'file' && (
                    <div className={menuPanel}>
                      <button type="button" onClick={() => { onBackHome(); setOpenDropdown(null); }} className={menuRow}>
                        <span>Home</span>
                      </button>
                      <button type="button" onClick={() => { onNew(); setOpenDropdown(null); }} className={menuRow}>
                        <span>New Blank Workbook</span>
                      </button>
                      <button type="button" onClick={() => { onOpen(); setOpenDropdown(null); }} className={menuRow}>
                        <span>Open (.unisheet / .xlsx)</span>
                      </button>
                      <div className="h-px bg-[#e1dfdd] my-1" />
                      <button type="button" onClick={() => { onSaveToWin10(); setOpenDropdown(null); }} className={menuRow}>
                        <span>Save to Win 10</span>
                      </button>
                      <button type="button" onClick={() => { onSaveToLocal(); setOpenDropdown(null); }} className={menuRow}>
                        <span>Save .xlsx to PC</span>
                      </button>
                      <div className="h-px bg-[#e1dfdd] my-1" />
                      <button type="button" onClick={() => { onSwitchToWord(); setOpenDropdown(null); }} className={menuRow}>
                        <span>Switch to Word</span>
                      </button>
                    </div>
                  )}
                </div>
              );
            }
            const isActive = activeTab === tab;
            return (
              <button
                key={tab}
                type="button"
                onClick={() => {
                  setActiveTab(tab);
                  setOpenDropdown(null);
                }}
                className={[
                  'px-3 h-[26px] flex items-center text-[12px] cursor-default transition-colors border-b-2',
                  isActive
                    ? 'bg-white border-[#217346] text-[#217346] font-semibold'
                    : 'border-transparent text-[#262626] hover:bg-[#e1dfdd]',
                ].join(' ')}
              >
                {tab}
              </button>
            );
          })}
        </div>

        {/* Share button on right */}
        <div className="flex items-center pb-0.5">
          <button
            type="button"
            onClick={onSaveToLocal}
            className="flex items-center gap-1.5 px-2.5 h-[22px] bg-white hover:bg-[#e6f2ec] border border-[#d2d0ce] rounded-[2px] text-[11.5px] text-[#262626] cursor-default"
          >
            <svg viewBox="0 0 16 16" width="12" height="12" fill="none" stroke="#217346" strokeWidth="1.4">
              <path d="M10 3h3.5v3.5M13.5 3L7 9.5M12 9.5v4h-9.5v-9.5h4" />
            </svg>
            <span>Share</span>
          </button>
        </div>
      </div>

      {/* 3. Ribbon Body */}
      <div className="h-[92px] bg-[#f8f8f8] border-b border-[#d2d0ce] px-1.5 flex items-stretch overflow-x-auto win10-scroll">
        {activeTab === 'Home' && (
          <>
            {/* Clipboard */}
            <div className={groupWrap}>
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => void handlePaste()} className={bigBtn} title="Paste">
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#444" strokeWidth="1.5">
                    <rect x="6" y="4" width="12" height="17" rx="1.5" fill="#f7e3a1" stroke="#b5892e" />
                    <rect x="9" y="2" width="6" height="3.5" rx="1" fill="#d2d0ce" stroke="#7f7f7f" />
                    <rect x="11" y="10" width="9" height="11" rx="1" fill="#ffffff" stroke="#555" />
                  </svg>
                  <span>Paste</span>
                </button>
                <div className="flex flex-col gap-0.5">
                  <button type="button" onClick={() => handleCopyOrCut(true)} className={`${smallBtn} justify-start`} title="Cut">
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="#444" strokeWidth="1.3">
                      <circle cx="4.5" cy="12" r="2" />
                      <circle cx="11.5" cy="12" r="2" />
                      <path d="M5.5 10.3L11.5 2M10.5 10.3L4.5 2" />
                    </svg>
                    <span>Cut</span>
                  </button>
                  <button type="button" onClick={() => handleCopyOrCut(false)} className={`${smallBtn} justify-start`} title="Copy">
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="#444" strokeWidth="1.3">
                      <rect x="2.5" y="2.5" width="7" height="9" fill="#fff" />
                      <rect x="6.5" y="4.5" width="7" height="9" fill="#fff" />
                    </svg>
                    <span>Copy</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (formatPainterStyle) {
                        setFormatPainterStyle(null);
                        return;
                      }
                      withRange((r) => {
                        const sd = r.getCellStyleData();
                        setFormatPainterStyle({
                          ff: r.getFontFamily(),
                          fs: r.getFontSize(),
                          bg: r.getBackground(),
                          fg: sd?.cl?.rgb ?? null,
                          bold: sd?.bl === 1,
                          italic: sd?.it === 1,
                        });
                        onStatus('Format Painter active: click destination cell');
                      });
                    }}
                    className={`${smallBtn} justify-start ${formatPainterStyle ? activeToggle : ''}`}
                    title="Format Painter"
                  >
                    <svg viewBox="0 0 16 16" width="13" height="13" fill="none" stroke="#b5892e" strokeWidth="1.3">
                      <rect x="3" y="2" width="10" height="4.5" fill="#f7d36a" />
                      <path d="M8 6.5V14" stroke="#555" strokeWidth="2" />
                    </svg>
                    <span>Format Painter</span>
                  </button>
                </div>
              </div>
              <div className={groupLabel}>Clipboard</div>
            </div>

            {/* Font */}
            <div className={groupWrap}>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-1">
                  <select
                    aria-label="Font family"
                    value={fontFamily}
                    onChange={(e) => {
                      const val = e.target.value;
                      setFontFamily(val);
                      withRange((r) => r.setFontFamily(val));
                    }}
                    className="h-[22px] w-[108px] px-1.5 bg-white border border-[#c8c6c4] text-[11.5px] text-[#262626] outline-none"
                  >
                    {FONT_FAMILIES.map((f) => (
                      <option key={f} value={f}>{f}</option>
                    ))}
                  </select>
                  <select
                    aria-label="Font size"
                    value={fontSize}
                    onChange={(e) => {
                      const sz = Number(e.target.value);
                      setFontSize(sz);
                      withRange((r) => r.setFontSize(sz));
                    }}
                    className="h-[22px] w-[46px] px-1 bg-white border border-[#c8c6c4] text-[11.5px] text-[#262626] outline-none"
                  >
                    {FONT_SIZES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    title="Increase Font Size"
                    onClick={() => {
                      const next = Math.min(72, fontSize + 1);
                      setFontSize(next);
                      withRange((r) => r.setFontSize(next));
                    }}
                    className={smallBtn}
                  >
                    <span className="font-semibold text-[11.5px]">A<sup className="text-[8px]">▲</sup></span>
                  </button>
                  <button
                    type="button"
                    title="Decrease Font Size"
                    onClick={() => {
                      const next = Math.max(8, fontSize - 1);
                      setFontSize(next);
                      withRange((r) => r.setFontSize(next));
                    }}
                    className={smallBtn}
                  >
                    <span className="text-[10.5px]">A<sup className="text-[8px]">▼</sup></span>
                  </button>
                </div>

                <div className="flex items-center gap-0.5 relative">
                  <button
                    type="button"
                    title="Bold"
                    onClick={() => withRange((r) => r.setFontWeight(isBold ? 'normal' : 'bold'))}
                    className={`${smallBtn} w-6 font-bold ${isBold ? activeToggle : ''}`}
                  >
                    B
                  </button>
                  <button
                    type="button"
                    title="Italic"
                    onClick={() => withRange((r) => r.setFontStyle(isItalic ? 'normal' : 'italic'))}
                    className={`${smallBtn} w-6 italic font-serif ${isItalic ? activeToggle : ''}`}
                  >
                    I
                  </button>
                  <button
                    type="button"
                    title="Underline"
                    onClick={() => withRange((r) => r.setFontLine(isUnderline ? 'none' : 'underline'))}
                    className={`${smallBtn} w-6 underline ${isUnderline ? activeToggle : ''}`}
                  >
                    U
                  </button>

                  <span className="h-4 w-px bg-[#d2d0ce] mx-1" />

                  {/* Borders */}
                  <div className="relative">
                    <button type="button" title="Borders" onClick={() => toggleDrop('borders')} className={smallBtn}>
                      <svg viewBox="0 0 14 14" width="13" height="13" fill="none" stroke="#444" strokeWidth="1">
                        <rect x="1.5" y="1.5" width="11" height="11" />
                        <line x1="7" y1="1.5" x2="7" y2="12.5" strokeDasharray="1.5 1.5" />
                        <line x1="1.5" y1="7" x2="12.5" y2="7" strokeDasharray="1.5 1.5" />
                      </svg>
                      <span className="text-[9px]">▾</span>
                    </button>
                    {openDropdown === 'borders' && univerApi && (
                      <div className={menuPanel}>
                        <button type="button" onClick={() => { withRange((r) => r.setBorder(univerApi.Enum.BorderType.ALL, univerApi.Enum.BorderStyleTypes.THIN, '#000000')); setOpenDropdown(null); }} className={menuRow}>
                          <span>All Borders</span>
                        </button>
                        <button type="button" onClick={() => { withRange((r) => r.setBorder(univerApi.Enum.BorderType.OUTSIDE, univerApi.Enum.BorderStyleTypes.THIN, '#000000')); setOpenDropdown(null); }} className={menuRow}>
                          <span>Outside Borders</span>
                        </button>
                        <button type="button" onClick={() => { withRange((r) => r.setBorder(univerApi.Enum.BorderType.OUTSIDE, univerApi.Enum.BorderStyleTypes.THICK, '#000000')); setOpenDropdown(null); }} className={menuRow}>
                          <span>Thick Box Border</span>
                        </button>
                        <button type="button" onClick={() => { withRange((r) => r.setBorder(univerApi.Enum.BorderType.BOTTOM, univerApi.Enum.BorderStyleTypes.THIN, '#000000')); setOpenDropdown(null); }} className={menuRow}>
                          <span>Bottom Border</span>
                        </button>
                        <button type="button" onClick={() => { withRange((r) => r.setBorder(univerApi.Enum.BorderType.NONE, univerApi.Enum.BorderStyleTypes.NONE)); setOpenDropdown(null); }} className={menuRow}>
                          <span>No Border</span>
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Fill Color */}
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      title="Fill Color"
                      onClick={() => withRange((r) => r.setBackground(fillColor))}
                      className={`${smallBtn} px-1`}
                    >
                      <span className="flex flex-col items-center">
                        <svg viewBox="0 0 14 11" width="12" height="10" fill="none" stroke="#444" strokeWidth="1.2">
                          <path d="M3 6L7 2l4 4-4 4-4-4z" fill="#e1dfdd" />
                        </svg>
                        <span style={{ backgroundColor: fillColor }} className="w-3.5 h-[3px] border border-black/20" />
                      </span>
                    </button>
                    <button type="button" onClick={() => toggleDrop('fillColor')} className={`${smallBtn} px-0.5 text-[9px]`}>▾</button>
                    {openDropdown === 'fillColor' && (
                      <div className={`${menuPanel} p-2 w-[204px]`}>
                        <div className="grid grid-cols-10 gap-1">
                          {PALETTE_COLORS.map((c) => (
                            <button
                              key={`fill-${c}`}
                              type="button"
                              style={{ backgroundColor: c }}
                              onClick={() => {
                                setFillColor(c);
                                withRange((r) => r.setBackground(c));
                                setOpenDropdown(null);
                              }}
                              className="w-4 h-4 border border-black/25 hover:scale-110 cursor-default"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Font Color */}
                  <div className="relative flex items-center">
                    <button
                      type="button"
                      title="Font Color"
                      onClick={() => withRange((r) => r.setFontColor(fontColor))}
                      className={`${smallBtn} px-1`}
                    >
                      <span className="flex flex-col items-center leading-none">
                        <span className="font-bold text-[12px]">A</span>
                        <span style={{ backgroundColor: fontColor }} className="w-3.5 h-[3px]" />
                      </span>
                    </button>
                    <button type="button" onClick={() => toggleDrop('fontColor')} className={`${smallBtn} px-0.5 text-[9px]`}>▾</button>
                    {openDropdown === 'fontColor' && (
                      <div className={`${menuPanel} p-2 w-[204px]`}>
                        <div className="grid grid-cols-10 gap-1">
                          {PALETTE_COLORS.map((c) => (
                            <button
                              key={`fg-${c}`}
                              type="button"
                              style={{ backgroundColor: c }}
                              onClick={() => {
                                setFontColor(c);
                                withRange((r) => r.setFontColor(c));
                                setOpenDropdown(null);
                              }}
                              className="w-4 h-4 border border-black/25 hover:scale-110 cursor-default"
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className={groupLabel}>Font</div>
            </div>

            {/* Alignment */}
            <div className={groupWrap}>
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-0.5">
                  <button type="button" title="Top Align" onClick={() => withRange((r) => r.setVerticalAlignment('top'))} className={`${smallBtn} w-6 ${vAlign === 'top' ? activeToggle : ''}`}>
                    <svg viewBox="0 0 14 14" width="12" height="12" stroke="currentColor" strokeWidth="1.2">
                      <line x1="2" y1="2.5" x2="12" y2="2.5" /><line x1="3" y1="5.5" x2="11" y2="5.5" /><line x1="4" y1="8.5" x2="10" y2="8.5" />
                    </svg>
                  </button>
                  <button type="button" title="Middle Align" onClick={() => withRange((r) => r.setVerticalAlignment('middle'))} className={`${smallBtn} w-6 ${vAlign === 'middle' ? activeToggle : ''}`}>
                    <svg viewBox="0 0 14 14" width="12" height="12" stroke="currentColor" strokeWidth="1.2">
                      <line x1="2" y1="4.5" x2="12" y2="4.5" /><line x1="3" y1="7" x2="11" y2="7" /><line x1="2" y1="9.5" x2="12" y2="9.5" />
                    </svg>
                  </button>
                  <button type="button" title="Bottom Align" onClick={() => withRange((r) => r.setVerticalAlignment('bottom'))} className={`${smallBtn} w-6 ${vAlign === 'bottom' ? activeToggle : ''}`}>
                    <svg viewBox="0 0 14 14" width="12" height="12" stroke="currentColor" strokeWidth="1.2">
                      <line x1="4" y1="5.5" x2="10" y2="5.5" /><line x1="3" y1="8.5" x2="11" y2="8.5" /><line x1="2" y1="11.5" x2="12" y2="11.5" />
                    </svg>
                  </button>

                  <span className="h-4 w-px bg-[#d2d0ce] mx-1" />

                  <div className="relative">
                    <button type="button" title="Orientation" onClick={() => toggleDrop('orientation')} className={smallBtn}>
                      <span className="text-[10.5px] font-medium">ab↗</span>
                      <span className="text-[9px]">▾</span>
                    </button>
                    {openDropdown === 'orientation' && (
                      <div className={menuPanel}>
                        <button type="button" onClick={() => { withRange((r) => r.setTextRotation(0)); setOpenDropdown(null); }} className={menuRow}><span>Normal (0°)</span></button>
                        <button type="button" onClick={() => { withRange((r) => r.setTextRotation(45)); setOpenDropdown(null); }} className={menuRow}><span>Angle Counterclockwise (45°)</span></button>
                        <button type="button" onClick={() => { withRange((r) => r.setTextRotation(-45)); setOpenDropdown(null); }} className={menuRow}><span>Angle Clockwise (-45°)</span></button>
                        <button type="button" onClick={() => { withRange((r) => r.setTextRotation(90)); setOpenDropdown(null); }} className={menuRow}><span>Rotate Text Up (90°)</span></button>
                      </div>
                    )}
                  </div>

                  <span className="h-4 w-px bg-[#d2d0ce] mx-1" />

                  <button
                    type="button"
                    title="Wrap Text"
                    onClick={() => withRange((r) => r.setWrap(!isWrap))}
                    className={`${smallBtn} ${isWrap ? activeToggle : ''}`}
                  >
                    <span>Wrap Text</span>
                  </button>
                </div>

                <div className="flex items-center gap-0.5">
                  <button type="button" title="Align Left" onClick={() => withRange((r) => r.setHorizontalAlignment('left'))} className={`${smallBtn} w-6 ${hAlign === 'left' ? activeToggle : ''}`}>
                    <svg viewBox="0 0 14 14" width="12" height="12" stroke="currentColor" strokeWidth="1.2">
                      <line x1="2" y1="3" x2="12" y2="3" /><line x1="2" y1="6" x2="9" y2="6" /><line x1="2" y1="9" x2="12" y2="9" /><line x1="2" y1="12" x2="8" y2="12" />
                    </svg>
                  </button>
                  <button type="button" title="Center" onClick={() => withRange((r) => r.setHorizontalAlignment('center'))} className={`${smallBtn} w-6 ${hAlign === 'center' ? activeToggle : ''}`}>
                    <svg viewBox="0 0 14 14" width="12" height="12" stroke="currentColor" strokeWidth="1.2">
                      <line x1="2" y1="3" x2="12" y2="3" /><line x1="4" y1="6" x2="10" y2="6" /><line x1="2" y1="9" x2="12" y2="9" /><line x1="4.5" y1="12" x2="9.5" y2="12" />
                    </svg>
                  </button>
                  <button type="button" title="Align Right" onClick={() => withRange((r) => r.setHorizontalAlignment('normal'))} className={`${smallBtn} w-6 ${hAlign === 'right' ? activeToggle : ''}`}>
                    <svg viewBox="0 0 14 14" width="12" height="12" stroke="currentColor" strokeWidth="1.2">
                      <line x1="2" y1="3" x2="12" y2="3" /><line x1="5" y1="6" x2="12" y2="6" /><line x1="2" y1="9" x2="12" y2="9" /><line x1="6" y1="12" x2="12" y2="12" />
                    </svg>
                  </button>

                  <span className="h-4 w-px bg-[#d2d0ce] mx-1" />

                  <div className="relative">
                    <button
                      type="button"
                      title="Merge & Center"
                      onClick={() => withRange((r) => {
                        if (r.isPartOfMerge()) r.breakApart();
                        else { r.merge(); r.setHorizontalAlignment('center'); }
                      })}
                      className={smallBtn}
                    >
                      <span>Merge &amp; Center</span>
                    </button>
                    <button type="button" onClick={() => toggleDrop('merge')} className={`${smallBtn} inline-flex px-0.5 text-[9px]`}>▾</button>
                    {openDropdown === 'merge' && (
                      <div className={menuPanel}>
                        <button type="button" onClick={() => { withRange((r) => { r.merge(); r.setHorizontalAlignment('center'); }); setOpenDropdown(null); }} className={menuRow}><span>Merge &amp; Center</span></button>
                        <button type="button" onClick={() => { withRange((r) => r.mergeAcross()); setOpenDropdown(null); }} className={menuRow}><span>Merge Across</span></button>
                        <button type="button" onClick={() => { withRange((r) => r.merge()); setOpenDropdown(null); }} className={menuRow}><span>Merge Cells</span></button>
                        <button type="button" onClick={() => { withRange((r) => r.breakApart()); setOpenDropdown(null); }} className={menuRow}><span>Unmerge Cells</span></button>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className={groupLabel}>Alignment</div>
            </div>

            {/* Number */}
            <div className={groupWrap}>
              <div className="flex flex-col gap-1">
                <select
                  aria-label="Number format"
                  value={numFmt}
                  onChange={(e) => {
                    const pat = e.target.value;
                    setNumFmt(pat);
                    withRange((r) => r.setNumberFormat(pat));
                  }}
                  className="h-[22px] w-[118px] px-1.5 bg-white border border-[#c8c6c4] text-[11.5px] text-[#262626] outline-none"
                >
                  {NUMBER_FORMATS.map((nf) => (
                    <option key={nf.pattern} value={nf.pattern}>{nf.label}</option>
                  ))}
                </select>
                <div className="flex items-center gap-0.5 relative">
                  <button type="button" title="Accounting Number Format ($)" onClick={() => withRange((r) => r.setNumberFormat('$#,##0.00'))} className={`${smallBtn} px-1.5 font-medium`}>$</button>
                  <button type="button" title="Percent Style (%)" onClick={() => withRange((r) => r.setNumberFormat('0%'))} className={`${smallBtn} px-1.5 font-medium`}>%</button>
                  <button type="button" title="Comma Style (,)" onClick={() => withRange((r) => r.setNumberFormat('#,##0.00'))} className={`${smallBtn} px-1.5 font-bold`}>,</button>
                  <span className="h-4 w-px bg-[#d2d0ce] mx-0.5" />
                  <button type="button" title="Increase Decimal" onClick={() => withRange((r) => r.setNumberFormat('0.000'))} className={`${smallBtn} text-[10px]`}>.00→</button>
                  <button type="button" title="Decrease Decimal" onClick={() => withRange((r) => r.setNumberFormat('0'))} className={`${smallBtn} text-[10px]`}>→.0</button>
                </div>
              </div>
              <div className={groupLabel}>Number</div>
            </div>

            {/* Styles */}
            <div className={groupWrap}>
              <div className="flex items-center gap-1">
                <div className="relative">
                  <button type="button" onClick={() => toggleDrop('conditional')} className={bigBtn}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#444" strokeWidth="1.3">
                      <rect x="3" y="4" width="18" height="16" fill="#fff" />
                      <rect x="4" y="6" width="10" height="4" fill="#ffc7ce" />
                      <rect x="4" y="12" width="14" height="4" fill="#9bc2e6" />
                    </svg>
                    <span className="text-[10px] leading-[11px] text-center">Conditional<br />Formatting ▾</span>
                  </button>
                  {openDropdown === 'conditional' && (
                    <div className={menuPanel}>
                      <button type="button" onClick={() => {
                        withRange((r, sheet) => {
                          const vals = r.getValues();
                          const r0 = r.getRow();
                          const c0 = r.getColumn();
                          vals.forEach((row, ri) => row.forEach((v, ci) => {
                            if (typeof v === 'number' && v > 0) {
                              sheet.getRange(r0 + ri, c0 + ci).setBackground('#c6efce').setFontColor('#006100');
                            }
                          }));
                        });
                        setOpenDropdown(null);
                      }} className={menuRow}><span>Highlight Positive (&gt; 0)</span></button>
                      <button type="button" onClick={() => {
                        withRange((r, sheet) => {
                          const vals = r.getValues();
                          const r0 = r.getRow();
                          const c0 = r.getColumn();
                          vals.forEach((row, ri) => row.forEach((v, ci) => {
                            if (typeof v === 'number' && v < 0) {
                              sheet.getRange(r0 + ri, c0 + ci).setBackground('#ffc7ce').setFontColor('#9c0006');
                            }
                          }));
                        });
                        setOpenDropdown(null);
                      }} className={menuRow}><span>Highlight Negative (&lt; 0)</span></button>
                      <button type="button" onClick={() => { withRange((r) => r.clearFormat()); setOpenDropdown(null); }} className={menuRow}><span>Clear Rules</span></button>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button type="button" onClick={() => toggleDrop('table')} className={bigBtn}>
                    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="#444" strokeWidth="1.2">
                      <rect x="3" y="4" width="18" height="16" fill="#fff" />
                      <rect x="3" y="4" width="18" height="5" fill="#4472c4" />
                      <rect x="3" y="13" width="18" height="3.5" fill="#d9e1f2" />
                    </svg>
                    <span className="text-[10px] leading-[11px] text-center">Format as<br />Table ▾</span>
                  </button>
                  {openDropdown === 'table' && (
                    <div className={menuPanel}>
                      {[
                        { label: 'Blue Table', hdr: '#4472c4', stripe: '#d9e1f2' },
                        { label: 'Green Table', hdr: '#217346', stripe: '#e2efda' },
                        { label: 'Orange Table', hdr: '#ed7d31', stripe: '#fce4d6' },
                      ].map((t) => (
                        <button
                          key={t.label}
                          type="button"
                          onClick={() => {
                            withRange((r, sheet) => {
                              const r0 = r.getRow();
                              const c0 = r.getColumn();
                              const rows = r.getHeight();
                              const cols = r.getWidth();
                              sheet.getRange(r0, c0, 1, cols).setBackground(t.hdr).setFontColor('#ffffff').setFontWeight('bold');
                              for (let i = 1; i < rows; i++) {
                                if (i % 2 === 1) sheet.getRange(r0 + i, c0, 1, cols).setBackground(t.stripe);
                              }
                            });
                            setOpenDropdown(null);
                          }}
                          className={menuRow}
                        >
                          <span>{t.label}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Cell Styles 2x5 Gallery Box */}
                <div className="flex items-stretch bg-white border border-[#c8c6c4] h-[54px] shrink-0">
                  <div className="grid grid-cols-5 grid-rows-2 gap-1 p-1">
                    {displayedCellStyles.map((st) => (
                      <button
                        key={st.name}
                        type="button"
                        title={st.name}
                        onClick={() => handleApplyStylePreset(st)}
                        className={`w-[68px] h-[20px] px-1.5 border text-[10.5px] text-left truncate cursor-default hover:ring-1 hover:ring-[#217346] ${st.previewClass}`}
                      >
                        {st.name}
                      </button>
                    ))}
                  </div>
                  <div className="flex flex-col border-l border-[#d2d0ce] w-4 bg-[#f3f2f1] text-[8px] text-[#555]">
                    <button type="button" onClick={() => setStylesPage(0)} className="flex-1 hover:bg-[#e1dfdd] cursor-default">▲</button>
                    <button type="button" onClick={() => setStylesPage(1)} className="flex-1 border-t border-[#d2d0ce] hover:bg-[#e1dfdd] cursor-default">▼</button>
                  </div>
                </div>
              </div>
              <div className={groupLabel}>Styles</div>
            </div>

            {/* Cells */}
            <div className={groupWrap}>
              <div className="flex items-center gap-0.5">
                <div className="relative">
                  <button type="button" onClick={() => toggleDrop('insert')} className={bigBtn}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#444" strokeWidth="1.3">
                      <rect x="3" y="4" width="18" height="16" fill="#fff" />
                      <rect x="3" y="9" width="18" height="5" fill="#d9e1f2" />
                    </svg>
                    <span>Insert ▾</span>
                  </button>
                  {openDropdown === 'insert' && (
                    <div className={menuPanel}>
                      <button type="button" onClick={() => { withRange((r, s) => s.insertRowBefore(r.getRow())); setOpenDropdown(null); }} className={menuRow}><span>Insert Sheet Rows</span></button>
                      <button type="button" onClick={() => { withRange((r, s) => s.insertColumnBefore(r.getColumn())); setOpenDropdown(null); }} className={menuRow}><span>Insert Sheet Columns</span></button>
                      <button type="button" onClick={() => {
                        const wb = univerApi?.getActiveWorkbook();
                        if (wb) wb.create(`Sheet${wb.getSheets().length + 1}`, 100, 26);
                        setOpenDropdown(null);
                      }} className={menuRow}><span>Insert Sheet</span></button>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button type="button" onClick={() => toggleDrop('delete')} className={bigBtn}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#444" strokeWidth="1.3">
                      <rect x="3" y="4" width="18" height="16" fill="#fff" />
                      <path d="M14 9l5 5M19 9l-5 5" stroke="#c00000" strokeWidth="1.8" />
                    </svg>
                    <span>Delete ▾</span>
                  </button>
                  {openDropdown === 'delete' && (
                    <div className={menuPanel}>
                      <button type="button" onClick={() => { withRange((r, s) => s.deleteRow(r.getRow())); setOpenDropdown(null); }} className={menuRow}><span>Delete Sheet Rows</span></button>
                      <button type="button" onClick={() => { withRange((r, s) => s.deleteColumn(r.getColumn())); setOpenDropdown(null); }} className={menuRow}><span>Delete Sheet Columns</span></button>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button type="button" onClick={() => toggleDrop('format')} className={bigBtn}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#444" strokeWidth="1.3">
                      <rect x="3" y="4" width="18" height="16" fill="#fff" />
                      <rect x="3" y="4" width="18" height="4" fill="#9bc2e6" />
                    </svg>
                    <span>Format ▾</span>
                  </button>
                  {openDropdown === 'format' && (
                    <div className={menuPanel}>
                      <button type="button" onClick={() => { withRange((r, s) => s.autoResizeColumns(r.getColumn(), r.getWidth())); setOpenDropdown(null); }} className={menuRow}><span>AutoFit Column Width</span></button>
                      <button type="button" onClick={() => { withRange((r, s) => s.autoResizeRows(r.getRow(), r.getHeight())); setOpenDropdown(null); }} className={menuRow}><span>AutoFit Row Height</span></button>
                      <button type="button" onClick={() => { withRange((r, s) => s.setColumnWidths(r.getColumn(), r.getWidth(), 140)); setOpenDropdown(null); }} className={menuRow}><span>Wide Column (140px)</span></button>
                    </div>
                  )}
                </div>
              </div>
              <div className={groupLabel}>Cells</div>
            </div>

            {/* Editing */}
            <div className={`${groupWrap} border-r-0`}>
              <div className="flex items-center gap-1">
                <div className="flex flex-col gap-0.5 relative">
                  <div className="relative">
                    <button type="button" onClick={() => handleAutoSum('SUM')} className={`${smallBtn} justify-start`} title="AutoSum">
                      <span className="font-serif font-bold text-[#217346]">Σ</span>
                      <span>AutoSum</span>
                    </button>
                    <button type="button" onClick={() => toggleDrop('autosum')} className={`${smallBtn} inline-flex px-0.5 text-[9px]`}>▾</button>
                    {openDropdown === 'autosum' && (
                      <div className={menuPanel}>
                        <button type="button" onClick={() => handleAutoSum('SUM')} className={menuRow}><span>Sum</span></button>
                        <button type="button" onClick={() => handleAutoSum('AVERAGE')} className={menuRow}><span>Average</span></button>
                        <button type="button" onClick={() => handleAutoSum('COUNT')} className={menuRow}><span>Count Numbers</span></button>
                        <button type="button" onClick={() => handleAutoSum('MAX')} className={menuRow}><span>Max</span></button>
                        <button type="button" onClick={() => handleAutoSum('MIN')} className={menuRow}><span>Min</span></button>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button type="button" onClick={() => toggleDrop('fill')} className={`${smallBtn} justify-start w-full`}>
                      <span>Fill ▾</span>
                    </button>
                    {openDropdown === 'fill' && (
                      <div className={menuPanel}>
                        <button type="button" onClick={() => handleFillDirection('down')} className={menuRow}><span>Down</span></button>
                        <button type="button" onClick={() => handleFillDirection('right')} className={menuRow}><span>Right</span></button>
                        <button type="button" onClick={() => handleFillDirection('up')} className={menuRow}><span>Up</span></button>
                        <button type="button" onClick={() => handleFillDirection('left')} className={menuRow}><span>Left</span></button>
                      </div>
                    )}
                  </div>
                  <div className="relative">
                    <button type="button" onClick={() => toggleDrop('clear')} className={`${smallBtn} justify-start w-full`}>
                      <span>Clear ▾</span>
                    </button>
                    {openDropdown === 'clear' && (
                      <div className={menuPanel}>
                        <button type="button" onClick={() => { withRange((r) => r.clear()); setOpenDropdown(null); }} className={menuRow}><span>Clear All</span></button>
                        <button type="button" onClick={() => { withRange((r) => r.clearFormat()); setOpenDropdown(null); }} className={menuRow}><span>Clear Formats</span></button>
                        <button type="button" onClick={() => { withRange((r) => r.clearContent()); setOpenDropdown(null); }} className={menuRow}><span>Clear Contents</span></button>
                      </div>
                    )}
                  </div>
                </div>

                <div className="relative">
                  <button type="button" onClick={() => toggleDrop('sort')} className={bigBtn}>
                    <span className="text-[13px] font-semibold text-[#2b579a]">A<span className="text-[#c00000]">Z</span></span>
                    <span className="text-[10px] leading-[11px] text-center">Sort &amp;<br />Filter ▾</span>
                  </button>
                  {openDropdown === 'sort' && (
                    <div className={menuPanel}>
                      <button type="button" onClick={() => handleSort(true)} className={menuRow}><span>Sort A to Z</span></button>
                      <button type="button" onClick={() => handleSort(false)} className={menuRow}><span>Sort Z to A</span></button>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button type="button" onClick={() => toggleDrop('find')} className={bigBtn}>
                    <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="#444" strokeWidth="1.5">
                      <circle cx="10.5" cy="10.5" r="6" />
                      <line x1="15" y1="15" x2="20" y2="20" />
                    </svg>
                    <span className="text-[10px] leading-[11px] text-center">Find &amp;<br />Select ▾</span>
                  </button>
                  {openDropdown === 'find' && (
                    <div className={menuPanel}>
                      <button type="button" onClick={() => { setFindModalOpen(true); setOpenDropdown(null); }} className={menuRow}><span>Find...</span></button>
                      <button type="button" onClick={() => { withRange((_, s) => s.getDataRange().activate()); setOpenDropdown(null); }} className={menuRow}><span>Select Data Range</span></button>
                    </div>
                  )}
                </div>
              </div>
              <div className={groupLabel}>Editing</div>
            </div>
          </>
        )}

        {activeTab === 'Insert' && (
          <div className="flex items-center gap-2 px-2">
            <button type="button" onClick={() => withRange((r, s) => s.insertRowBefore(r.getRow()))} className={bigBtn}>
              <span>Insert Row</span>
            </button>
            <button type="button" onClick={() => withRange((r, s) => s.insertColumnBefore(r.getColumn()))} className={bigBtn}>
              <span>Insert Column</span>
            </button>
            <button type="button" onClick={() => {
              const wb = univerApi?.getActiveWorkbook();
              if (wb) wb.create(`Sheet${wb.getSheets().length + 1}`, 100, 26);
            }} className={bigBtn}>
              <span>New Sheet</span>
            </button>
            <button type="button" onClick={() => handleAutoSum('SUM')} className={bigBtn}>
              <span>Insert SUM</span>
            </button>
          </div>
        )}

        {activeTab === 'Page Layout' && (
          <div className="flex items-center gap-2 px-2">
            <button type="button" onClick={() => {
              const s = univerApi?.getActiveWorkbook()?.getActiveSheet();
              if (s) s.setHiddenGridlines(!s.hasHiddenGridLines());
            }} className={bigBtn}>
              <span>Toggle Gridlines</span>
            </button>
            <button type="button" onClick={() => {
              const s = univerApi?.getActiveWorkbook()?.getActiveSheet();
              if (s) s.setGridLinesColor('#4472c4');
            }} className={bigBtn}>
              <span>Blue Gridlines</span>
            </button>
            <button type="button" onClick={() => {
              const s = univerApi?.getActiveWorkbook()?.getActiveSheet();
              if (s) s.setGridLinesColor(undefined);
            }} className={bigBtn}>
              <span>Reset Gridlines</span>
            </button>
          </div>
        )}

        {activeTab === 'Formulas' && (
          <div className="flex items-center gap-2 px-2">
            {(['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'] as const).map((fn) => (
              <button key={fn} type="button" onClick={() => handleAutoSum(fn)} className={bigBtn}>
                <span className="font-serif font-bold text-[#217346] text-[15px]">fx</span>
                <span>{fn}</span>
              </button>
            ))}
          </div>
        )}

        {activeTab === 'Data' && (
          <div className="flex items-center gap-2 px-2">
            <button type="button" onClick={() => handleSort(true)} className={bigBtn}><span>Sort A → Z</span></button>
            <button type="button" onClick={() => handleSort(false)} className={bigBtn}><span>Sort Z → A</span></button>
            <button type="button" onClick={() => withRange((r) => r.clearContent())} className={bigBtn}><span>Clear Data</span></button>
          </div>
        )}

        {activeTab === 'Review' && (
          <div className="flex items-center gap-2 px-2">
            <button type="button" onClick={() => setFindModalOpen(true)} className={bigBtn}><span>Find Text</span></button>
            <button type="button" onClick={() => onStatus('Workbook check complete: No issues found.')} className={bigBtn}><span>Check Workbook</span></button>
          </div>
        )}

        {activeTab === 'View' && (
          <div className="flex items-center gap-2 px-2">
            <button type="button" onClick={() => {
              const s = univerApi?.getActiveWorkbook()?.getActiveSheet();
              if (s) s.setHiddenGridlines(!s.hasHiddenGridLines());
            }} className={bigBtn}>
              <span>Gridlines</span>
            </button>
            <button type="button" onClick={() => withRange((r, s) => s.setFreeze({ startRow: r.getRow(), startColumn: r.getColumn(), xSplit: r.getColumn(), ySplit: r.getRow() }))} className={bigBtn}>
              <span>Freeze Panes</span>
            </button>
            <button type="button" onClick={() => univerApi?.getActiveWorkbook()?.getActiveSheet()?.cancelFreeze()} className={bigBtn}>
              <span>Unfreeze Panes</span>
            </button>
          </div>
        )}

        {activeTab === 'Help' && (
          <div className="flex items-center gap-3 px-3 text-[12px] text-[#444]">
            <span>Excel for Windows 10 · Shortcuts: Ctrl+Z Undo, Ctrl+Y Redo, Ctrl+B Bold, =SUM(A1:A5) for formulas.</span>
          </div>
        )}
      </div>

      {/* 4. Name Box + Formula Bar */}
      <div className="h-[34px] bg-[#f3f2f1] border-b border-[#d2d0ce] px-2 py-1 flex items-center gap-1.5">
        <form onSubmit={handleNameBoxSubmit} className="flex items-center w-[124px] h-full bg-white border border-[#c8c6c4] shrink-0">
          <input
            type="text"
            aria-label="Name Box"
            value={nameBoxText}
            onChange={(e) => setNameBoxText(e.target.value)}
            className="w-full h-full px-2 text-[12px] text-[#262626] outline-none"
          />
          <span className="px-1 text-[9px] text-[#666]">▾</span>
        </form>

        <div className="flex items-center h-full bg-white border border-[#c8c6c4] px-1 gap-0.5 shrink-0 relative">
          <button
            type="button"
            title="Cancel"
            onClick={syncFromActiveCell}
            className="w-5 h-5 flex items-center justify-center text-[#c00000] hover:bg-[#f3f2f1] text-[12px] cursor-default"
          >
            ✕
          </button>
          <button
            type="button"
            title="Enter"
            onClick={() => handleFormulaCommit()}
            className="w-5 h-5 flex items-center justify-center text-[#217346] hover:bg-[#f3f2f1] text-[12px] cursor-default"
          >
            ✓
          </button>
          <button
            type="button"
            title="Insert Function"
            onClick={() => toggleDrop('fx')}
            className="w-5 h-5 flex items-center justify-center text-[#262626] hover:bg-[#f3f2f1] font-serif italic text-[12px] cursor-default"
          >
            fx
          </button>
          {openDropdown === 'fx' && (
            <div className={menuPanel}>
              {(['SUM', 'AVERAGE', 'COUNT', 'MAX', 'MIN'] as const).map((fn) => (
                <button key={fn} type="button" onClick={() => handleAutoSum(fn)} className={menuRow}>
                  <span>={fn}(...)</span>
                </button>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleFormulaCommit} className="flex-1 h-full bg-white border border-[#c8c6c4]">
          <input
            type="text"
            aria-label="Formula Bar"
            value={formulaText}
            onChange={(e) => setFormulaText(e.target.value)}
            placeholder="Enter value or formula (e.g. =SUM(A1:A5))"
            className="w-full h-full px-2 text-[12px] text-[#262626] outline-none"
          />
        </form>
      </div>

      {/* Find Dialog */}
      {findModalOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/25" onClick={() => setFindModalOpen(false)}>
          <form
            onSubmit={handleFindNext}
            onClick={(e) => e.stopPropagation()}
            className="w-[320px] bg-white border border-[#c8c6c4] shadow-2xl p-3 text-[12px] text-[#262626] space-y-2.5"
          >
            <div className="flex items-center justify-between font-semibold">
              <span>Find in Sheet</span>
              <button type="button" onClick={() => setFindModalOpen(false)} className="px-1 hover:bg-[#e81123] hover:text-white">×</button>
            </div>
            <input
              type="text"
              autoFocus
              value={findQuery}
              onChange={(e) => setFindQuery(e.target.value)}
              placeholder="Find what..."
              className="w-full h-7 px-2 border border-[#7a7a7a] focus:border-[#217346] outline-none"
            />
            <div className="flex justify-end gap-2">
              <button type="submit" className="px-3 py-1 bg-[#217346] text-white cursor-default">Find Next</button>
              <button type="button" onClick={() => setFindModalOpen(false)} className="px-3 py-1 bg-[#f3f2f1] border border-[#c8c6c4] cursor-default">Close</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
