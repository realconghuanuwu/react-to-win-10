import fontkit from '@pdf-lib/fontkit';
import {
  degrees, PDFCheckBox, PDFDocument, PDFDropdown, PDFForm,
  PDFRadioGroup, PDFTextField, rgb, type PDFFont, type PDFPage,
} from 'pdf-lib';
import fontUrl from './NotoSans-Regular.ttf?url';

export type PdfBytes = Uint8Array<ArrayBuffer>;

type FormValue = string | boolean | string[];
export type FormEdit = Record<string, FormValue>;

export type FormField =
  | { name: string; kind: 'text'; value: string; multiline: boolean; maxLength?: number }
  | { name: string; kind: 'check'; value: boolean }
  | { name: string; kind: 'radio'; value: string; options: string[] }
  | { name: string; kind: 'dropdown'; value: string[]; options: string[]; multiple: boolean };

export interface PdfInput {
  id: string;
  name: string;
  bytes: PdfBytes;
  pageCount: number;
  fields: FormField[];
  hasForm: boolean;
}

export interface PdfOutput {
  name: string;
  bytes: PdfBytes;
}

export interface TextMark {
  id: string;
  page: number;
  x: number;
  y: number;
  angle: number;
  size: number;
  text: string;
}

type WatermarkPosition = 'center' | 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';

export interface WatermarkOptions {
  content: { text: string } | { image: File };
  position: WatermarkPosition;
  opacity: number;
  range: string;
}

async function readPdf(bytes: PdfBytes) {
  try {
    return await PDFDocument.load(bytes, { updateMetadata: false });
  } catch (error) {
    // pdf-lib's transpiled encryption error has the base Error prototype.
    if (error instanceof Error && error.message.startsWith('Input document to `PDFDocument.load` is encrypted.')) {
      throw new Error('This PDF is password-protected. Open an unlocked copy.');
    }
    throw new Error('This file could not be opened as a PDF.');
  }
}

function readForm(doc: PDFDocument) {
  const acroForm = doc.catalog.getAcroForm();
  if (!acroForm) return null;
  const form = PDFForm.of(acroForm, doc);
  if (form.hasXFA()) throw new Error('This PDF uses an XFA form. Open a standard PDF or AcroForm copy.');
  return form;
}

export async function inspectPdf(file: File): Promise<PdfInput> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const doc = await readPdf(bytes);
  const pageCount = doc.getPageCount();
  if (!pageCount) throw new Error('This PDF has no pages.');

  const allFields = readForm(doc)?.getFields() ?? [];
  const fields = allFields.flatMap((field): FormField[] => {
    if (field.isReadOnly()) return [];
    const name = field.getName();
    if (field instanceof PDFTextField) {
      return [{ name, kind: 'text', value: field.getText() ?? '', multiline: field.isMultiline(), maxLength: field.getMaxLength() }];
    }
    if (field instanceof PDFCheckBox) {
      return [{ name, kind: 'check', value: field.isChecked() }];
    }
    if (field instanceof PDFRadioGroup) {
      return [{ name, kind: 'radio', value: field.getSelected() ?? '', options: field.getOptions() }];
    }
    if (field instanceof PDFDropdown) {
      return [{ name, kind: 'dropdown', value: field.getSelected(), options: field.getOptions(), multiple: field.isMultiselect() }];
    }
    return [];
  });

  return { id: crypto.randomUUID(), name: file.name, bytes, pageCount, fields, hasForm: allFields.length > 0 };
}

export function parsePageRanges(range: string, pageCount: number): number[][] {
  return range.split(',').map((part) => {
    const match = part.trim().match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
    if (!match) throw new Error('Enter page numbers or ranges separated by commas, for example 1–3, 6.');
    const first = Number(match[1]);
    const last = Number(match[2] ?? match[1]);
    if (first < 1 || last > pageCount || last < first) {
      throw new Error('Use ascending page ranges between 1 and ' + pageCount + '.');
    }
    return Array.from({ length: last - first + 1 }, (_, offset) => first + offset - 1);
  });
}

function outputName(input: PdfInput, suffix: string) {
  return input.name.replace(/\.pdf$/i, '') + '-' + suffix + '.pdf';
}

async function exportPdf(doc: PDFDocument, name: string): Promise<PdfOutput> {
  return { name, bytes: new Uint8Array(await doc.save({ updateFieldAppearances: false })) };
}

async function copySource(input: PdfInput) {
  const doc = await readPdf(input.bytes);
  readForm(doc)?.flatten({ updateFieldAppearances: false });
  return doc;
}

async function copyPages(target: PDFDocument, source: PDFDocument, indices: number[]) {
  const pages = await target.copyPages(source, indices);
  for (const page of pages) target.addPage(page);
}

export async function mergePdfs(inputs: PdfInput[]): Promise<PdfOutput[]> {
  const merged = await PDFDocument.create();
  for (const input of inputs) {
    const source = await copySource(input);
    await copyPages(merged, source, source.getPageIndices());
  }
  return [await exportPdf(merged, 'merged.pdf')];
}

export async function splitPdf(input: PdfInput, range: string, separate: boolean): Promise<PdfOutput[]> {
  const ranges = parsePageRanges(range, input.pageCount);
  const source = await copySource(input);
  const outputs: PdfOutput[] = [];
  for (const [index, pages] of (separate ? ranges : [ranges.flat()]).entries()) {
    const result = await PDFDocument.create();
    await copyPages(result, source, pages);
    outputs.push(await exportPdf(result, outputName(input, separate ? 'part-' + (index + 1) : 'split')));
  }
  return outputs;
}

let fontBytes: Promise<ArrayBuffer> | undefined;

function embedFont(doc: PDFDocument, subset: boolean) {
  fontBytes ??= fetch(fontUrl).then((response) => {
    if (!response.ok) throw new Error('The PDF font could not be loaded. Try opening PDF Tool again.');
    return response.arrayBuffer();
  }).catch((error: unknown) => {
    fontBytes = undefined;
    throw error;
  });
  doc.registerFontkit(fontkit);
  return fontBytes.then((bytes) => doc.embedFont(bytes, { subset }));
}

export async function fillPdf(input: PdfInput, edits: FormEdit, marks: TextMark[]): Promise<PdfOutput[]> {
  const doc = await readPdf(input.bytes);
  const form = readForm(doc);
  let font: PDFFont | undefined;

  for (const [name, value] of Object.entries(edits)) {
    const field = form?.getField(name);
    if (field instanceof PDFTextField && typeof value === 'string') {
      font ??= await embedFont(doc, false);
      field.setText(value || undefined);
      field.updateAppearances(font);
    } else if (field instanceof PDFCheckBox && typeof value === 'boolean') {
      if (value) field.check();
      else field.uncheck();
    } else if (field instanceof PDFRadioGroup && typeof value === 'string') {
      if (value) field.select(value);
      else field.clear();
    } else if (field instanceof PDFDropdown && Array.isArray(value)) {
      font ??= await embedFont(doc, false);
      if (value.length) field.select(value);
      else field.clear();
      field.updateAppearances(font);
    }
  }

  for (const mark of marks) {
    if (!mark.text.trim()) continue;
    font ??= await embedFont(doc, true);
    doc.getPage(mark.page - 1).drawText(mark.text, {
      x: mark.x, y: mark.y, size: mark.size, rotate: degrees(mark.angle),
      font, color: rgb(0.07, 0.1, 0.16),
    });
  }
  return [await exportPdf(doc, outputName(input, 'filled'))];
}

function visiblePage(page: PDFPage) {
  const crop = page.getCropBox();
  const media = page.getMediaBox();
  const x = Math.max(crop.x, media.x);
  const y = Math.max(crop.y, media.y);
  const right = Math.min(crop.x + crop.width, media.x + media.width);
  const top = Math.min(crop.y + crop.height, media.y + media.height);
  const box = right > x && top > y ? { x, y, width: right - x, height: top - y } : media;
  const angle = ((page.getRotation().angle % 360) + 360) % 360;
  const swapped = angle === 90 || angle === 270;

  return {
    width: swapped ? box.height : box.width,
    height: swapped ? box.width : box.height,
    placement(left: number, bottom: number) {
      let point = { x: box.x + left, y: box.y + bottom };
      if (angle === 90) point = { x: box.x + box.width - bottom, y: box.y + left };
      if (angle === 180) point = { x: box.x + box.width - left, y: box.y + box.height - bottom };
      if (angle === 270) point = { x: box.x + bottom, y: box.y + box.height - left };
      return { ...point, rotate: degrees(angle) };
    },
  };
}

export async function watermarkPdf(input: PdfInput, options: WatermarkOptions): Promise<PdfOutput[]> {
  const indices = options.range.trim()
    ? [...new Set(parsePageRanges(options.range, input.pageCount).flat())]
    : Array.from({ length: input.pageCount }, (_, index) => index);
  const doc = await readPdf(input.bytes);
  const text = 'text' in options.content ? options.content.text.trim() : '';
  const font = text ? await embedFont(doc, true) : undefined;
  let image;
  if ('image' in options.content) {
    const bytes = new Uint8Array(await options.content.image.arrayBuffer());
    try {
      image = bytes[0] === 0xff && bytes[1] === 0xd8 ? await doc.embedJpg(bytes) : await doc.embedPng(bytes);
    } catch {
      throw new Error('Choose a valid PNG or JPEG logo.');
    }
  }
  if (!font && !image) throw new Error('Enter watermark text or choose a logo.');

  for (const index of indices) {
    const page = doc.getPage(index);
    const view = visiblePage(page);
    const shortSide = Math.min(view.width, view.height);
    const unitWidth = font?.widthOfTextAtSize(text, 1) ?? 1;
    const size = Math.min(shortSide * 0.09, view.width * 0.75 / Math.max(unitWidth, 1));
    const imageScale = image ? Math.min(view.width * 0.32 / image.width, view.height * 0.23 / image.height) : 0;
    const width = image ? image.width * imageScale : unitWidth * size;
    const height = image ? image.height * imageScale : font?.heightAtSize(size, { descender: false }) ?? size;
    const margin = shortSide * 0.05;
    const { position, opacity } = options;
    const left = position.endsWith('left') ? margin : position.endsWith('right') ? view.width - margin - width : (view.width - width) / 2;
    const bottom = position.startsWith('top') ? view.height - margin - height : position.startsWith('bottom') ? margin : (view.height - height) / 2;
    const placement = view.placement(left, bottom);
    if (image) page.drawImage(image, { ...placement, width, height, opacity });
    if (font) page.drawText(text, { ...placement, size, opacity, font, color: rgb(0.64, 0.17, 0.15) });
  }
  return [await exportPdf(doc, outputName(input, 'watermark'))];
}
