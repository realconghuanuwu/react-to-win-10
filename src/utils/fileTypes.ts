import type { FsNode } from '../db/types';

export type FileCategory = 'folder' | 'drive' | 'bin' | 'audio' | 'video' | 'image' | 'word' | 'excel' | 'text' | 'other';

export interface FileTypeInfo {
  label: string;
  category: FileCategory;
  extension: string;
}

const EXTENSION_MAP: Record<string, { label: string; category: FileCategory }> = {
  // Audio
  mp3: { label: 'MP3 Audio', category: 'audio' },
  m4a: { label: 'M4A Audio', category: 'audio' },
  wav: { label: 'WAV Audio', category: 'audio' },
  flac: { label: 'FLAC Audio', category: 'audio' },
  ogg: { label: 'OGG Audio', category: 'audio' },
  opus: { label: 'OPUS Audio', category: 'audio' },
  aac: { label: 'AAC Audio', category: 'audio' },
  // Video
  mp4: { label: 'MP4 Video', category: 'video' },
  webm: { label: 'WebM Video', category: 'video' },
  mkv: { label: 'MKV Video', category: 'video' },
  avi: { label: 'AVI Video', category: 'video' },
  mov: { label: 'MOV Video', category: 'video' },
  // Images
  png: { label: 'PNG Image', category: 'image' },
  jpg: { label: 'JPEG Image', category: 'image' },
  jpeg: { label: 'JPEG Image', category: 'image' },
  gif: { label: 'GIF Image', category: 'image' },
  webp: { label: 'WebP Image', category: 'image' },
  svg: { label: 'SVG Image', category: 'image' },
  bmp: { label: 'BMP Image', category: 'image' },
  // Office
  unidoc: { label: 'Word Document', category: 'word' },
  doc: { label: 'Word Document', category: 'word' },
  docx: { label: 'Word Document', category: 'word' },
  unisheet: { label: 'Excel Worksheet', category: 'excel' },
  xls: { label: 'Excel Worksheet', category: 'excel' },
  xlsx: { label: 'Excel Worksheet', category: 'excel' },
  csv: { label: 'CSV File', category: 'excel' },
  // Text / Code
  txt: { label: 'Text Document', category: 'text' },
  md: { label: 'Markdown Document', category: 'text' },
  log: { label: 'Log File', category: 'text' },
  json: { label: 'JSON File', category: 'text' },
  pdf: { label: 'PDF Document', category: 'other' },
  zip: { label: 'Compressed (zipped) Folder', category: 'other' },
};

export function getFileExtension(name: string): string {
  const idx = name.lastIndexOf('.');
  if (idx <= 0 || idx === name.length - 1) return '';
  return name.slice(idx + 1).toLowerCase();
}

export function getFileTypeInfo(node: Pick<FsNode, 'name' | 'kind' | 'mimeType'>): FileTypeInfo {
  if (node.kind === 'folder') return { label: 'File folder', category: 'folder', extension: '' };
  if (node.kind === 'drive') return { label: 'Local Disk', category: 'drive', extension: '' };
  if (node.kind === 'bin') return { label: 'Recycle Bin', category: 'bin', extension: '' };

  const ext = getFileExtension(node.name);
  if (ext && EXTENSION_MAP[ext]) {
    return { ...EXTENSION_MAP[ext], extension: ext };
  }
  if (node.mimeType?.startsWith('audio/')) {
    return { label: 'Audio File', category: 'audio', extension: ext };
  }
  if (node.mimeType?.startsWith('video/')) {
    return { label: 'Video File', category: 'video', extension: ext };
  }
  if (node.mimeType?.startsWith('image/')) {
    return { label: 'Image File', category: 'image', extension: ext };
  }
  if (ext) {
    return { label: `${ext.toUpperCase()} File`, category: 'other', extension: ext };
  }
  return { label: 'File', category: 'other', extension: '' };
}
