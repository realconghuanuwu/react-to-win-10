import { createQpdfImageStreams, type PdfDocument } from '@lipoe/browser-qpdf';
import { toImageBitmap } from '@lipoe/browser-qpdf/codecs';
import wasmUrl from '@lipoe/browser-qpdf/qpdf-image-stream.wasm?url';
import type { PdfBytes } from './pdfOperations';

export type CompressionReply =
  | { bytes: PdfBytes }
  | { error: string };

async function optimizeImages(doc: PdfDocument) {
  const images = doc.getImages({ recursive: true });
  if (!images.ok) throw new Error('The images in this PDF could not be read.');

  for (const info of images.value) {
    const { width, height, masks, colorSpaceInfo } = info;
    const longEdge = Math.max(width, height);
    const colorFamily = colorSpaceInfo?.family;
    // Leave special color spaces and images with coupled transparency intact.
    if (
      longEdge < 900 || width * height > 45_000_000 ||
      info.bitsPerComponent !== 8 || info.decode ||
      (colorFamily !== 'DeviceRGB' && colorFamily !== 'DeviceGray') ||
      masks.isStencilMask || masks.softMask || masks.mask || masks.softMaskInData ||
      masks.softMaskOf.length || masks.maskOf.length
    ) continue;

    const read = doc.readImage(info.objId, info.generation);
    if (!read.ok) continue;
    const scale = Math.min(1, 1800 / longEdge);
    const resizeWidth = Math.max(1, Math.round(width * scale));
    const resizeHeight = Math.max(1, Math.round(height * scale));
    const bitmap = await toImageBitmap(read.value, info, { resizeWidth, resizeHeight, resizeQuality: 'high' });
    if (!bitmap.ok) continue;

    try {
      const canvas = new OffscreenCanvas(resizeWidth, resizeHeight);
      const context = canvas.getContext('2d', { alpha: false });
      if (!context) throw new Error('This browser cannot recompress PDF images.');
      context.drawImage(bitmap.value, 0, 0, resizeWidth, resizeHeight);
      const jpeg = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.72 });
      if (jpeg.type !== 'image/jpeg' || jpeg.size >= info.streamLength) continue;

      const replacement = await jpeg.arrayBuffer();
      const written = doc.replaceImageStream(info.objId, info.generation, new Uint8Array(replacement), {
        width: resizeWidth, height: resizeHeight, bitsPerComponent: 8,
        colorSpace: 'DeviceRGB', filter: 'DCTDecode',
      });
      if (!written.ok) throw new Error('A compressed image could not be written back to the PDF.');
    } finally {
      bitmap.value.close();
    }
  }
}

self.onmessage = async ({ data }: MessageEvent<{ bytes: PdfBytes; strong: boolean }>) => {
  try {
    const qpdf = await createQpdfImageStreams({ locateFile: () => wasmUrl });
    const input = qpdf.loadPdf(data.bytes);
    if (!input.ok) throw new Error('This PDF could not be opened for compression.');
    let bytes: PdfBytes;
    try {
      if (data.strong) await optimizeImages(input.value);
      const output = input.value.writePdf();
      if (!output.ok) throw new Error('The compressed PDF could not be saved.');
      bytes = new Uint8Array(output.value);
    } finally {
      input.value.close();
    }
    self.postMessage({ bytes } satisfies CompressionReply, { transfer: [bytes.buffer] });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : 'The PDF could not be compressed.',
    } satisfies CompressionReply);
  }
};
