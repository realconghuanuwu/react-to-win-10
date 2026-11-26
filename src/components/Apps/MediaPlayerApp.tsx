import { useEffect, useState } from 'react';
import { getMediaBlob } from '../../db/win10Db';
import { useDesktopStore } from '../../store/useDesktopStore';
import { formatStorageBytes, useFileSystemStore } from '../../store/useFileSystemStore';

interface MediaPlayerAppProps {
  windowId: string;
}

export function MediaPlayerApp({ windowId }: MediaPlayerAppProps) {
  const nodes = useFileSystemStore((state) => state.nodes);
  const mediaPlayerFileId = useDesktopStore((state) => state.mediaPlayerFileId);
  const mediaPlayerOpenNonce = useDesktopStore((state) => state.mediaPlayerOpenNonce);
  const setWindowTitle = useDesktopStore((state) => state.setWindowTitle);

  const [objectUrl, setObjectUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const file = mediaPlayerFileId ? nodes[mediaPlayerFileId] : undefined;

  useEffect(() => {
    setWindowTitle(windowId, file ? `${file.name} - Media Player` : 'Media Player');
  }, [windowId, file, setWindowTitle]);

  useEffect(() => {
    let cancelled = false;
    let createdUrl: string | null = null;
    setObjectUrl(null);
    setError(null);

    if (!file?.blobId) {
      return;
    }

    getMediaBlob(file.blobId).then((blob) => {
      if (cancelled) return;
      if (!blob) {
        setError('Media file data not found in IndexedDB.');
        return;
      }
      createdUrl = URL.createObjectURL(blob);
      setObjectUrl(createdUrl);
    });

    return () => {
      cancelled = true;
      if (createdUrl) {
        URL.revokeObjectURL(createdUrl);
      }
    };
  }, [file?.blobId, mediaPlayerOpenNonce]);

  const isAudio =
    file?.mimeType?.startsWith('audio/') ||
    file?.name.toLowerCase().endsWith('.mp3') ||
    file?.name.toLowerCase().endsWith('.m4a');

  return (
    <div className="flex flex-col flex-1 min-h-0 bg-[#0d0d0d] text-white select-none">
      <div className="flex-1 flex flex-col items-center justify-center p-4 min-h-0">
        {!file ? (
          <div className="text-[13px] text-white/60">
            Open any downloaded `.mp4`, `.mp3`, or `.m4a` file from File Explorer or Desktop to play.
          </div>
        ) : error ? (
          <div className="text-[13px] text-[#ff7b7b]">{error}</div>
        ) : !objectUrl ? (
          <div className="text-[13px] text-white/60">Loading media...</div>
        ) : isAudio ? (
          <div className="flex flex-col items-center gap-4 w-full max-w-md p-6 bg-[#1a1a1a] border border-white/10">
            <img src="/assets/icons/media-file.svg" alt="" className="w-16 h-16 object-contain" />
            <div className="text-[14px] font-medium text-center truncate w-full">{file.name}</div>
            <audio src={objectUrl} controls autoPlay className="w-full" />
          </div>
        ) : (
          <video
            src={objectUrl}
            controls
            autoPlay
            className="max-w-full max-h-full w-full h-full object-contain bg-black"
          />
        )}
      </div>

      {file && objectUrl && (
        <footer className="flex items-center justify-between px-4 py-2 bg-[#161616] border-t border-white/10 text-[12px] text-white/75 shrink-0">
          <span className="truncate">
            {file.name} {file.sizeBytes ? `(${formatStorageBytes(file.sizeBytes)})` : ''}
          </span>
          <a
            href={objectUrl}
            download={file.name}
            className="px-3 py-1 bg-[#0078d7] hover:bg-[#198ae6] text-white text-[11.5px] cursor-default shrink-0"
          >
            Save to PC
          </a>
        </footer>
      )}
    </div>
  );
}
