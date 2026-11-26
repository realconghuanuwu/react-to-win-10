import { useEffect, useRef, useState, type MouseEvent } from 'react';
import { Button, Spinner } from '@fluentui/react-components';
import { ChevronLeftRegular, ChevronRightRegular, SubtractRegular, AddRegular } from '@fluentui/react-icons';
import { getDocument, GlobalWorkerOptions, type PDFDocumentProxy, type PDFPageProxy } from 'pdfjs-dist';
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import type { PdfBytes, TextMark } from './pdfOperations';

GlobalWorkerOptions.workerSrc = workerUrl;

const assets = import.meta.glob<string>(
  '../../../../node_modules/pdfjs-dist/{cmaps,standard_fonts,wasm}/*.{bcmap,pfb,ttf,otf,wasm}',
  { query: '?url&no-inline', import: 'default', eager: true },
);
const assetByName = new Map(Object.entries(assets).map(([path, url]) => [path.split('/').at(-1), url]));

class BundledPdfData {
  async fetch({ filename }: { filename: string }) {
    const url = assetByName.get(filename);
    if (!url) throw new Error('Missing PDF resource ' + filename);
    const response = await fetch(url);
    if (!response.ok) throw new Error('Could not load PDF resource ' + filename);
    return new Uint8Array(await response.arrayBuffer());
  }
}

interface PdfPreviewProps {
  bytes: PdfBytes;
  name: string;
  pageNumber: number;
  onPage: (page: number) => void;
  marks?: TextMark[];
  onPlace?: (position: Pick<TextMark, 'page' | 'x' | 'y' | 'angle'>) => void;
}

export function PdfPreview({ bytes, name, pageNumber, onPage, marks, onPlace }: PdfPreviewProps) {
  const [doc, setDoc] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState<PDFPageProxy | null>(null);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const [fit, setFit] = useState(1);
  const scroll = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let active = true;
    const task = getDocument({
      data: bytes.slice(), useWorkerFetch: false, BinaryDataFactory: BundledPdfData,
    });
    task.promise.then(
      (loaded) => { if (active) setDoc(loaded); },
      () => { if (active) setError('This PDF could not be previewed.'); },
    );
    return () => {
      active = false;
      void task.destroy().catch(() => undefined);
    };
  }, [bytes]);

  useEffect(() => {
    if (!doc) return;
    let active = true;
    doc.getPage(pageNumber).then(
      (loaded) => { if (active) setPage(loaded); },
      () => { if (active) setError('This page could not be opened.'); },
    );
    return () => { active = false; };
  }, [doc, pageNumber]);

  useEffect(() => {
    const element = scroll.current;
    if (!element || !page) return;
    const original = page.getViewport({ scale: 1 });
    const resize = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      if (width > 0 && height > 0) setFit(Math.max(0.1, Math.min((width - 40) / original.width, (height - 38) / original.height)));
    });
    resize.observe(element);
    return () => resize.disconnect();
  }, [page]);

  const activePage = page?.pageNumber === pageNumber ? page : null;
  const scale = fit * zoom;
  const viewport = activePage?.getViewport({ scale });
  useEffect(() => {
    if (!activePage || !canvas.current) return;
    const element = canvas.current;
    const cssViewport = activePage.getViewport({ scale });
    const density = Math.min(window.devicePixelRatio || 1, 2, 4096 / Math.max(cssViewport.width, cssViewport.height));
    const renderedViewport = activePage.getViewport({ scale: scale * density });
    element.width = Math.max(1, Math.round(renderedViewport.width));
    element.height = Math.max(1, Math.round(renderedViewport.height));
    const task = activePage.render({ canvas: element, viewport: renderedViewport });
    let active = true;
    void task.promise.catch(() => {
      if (active) setError('This page could not be rendered.');
    });
    return () => {
      active = false;
      task.cancel();
    };
  }, [activePage, scale]);

  function place(x: number, y: number) {
    if (!onPlace || !viewport || !activePage) return;
    const [pdfX, pdfY] = viewport.convertToPdfPoint(x, y);
    const [rightX, rightY] = viewport.convertToPdfPoint(x + 1, y);
    const angle = Math.atan2(rightY - pdfY, rightX - pdfX) * 180 / Math.PI;
    onPlace({ page: pageNumber, x: pdfX, y: pdfY, angle });
  }

  function handlePlace(event: MouseEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    place(event.clientX - rect.left, event.clientY - rect.top);
  }

  return (
    <section className="pdf-preview" aria-label="PDF preview">
      <div className="pdf-preview-bar">
        <span className="pdf-file-title" title={name}>{name}</span>
        <div className="pdf-preview-controls">
          <Button appearance="subtle" size="small" icon={<ChevronLeftRegular />} aria-label="Previous page" disabled={pageNumber <= 1} onClick={() => onPage(pageNumber - 1)} />
          <span aria-live="polite">{pageNumber} / {doc?.numPages ?? '–'}</span>
          <Button appearance="subtle" size="small" icon={<ChevronRightRegular />} aria-label="Next page" disabled={!doc || pageNumber >= doc.numPages} onClick={() => onPage(pageNumber + 1)} />
          <span className="pdf-bar-divider" />
          <Button appearance="subtle" size="small" icon={<SubtractRegular />} aria-label="Zoom out" disabled={zoom <= 0.5} onClick={() => setZoom(Math.max(0.5, zoom - 0.25))} />
          <Button appearance="subtle" size="small" title="Fit page" aria-label="Fit page" onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</Button>
          <Button appearance="subtle" size="small" icon={<AddRegular />} aria-label="Zoom in" disabled={zoom >= 3} onClick={() => setZoom(Math.min(3, zoom + 0.25))} />
        </div>
      </div>
      <div className="pdf-canvas-scroll" ref={scroll}>
        {error ? <p className="pdf-preview-message" role="alert">{error}</p> : viewport ? (
          <div
            className="pdf-paper"
            style={{ width: viewport.width, height: viewport.height }}
            role={onPlace ? 'button' : undefined}
            aria-label={onPlace ? 'Place text on the page. Press Enter to place at the center.' : undefined}
            tabIndex={onPlace ? 0 : undefined}
            onClick={onPlace ? handlePlace : undefined}
            onKeyDown={onPlace ? (event) => {
              if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                place(viewport.width / 2, viewport.height / 2);
              }
            } : undefined}
          >
            <canvas ref={canvas} aria-label={'Page ' + pageNumber} />
            {marks?.filter((mark) => mark.page === pageNumber).map((mark) => {
              const [left, top] = viewport.convertToViewportPoint(mark.x, mark.y);
              return <span key={mark.id} className="pdf-placed-text" style={{ left, top, fontSize: mark.size * Math.hypot(viewport.transform[0], viewport.transform[1]) }}>{mark.text}</span>;
            })}
          </div>
        ) : <div className="pdf-preview-message"><Spinner size="small" label="Rendering page…" /></div>}
      </div>
    </section>
  );
}
