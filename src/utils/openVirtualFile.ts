import { useDesktopStore } from '../store/useDesktopStore';
import { useFileSystemStore } from '../store/useFileSystemStore';
import { getFileExtension, getFileTypeInfo } from './fileTypes';

export function openVirtualFile(id: string) {
  const file = useFileSystemStore.getState().nodes[id];
  if (file?.kind !== 'file') return;
  const desktop = useDesktopStore.getState();
  const extension = getFileExtension(file.name);
  const category = getFileTypeInfo(file).category;

  if (category === 'word' || (category === 'excel' && extension !== 'csv')) {
    desktop.openOfficeFile(category, id);
  } else if (category === 'image') {
    desktop.openPaintFile(id);
  } else if (file.blobId || ['mp4', 'webm', 'mp3', 'm4a'].includes(extension)) {
    desktop.openMediaFile(id);
  } else {
    desktop.openNotepadFile(id);
  }
}
