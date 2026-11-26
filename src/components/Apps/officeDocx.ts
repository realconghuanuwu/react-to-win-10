import { strFromU8, strToU8, zipSync } from 'fflate';
import { HorizontalAlign, NamedStyleType, type IDocumentData, type ITextStyle } from '@univerjs/presets';
import { readOfficeArchive } from './officeArchive';

const wordNamespace = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
const documentMime = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
const alignment = {
  left: HorizontalAlign.LEFT,
  center: HorizontalAlign.CENTER,
  right: HorizontalAlign.RIGHT,
  both: HorizontalAlign.JUSTIFIED,
} as const;
const headings = [
  NamedStyleType.HEADING_1, NamedStyleType.HEADING_2, NamedStyleType.HEADING_3,
  NamedStyleType.HEADING_4, NamedStyleType.HEADING_5,
];

function child(node: Element | undefined, name: string) {
  return Array.from(node?.children ?? []).find((element) => element.localName === name);
}

function attr(node: Element | undefined, name = 'val') {
  return node?.getAttributeNS(node.namespaceURI, name) ?? '';
}

function enabled(node: Element | undefined) {
  return node && !['0', 'false', 'off', 'none'].includes(attr(node));
}

export function importDocx(buffer: ArrayBuffer, title: string): Partial<IDocumentData> {
  const files = readOfficeArchive(buffer, (name) => name === 'word/document.xml');
  const content = files['word/document.xml'];
  if (!content) throw new Error('This file does not contain a Word document.');
  const xml = new DOMParser().parseFromString(strFromU8(content), 'application/xml');
  const root = xml.documentElement;
  const body = root.localName === 'document' && child(root, 'body');
  if (!body) throw new Error('The Word document could not be read.');

  let dataStream = '';
  const paragraphs: NonNullable<NonNullable<IDocumentData['body']>['paragraphs']> = [];
  const textRuns: NonNullable<NonNullable<IDocumentData['body']>['textRuns']> = [];
  for (const paragraph of Array.from(body.getElementsByTagNameNS(root.namespaceURI, 'p'))) {
    const properties = child(paragraph, 'pPr');
    const namedStyle = attr(child(properties, 'pStyle')).match(/^Heading([1-5])$/i);
    const outline = attr(child(properties, 'outlineLvl'));
    const horizontalAlign = alignment[attr(child(properties, 'jc')) as keyof typeof alignment];
    const paragraphStyle = {
      namedStyleType: namedStyle ? headings[Number(namedStyle[1]) - 1] : outline ? headings[Number(outline)] : undefined,
      horizontalAlign,
    };
    for (const run of Array.from(paragraph.getElementsByTagNameNS(root.namespaceURI, 'r'))) {
      if (run.closest('del, moveFrom') || run.parentElement?.closest('p') !== paragraph) continue;
      const props = child(run, 'rPr');
      const size = Number(attr(child(props, 'sz'))) / 2;
      const font = attr(child(props, 'rFonts'), 'ascii');
      const color = attr(child(props, 'color'));
      const style: ITextStyle = {
        ...(enabled(child(props, 'b')) && { bl: 1 }),
        ...(enabled(child(props, 'i')) && { it: 1 }),
        ...(enabled(child(props, 'u')) && { ul: { s: 1 } }),
        ...(enabled(child(props, 'strike')) && { st: { s: 1 } }),
        ...(size > 0 && { fs: size }),
        ...(font && { ff: font }),
        ...(/^[\da-f]{6}$/i.test(color) && { cl: { rgb: `#${color}` } }),
      };
      const ts = Object.keys(style).length ? style : undefined;
      for (const item of Array.from(run.children)) {
        if (item.localName === 'br' || item.localName === 'cr') {
          if (attr(item, 'type') === 'page') {
            dataStream += '\f';
          } else {
            paragraphs.push({ startIndex: dataStream.length, paragraphId: crypto.randomUUID(), paragraphStyle });
            dataStream += '\r';
          }
          continue;
        }
        const text = item.localName === 't' ? item.textContent ?? '' : item.localName === 'tab' ? '\t' : '';
        if (!text) continue;
        const st = dataStream.length;
        dataStream += text.replace(/[\r\n]/g, ' ');
        if (ts) textRuns.push({ st, ed: dataStream.length, ts });
      }
    }
    paragraphs.push({ startIndex: dataStream.length, paragraphId: crypto.randomUUID(), paragraphStyle });
    dataStream += '\r';
  }
  if (!paragraphs.length) {
    paragraphs.push({ startIndex: 0, paragraphId: crypto.randomUUID() });
    dataStream = '\r';
  }
  return {
    id: crypto.randomUUID(), title,
    body: {
      dataStream: dataStream + '\n', paragraphs, textRuns,
      sectionBreaks: [{ startIndex: dataStream.length, sectionId: crypto.randomUUID() }],
    },
  };
}

function escapeXml(text: string) {
  return text.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]/g, '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function writeRun(text: string, style: ITextStyle | undefined, heading: number) {
  const size = style?.fs ?? (heading >= 0 ? Math.max(12, 20 - heading * 2) : undefined);
  const color = style?.cl?.rgb;
  const properties = [
    style?.ff && `<w:rFonts w:ascii="${escapeXml(style.ff)}" w:hAnsi="${escapeXml(style.ff)}"/>`,
    (style?.bl ?? (heading >= 0)) && '<w:b/>',
    style?.it && '<w:i/>',
    style?.st?.s && '<w:strike/>',
    color && /^#[\da-f]{6}$/i.test(color) && `<w:color w:val="${color.slice(1)}"/>`,
    size && `<w:sz w:val="${Math.round(size * 2)}"/>`,
    style?.ul?.s && '<w:u w:val="single"/>',
  ].filter(Boolean).join('');
  const content = text.split(/([\t\n\f])/).filter(Boolean).map((part) => {
    if (part === '\t') return '<w:tab/>';
    if (part === '\n') return '<w:br/>';
    if (part === '\f') return '<w:br w:type="page"/>';
    return `<w:t xml:space="preserve">${escapeXml(part)}</w:t>`;
  }).join('');
  return `<w:r>${properties ? `<w:rPr>${properties}</w:rPr>` : ''}${content}</w:r>`;
}

export function exportDocx(snapshot: IDocumentData): Blob {
  const body = snapshot.body;
  const stream = (body?.dataStream ?? '').replace(/\r\n$/, '\r');
  const paragraphs = new Map(body?.paragraphs?.map((p) => [p.startIndex, p.paragraphStyle]));
  const runs = [...(body?.textRuns ?? [])].sort((a, b) => a.st - b.st);
  const chunks: string[] = [];
  let runIndex = 0;
  let start = 0;
  for (const text of stream.split('\r')) {
    const end = start + text.length;
    if (start === stream.length && stream.endsWith('\r')) break;
    const style = paragraphs.get(end);
    const heading = headings.indexOf(style?.namedStyleType ?? NamedStyleType.NORMAL_TEXT);
    const align = Object.entries(alignment).find(([, value]) => value === style?.horizontalAlign)?.[0];
    const properties = (align ? `<w:jc w:val="${align}"/>` : '') +
      (heading >= 0 ? `<w:outlineLvl w:val="${heading}"/>` : '');
    let cursor = start;
    const content: string[] = [];
    while (cursor < end) {
      while (runs[runIndex] && runs[runIndex].ed <= cursor) runIndex++;
      const run = runs[runIndex];
      const styled = run && run.st <= cursor;
      const boundary = Math.min(end, styled ? run.ed : run?.st ?? end);
      content.push(writeRun(stream.slice(cursor, boundary), styled ? run.ts : undefined, heading));
      cursor = boundary;
    }
    chunks.push(`<w:p>${properties ? `<w:pPr>${properties}</w:pPr>` : ''}${content.join('')}</w:p>`);
    start = end + 1;
  }

  const xml = '<?xml version="1.0" encoding="UTF-8"?>';
  const archive = zipSync({
    '[Content_Types].xml': strToU8(`${xml}<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Override PartName="/word/document.xml" ContentType="${documentMime}.main+xml"/></Types>`),
    '_rels/.rels': strToU8(`${xml}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>`),
    'word/document.xml': strToU8(`${xml}<w:document xmlns:w="${wordNamespace}"><w:body>${chunks.join('')}<w:sectPr/></w:body></w:document>`),
  });
  return new Blob([archive], { type: documentMime });
}
