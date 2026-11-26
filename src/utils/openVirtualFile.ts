import { useDesktopStore } from '../store/useDesktopStore';
import { useFileSystemStore } from '../store/useFileSystemStore';
import { getFileExtension, getFileTypeInfo } from './fileTypes';

export function openVirtualFile(id: string) {
  const nodes = useFileSystemStore.getState().nodes;
  const file = nodes[id];
  if (file?.kind !== 'file') return;
  const desktop = useDesktopStore.getState();

  if (file.shortcutTarget) {
    const { kind, appId, url, nodeId } = file.shortcutTarget;
    if (kind === 'app' && appId) {
      desktop.openApp(appId);
      return;
    }
    if (kind === 'node' && nodeId && nodes[nodeId]) {
      const target = nodes[nodeId];
      if (target.kind === 'file') {
        openVirtualFile(target.id);
      } else {
        desktop.openApp('explorer', target.id);
      }
      return;
    }
    if (kind === 'url' && url) {
      desktop.openApp('chrome');
      return;
    }
  }

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
