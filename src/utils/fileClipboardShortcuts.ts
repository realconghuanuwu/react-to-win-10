import { useFileSystemStore } from '../store/useFileSystemStore';

export function handleFileClipboardShortcut(
  event: KeyboardEvent,
  selectedIds: string[],
  folderId: string,
): boolean {
  if (event.defaultPrevented || event.isComposing || event.altKey || event.shiftKey ||
    !(event.ctrlKey || event.metaKey)) return false;
  if (event.target instanceof HTMLElement &&
    (event.target.isContentEditable || event.target.closest('input, textarea, select'))) return false;
  if (window.getSelection()?.toString()) return false;

  const key = event.key.toLowerCase();
  const { setFileClipboard, pasteFiles } = useFileSystemStore.getState();
  let handled = false;
  if (key === 'c' || key === 'x') {
    handled = setFileClipboard(key === 'c' ? 'copy' : 'cut', selectedIds);
  } else if (key === 'v') {
    handled = pasteFiles(folderId);
  }
  if (handled) event.preventDefault();
  return handled;
}
