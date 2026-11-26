import { useEffect, useMemo, useRef, useState, type ChangeEvent } from 'react';
import { getMediaBlob } from '../../db/win10Db';
import { useDesktopStore } from '../../store/useDesktopStore';
import { formatStorageBytes, useFileSystemStore, type FsNode } from '../../store/useFileSystemStore';
import { notify } from '../../store/useNotificationStore';
import { getFileTypeInfo } from '../../utils/fileTypes';

interface PhotosAppProps {
  windowId: string;
}

interface PhotoItem {
  id: string;
  name: string;
  src: string;
  isBuiltIn: boolean;
  fsNode?: FsNode;
  sizeBytes?: number;
  modifiedAt: number;
  folderLabel: string;
}

const SAMPLE_PHOTOS: Array<{ id: string; name: string; src: string }> = [
  { id: 'sample-hero', name: 'Windows 10 Hero.jpg', src: '/assets/wallpapers/win10-hero.jpg' },
  { id: 'sample-img1', name: 'Windows 10 Light.jpg', src: '/assets/wallpapers/img1.jpg' },
  { id: 'sample-img2', name: 'Beach Arch.jpg', src: '/assets/wallpapers/img2.jpg' },
  { id: 'sample-img3', name: 'Ocean Wave.jpg', src: '/assets/wallpapers/img3.jpg' },
  { id: 'sample-img4', name: 'Milky Way Tent.jpg', src: '/assets/wallpapers/img4.jpg' },
  { id: 'sample-lock', name: 'Mountain Cave.jpg', src: '/assets/wallpapers/lock-screen.jpg' },
];

type PhotosSection = 'collection' | 'favorites' | 'pictures';

export function PhotosApp({ windowId }: PhotosAppProps) {
  const nodes = useFileSystemStore((state) => state.nodes);
  const importHostFiles = useFileSystemStore((state) => state.importHostFiles);
  const deleteNodes = useFileSystemStore((state) => state.deleteNodes);

  const photosActiveFileId = useDesktopStore((state) => state.photosActiveFileId);
  const photosOpenNonce = useDesktopStore((state) => state.photosOpenNonce);
  const setWindowTitle = useDesktopStore((state) => state.setWindowTitle);
  const updatePersonalizationSettings = useDesktopStore((state) => state.updatePersonalizationSettings);
  const openPaintFile = useDesktopStore((state) => state.openPaintFile);
  const accentColor = useDesktopStore((state) => state.personalizationSettings.accentColor);

  const [blobUrls, setBlobUrls] = useState<Record<string, string>>({});
  const [section, setSection] = useState<PhotosSection>('collection');
  const [searchQuery, setSearchQuery] = useState('');
  const [favorites, setFavorites] = useState<string[]>(['sample-hero', 'sample-img4']);
  const [viewerId, setViewerId] = useState<string | null>(photosActiveFileId);
  const [zoom, setZoom] = useState<number>(1);
  const [rotation, setRotation] = useState<number>(0);
  const [flipH, setFlipH] = useState<boolean>(false);
  const [showInfo, setShowInfo] = useState<boolean>(false);
  const [dimensions, setDimensions] = useState<{ w: number; h: number } | null>(null);
  const [slideshow, setSlideshow] = useState<boolean>(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const fsImageNodes = useMemo(() => {
    return Object.values(nodes)
      .filter((n) => {
        if (n.kind !== 'file' || n.parentId === 'recycle-bin') return false;
        return getFileTypeInfo(n).category === 'image';
      })
      .sort((a, b) => b.modifiedAt - a.modifiedAt);
  }, [nodes]);

  // Load blob URLs for virtual filesystem images
  useEffect(() => {
    let cancelled = false;
    const createdUrls: string[] = [];

    const loadAll = async () => {
      const next: Record<string, string> = {};
      for (const node of fsImageNodes) {
        if (node.blobId) {
          const blob = await getMediaBlob(node.blobId);
          if (blob && !cancelled) {
            const url = URL.createObjectURL(blob);
            createdUrls.push(url);
            next[node.id] = url;
          }
        } else if (node.content) {
          if (node.content.startsWith('data:image/')) {
            next[node.id] = node.content;
          } else if (node.name.toLowerCase().endsWith('.svg')) {
            next[node.id] = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(node.content)}`;
          }
        }
      }
      if (!cancelled) {
        setBlobUrls(next);
      } else {
        createdUrls.forEach((u) => URL.revokeObjectURL(u));
      }
    };

    void loadAll();
    return () => {
      cancelled = true;
      createdUrls.forEach((u) => URL.revokeObjectURL(u));
    };
  }, [fsImageNodes]);

  const allPhotos = useMemo<PhotoItem[]>(() => {
    const fsItems: PhotoItem[] = fsImageNodes
      .filter((n) => Boolean(blobUrls[n.id]))
      .map((n) => ({
        id: n.id,
        name: n.name,
        src: blobUrls[n.id],
        isBuiltIn: false,
        fsNode: n,
        sizeBytes: n.sizeBytes,
        modifiedAt: n.modifiedAt,
        folderLabel: (n.parentId && nodes[n.parentId]?.name) || 'Files',
      }));

    const sampleItems: PhotoItem[] = SAMPLE_PHOTOS.map((s, idx) => ({
      id: s.id,
      name: s.name,
      src: s.src,
      isBuiltIn: true,
      modifiedAt: Date.now() - (idx + 1) * 86400_000,
      folderLabel: 'Sample Pictures',
    }));

    return [...fsItems, ...sampleItems];
  }, [fsImageNodes, blobUrls, nodes]);

  const filteredPhotos = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allPhotos.filter((p) => {
      if (section === 'favorites' && !favorites.includes(p.id)) return false;
      if (section === 'pictures' && p.isBuiltIn) return false;
      if (q && !p.name.toLowerCase().includes(q) && !p.folderLabel.toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });
  }, [allPhotos, section, favorites, searchQuery]);

  // Open target file whenever triggered externally
  useEffect(() => {
    if (photosOpenNonce === 0) return;
    if (photosActiveFileId) {
      setViewerId(photosActiveFileId);
      setZoom(1);
      setRotation(0);
      setFlipH(false);
    }
  }, [photosActiveFileId, photosOpenNonce]);

  const activePhoto = useMemo(
    () => allPhotos.find((p) => p.id === viewerId) ?? null,
    [allPhotos, viewerId],
  );

  useEffect(() => {
    setWindowTitle(windowId, activePhoto ? `${activePhoto.name} - Photos` : 'Photos');
    setDimensions(null);
  }, [windowId, activePhoto, setWindowTitle]);

  const stepPhoto = (delta: -1 | 1) => {
    const list = filteredPhotos.length > 0 ? filteredPhotos : allPhotos;
    if (list.length === 0 || !activePhoto) return;
    const idx = list.findIndex((p) => p.id === activePhoto.id);
    const nextIdx = idx < 0 ? 0 : (idx + delta + list.length) % list.length;
    setViewerId(list[nextIdx].id);
    setZoom(1);
    setRotation(0);
    setFlipH(false);
  };

  // Slideshow timer when enabled
  useEffect(() => {
    if (!slideshow || !activePhoto) return;
    const id = window.setInterval(() => {
      stepPhoto(1);
    }, 3000);
    return () => window.clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slideshow, activePhoto?.id, filteredPhotos.length]);

  const handleImportFiles = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files || files.length === 0) return;
    const importedIds = await importHostFiles('pictures', files);
    e.currentTarget.value = '';
    if (importedIds.length > 0) {
      setSection('pictures');
      setViewerId(importedIds[0]);
      notify({
        kind: 'success',
        source: 'Photos',
        title: 'Photos imported',
        message: `Added ${importedIds.length} image(s) to Pictures.`,
        target: { folderId: 'pictures', fileId: importedIds[0] },
      });
    }
  };

  const handleSetAsWallpaper = (photo: PhotoItem) => {
    updatePersonalizationSettings({
      backgroundType: 'picture',
      wallpaper: photo.src,
    });
    notify({
      kind: 'success',
      source: 'Photos',
      title: 'Desktop background updated',
      message: `${photo.name} is now your desktop wallpaper.`,
      target: { appId: 'settings' },
    });
  };

  const toggleFavorite = (id: string) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const handleDeletePhoto = (photo: PhotoItem) => {
    if (photo.isBuiltIn || !photo.fsNode) return;
    const list = filteredPhotos;
    const idx = list.findIndex((p) => p.id === photo.id);
    const nextPhoto = list[idx + 1] ?? list[idx - 1] ?? null;
    deleteNodes([photo.id]);
    setViewerId(nextPhoto ? nextPhoto.id : null);
  };

  return (
    <div
      tabIndex={0}
      onKeyDown={(e) => {
        if (!activePhoto) return;
        if (e.key === 'ArrowRight') { e.preventDefault(); stepPhoto(1); }
        else if (e.key === 'ArrowLeft') { e.preventDefault(); stepPhoto(-1); }
        else if (e.key === 'Escape') { setSlideshow(false); setViewerId(null); }
        else if (e.key === '+' || e.key === '=') { setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2)))); }
        else if (e.key === '-') { setZoom((z) => Math.max(0.25, Number((z - 0.25).toFixed(2)))); }
      }}
      className="flex-1 flex flex-col min-h-0 bg-[#171717] text-white select-none outline-none"
    >
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        multiple
        onChange={handleImportFiles}
        className="hidden"
      />

      {activePhoto ? (
        /* ── Single Photo Viewer ─────────────────────────────────────────── */
        <div className="flex-1 flex flex-col min-h-0">
          {/* Viewer Top Bar */}
          <div className="h-[44px] bg-[#1f1f1f] border-b border-white/10 px-3 flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2 min-w-0">
              <button
                type="button"
                onClick={() => { setSlideshow(false); setViewerId(null); }}
                className="px-2.5 py-1.5 text-[12px] hover:bg-white/10 flex items-center gap-1.5 cursor-default"
              >
                <span>←</span>
                <span>All photos</span>
              </button>
              <span className="text-white/25">|</span>
              <span className="text-[12.5px] font-medium truncate">{activePhoto.name}</span>
            </div>

            <div className="flex items-center gap-1 shrink-0 text-[12px]">
              <button
                type="button"
                title="Zoom out (-)"
                onClick={() => setZoom((z) => Math.max(0.25, Number((z - 0.25).toFixed(2))))}
                className="px-2 py-1.5 hover:bg-white/10 cursor-default"
              >
                －
              </button>
              <button
                type="button"
                title="Reset zoom"
                onClick={() => setZoom(1)}
                className="px-2 py-1.5 hover:bg-white/10 tabular-nums text-[11.5px] cursor-default"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                title="Zoom in (+)"
                onClick={() => setZoom((z) => Math.min(3, Number((z + 0.25).toFixed(2))))}
                className="px-2 py-1.5 hover:bg-white/10 cursor-default"
              >
                ＋
              </button>
              <button
                type="button"
                title="Rotate 90°"
                onClick={() => setRotation((r) => (r + 90) % 360)}
                className="px-2.5 py-1.5 hover:bg-white/10 cursor-default"
              >
                ↻ Rotate
              </button>
              <button
                type="button"
                title="Flip horizontally"
                onClick={() => setFlipH((f) => !f)}
                className="px-2.5 py-1.5 hover:bg-white/10 cursor-default"
              >
                ⇄ Flip
              </button>
              <button
                type="button"
                title="Favorite"
                onClick={() => toggleFavorite(activePhoto.id)}
                className={`px-2 py-1.5 hover:bg-white/10 cursor-default ${
                  favorites.includes(activePhoto.id) ? 'text-[#ff6b81]' : 'text-white/80'
                }`}
              >
                {favorites.includes(activePhoto.id) ? '♥' : '♡'}
              </button>
              <button
                type="button"
                onClick={() => setSlideshow((s) => !s)}
                style={slideshow ? { backgroundColor: accentColor } : undefined}
                className="hidden md:inline-flex px-2.5 py-1.5 hover:bg-white/10 cursor-default"
              >
                {slideshow ? '⏸ Slideshow' : '▶ Slideshow'}
              </button>
              <button
                type="button"
                onClick={() => handleSetAsWallpaper(activePhoto)}
                className="hidden sm:inline-flex px-2.5 py-1.5 hover:bg-white/10 cursor-default"
              >
                Set as background
              </button>
              {!activePhoto.isBuiltIn && (
                <button
                  type="button"
                  onClick={() => openPaintFile(activePhoto.id)}
                  className="hidden md:inline-flex px-2.5 py-1.5 hover:bg-white/10 cursor-default"
                >
                  Edit in Paint
                </button>
              )}
              <button
                type="button"
                title="File info"
                onClick={() => setShowInfo((v) => !v)}
                className={`px-2.5 py-1.5 hover:bg-white/10 cursor-default ${showInfo ? 'bg-white/15' : ''}`}
              >
                ⓘ
              </button>
              {!activePhoto.isBuiltIn && (
                <button
                  type="button"
                  title="Delete photo"
                  onClick={() => handleDeletePhoto(activePhoto)}
                  className="px-2.5 py-1.5 hover:bg-[#e81123] text-white/90 cursor-default"
                >
                  🗑
                </button>
              )}
            </div>
          </div>

          {/* Main Image Canvas + Optional Info Drawer */}
          <div className="flex-1 min-h-0 flex relative bg-[#0c0c0c]">
            <div className="flex-1 min-w-0 relative flex items-center justify-center overflow-auto p-6">
              <button
                type="button"
                aria-label="Previous photo"
                onClick={() => stepPhoto(-1)}
                className="absolute left-3 top-1/2 -translate-y-1/2 z-10 w-10 h-14 bg-black/55 hover:bg-black/80 border border-white/15 text-[20px] flex items-center justify-center cursor-default"
              >
                ‹
              </button>

              <img
                src={activePhoto.src}
                alt={activePhoto.name}
                draggable={false}
                onLoad={(e) => {
                  setDimensions({
                    w: e.currentTarget.naturalWidth,
                    h: e.currentTarget.naturalHeight,
                  });
                }}
                style={{
                  transform: `scale(${zoom}) rotate(${rotation}deg) scaleX(${flipH ? -1 : 1})`,
                }}
                className="max-w-full max-h-full object-contain transition-transform duration-150 shadow-2xl"
              />

              <button
                type="button"
                aria-label="Next photo"
                onClick={() => stepPhoto(1)}
                className="absolute right-3 top-1/2 -translate-y-1/2 z-10 w-10 h-14 bg-black/55 hover:bg-black/80 border border-white/15 text-[20px] flex items-center justify-center cursor-default"
              >
                ›
              </button>
            </div>

            {showInfo && (
              <aside className="w-[240px] shrink-0 bg-[#1f1f1f] border-l border-white/10 p-4 space-y-3 text-[12px]">
                <div className="text-[14px] font-semibold">File info</div>
                <div>
                  <div className="text-white/50 text-[11px]">Name</div>
                  <div className="break-all">{activePhoto.name}</div>
                </div>
                <div>
                  <div className="text-white/50 text-[11px]">Source</div>
                  <div>{activePhoto.folderLabel}</div>
                </div>
                {dimensions && (
                  <div>
                    <div className="text-white/50 text-[11px]">Dimensions</div>
                    <div>{dimensions.w} × {dimensions.h} px</div>
                  </div>
                )}
                {activePhoto.sizeBytes !== undefined && (
                  <div>
                    <div className="text-white/50 text-[11px]">Size</div>
                    <div>{formatStorageBytes(activePhoto.sizeBytes)}</div>
                  </div>
                )}
                <div>
                  <div className="text-white/50 text-[11px]">Date</div>
                  <div>{new Date(activePhoto.modifiedAt).toLocaleString()}</div>
                </div>
              </aside>
            )}
          </div>
        </div>
      ) : (
        /* ── Collection / Gallery View ───────────────────────────────────── */
        <>
          <div className="h-[48px] bg-[#1f1f1f] border-b border-white/10 px-4 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-1">
              {(
                [
                  { id: 'collection', label: 'Collection' },
                  { id: 'pictures', label: 'Your Pictures' },
                  { id: 'favorites', label: `Favorites (${favorites.length})` },
                ] as const
              ).map((tab) => {
                const active = section === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSection(tab.id)}
                    style={active ? { borderBottomColor: accentColor } : undefined}
                    className={`px-3 h-[48px] text-[13px] border-b-2 cursor-default transition-colors ${
                      active ? 'text-white font-medium' : 'border-transparent text-white/65 hover:text-white'
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search photos..."
                className="h-[30px] w-[170px] bg-[#121212] border border-white/15 px-2.5 text-[12px] text-white outline-none focus:border-[#0078d7]"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                style={{ backgroundColor: accentColor }}
                className="h-[30px] px-3 text-[12px] text-white hover:brightness-110 cursor-default"
              >
                + Import
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto win10-dark-scroll p-5">
            {filteredPhotos.length === 0 ? (
              <div className="h-full flex flex-col items-center justify-center text-white/60 gap-3 py-12">
                <p className="text-[14px]">
                  {section === 'pictures'
                    ? 'No photos saved in your virtual Pictures/Desktop folders yet.'
                    : 'No photos match your filter.'}
                </p>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-1.5 bg-[#2d2d2d] hover:bg-[#3a3a3a] border border-white/15 text-[12.5px] text-white cursor-default"
                >
                  Import images from PC
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                {filteredPhotos.map((photo) => {
                  const isFav = favorites.includes(photo.id);
                  return (
                    <div
                      key={photo.id}
                      onClick={() => {
                        setViewerId(photo.id);
                        setZoom(1);
                        setRotation(0);
                        setFlipH(false);
                      }}
                      className="group relative aspect-[4/3] bg-[#242424] border border-white/10 hover:border-white/45 overflow-hidden cursor-default"
                    >
                      <img
                        src={photo.src}
                        alt={photo.name}
                        draggable={false}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                      />
                      <button
                        type="button"
                        aria-label="Toggle favorite"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFavorite(photo.id);
                        }}
                        className={`absolute top-2 right-2 w-7 h-7 bg-black/55 hover:bg-black/80 flex items-center justify-center text-[13px] transition-opacity ${
                          isFav ? 'opacity-100 text-[#ff6b81]' : 'opacity-0 group-hover:opacity-100 text-white'
                        }`}
                      >
                        {isFav ? '♥' : '♡'}
                      </button>
                      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent px-2.5 py-2">
                        <div className="text-[12px] font-medium truncate">{photo.name}</div>
                        <div className="text-[10.5px] text-white/65 truncate">{photo.folderLabel}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
