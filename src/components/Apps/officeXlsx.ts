import ExcelJS from 'exceljs';
import { CellValueType, DateSystem, LocaleType, type ICellData, type IWorkbookData } from '@univerjs/presets';
import { readOfficeArchive } from './officeArchive';

export async function importXlsx(buffer: ArrayBuffer, title: string): Promise<Partial<IWorkbookData>> {
  readOfficeArchive(buffer, () => false);
  const source = new ExcelJS.Workbook();
  // ExcelJS expands merged ranges into individual cells. The basic importer uses their anchor values.
  await source.xlsx.load(buffer, { ignoreNodes: ['mergeCells', 'drawing'] });
  if (source.worksheets.length === 0) throw new Error('No worksheet found in this file.');

  const date1904 = source.properties.date1904;
  const sheetOrder: string[] = [];
  const sheets: IWorkbookData['sheets'] = {};
  for (const sheet of source.worksheets) {
    const id = `sheet-${sheet.id}`;
    const cellData: NonNullable<IWorkbookData['sheets'][string]['cellData']> = {};
    sheet.eachRow((row, rowNumber) => {
      row.eachCell((cell, columnNumber) => {
        let value = cell.type === ExcelJS.ValueType.Formula ? cell.result : cell.value;
        if (value instanceof Date) {
          value = value.getTime() / 86400000 + 25569 - (date1904 ? 1462 : 0);
        } else if (value && typeof value === 'object') {
          value = 'error' in value ? value.error : cell.text;
        }
        const data: ICellData = {};
        if (typeof value === 'boolean') {
          data.t = CellValueType.BOOLEAN;
          data.v = value ? 1 : 0;
        } else if (typeof value === 'string' || typeof value === 'number') {
          data.t = typeof value === 'number' ? CellValueType.NUMBER : CellValueType.STRING;
          data.v = value;
        }
        if (cell.formula) data.f = `=${cell.formula}`;
        const { font, numFmt } = cell;
        if (font?.bold || font?.italic || (numFmt && numFmt !== 'General')) {
          data.s = {
            ...(font?.bold && { bl: 1 }),
            ...(font?.italic && { it: 1 }),
            ...(numFmt && numFmt !== 'General' && { n: { pattern: numFmt } }),
          };
        }
        (cellData[rowNumber - 1] ??= {})[columnNumber - 1] = data;
      });
    });
    sheets[id] = {
      id, name: sheet.name, cellData,
      rowCount: Math.max(100, sheet.rowCount),
      columnCount: Math.max(26, sheet.columnCount),
    };
    sheetOrder.push(id);
  }
  return {
    id: crypto.randomUUID(), name: title, locale: LocaleType.EN_US, styles: {},
    dateSystem: date1904 ? DateSystem.Date1904 : DateSystem.Date1900,
    sheetOrder, sheets,
  };
}

export async function exportXlsx(snapshot: IWorkbookData): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  workbook.properties.date1904 = snapshot.dateSystem === DateSystem.Date1904;
  workbook.calcProperties.fullCalcOnLoad = true;
  for (const id of snapshot.sheetOrder) {
    const source = snapshot.sheets[id];
    const sheet = workbook.addWorksheet(source.name);
    for (const [row, cells] of Object.entries(source.cellData ?? {})) {
      for (const [column, data] of Object.entries<ICellData>(cells)) {
        const richText = data.p?.body?.dataStream?.replace(/\r\n$/, '').replace(/\r/g, '\n');
        const raw = richText ?? data.v;
        const value = raw == null ? undefined : data.t === CellValueType.BOOLEAN
          ? raw === true || raw === 1
          : raw;
        if (value === undefined && !data.f && !data.s) continue;
        const cell = sheet.getCell(Number(row) + 1, Number(column) + 1);
        cell.value = data.f ? { formula: data.f.replace(/^=/, ''), result: value } : value ?? null;
        const style = typeof data.s === 'string' ? snapshot.styles[data.s] : data.s;
        if (style?.n?.pattern) cell.numFmt = style.n.pattern;
        if (style?.bl || style?.it) cell.font = { bold: style.bl === 1, italic: style.it === 1 };
      }
    }
    for (const merge of source.mergeData ?? []) {
      sheet.mergeCells(merge.startRow + 1, merge.startColumn + 1, merge.endRow + 1, merge.endColumn + 1);
    }
  }
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
