import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { Popover, PopoverSurface, PopoverTrigger } from '@fluentui/react-components';
import { ArrowUpRightRegular, DismissRegular, FolderOpenRegular } from '@fluentui/react-icons';
import type { FsNode } from '../../db/types';
import { useDesktopStore } from '../../store/useDesktopStore';
import { useFileSystemStore } from '../../store/useFileSystemStore';
import { openVirtualFile } from '../../utils/openVirtualFile';
import { getFileTypeInfo } from '../../utils/fileTypes';
import { Win10SearchIcon } from './Win10Icons';
import './taskbarSearch.css';

const filters = ['All', 'Apps', 'Files', 'Settings'] as const;
type SearchFilter = typeof filters[number];

function normalize(text: string) {
  return text.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/đ/g, 'd');
}

function getFileLocation(file: FsNode, nodes: Record<string, FsNode>) {
  const folders: string[] = [];
  const visited = new Set<string>();
  let id = file.parentId;
  while (id) {
    const folder = nodes[id];
    if (!folder || folder.kind === 'bin' || visited.has(id)) return null;
    visited.add(id);
    folders.unshift(folder.name);
    id = folder.parentId;
  }
  return folders.length ? folders.join(' › ') : null;
}

interface TaskbarSearchProps {
  placement: 'above' | 'below' | 'before' | 'after';
  iconClass?: string;
  onFocusChange: (focused: boolean) => void;
}

interface SearchResult {
  id: string;
  key: string;
  name: string;
  icon: string;
  location: string | null;
  folderId: string | null;
}

export function TaskbarSearch({ placement, iconClass, onFocusChange }: TaskbarSearchProps) {
  const apps = useDesktopStore((state) => state.apps);
  const pinnedIds = useDesktopStore((state) => state.taskbarSettings.pinnedAppIds);
  const openApp = useDesktopStore((state) => state.openApp);
  const closeStartMenu = useDesktopStore((state) => state.closeStartMenu);
  const nodes = useFileSystemStore((state) => state.nodes);
  const [text, setText] = useState('');
  const [focused, setFocused] = useState(false);
  const [filter, setFilter] = useState<SearchFilter>('All');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  const selectedRow = useRef<HTMLButtonElement>(null);
  const resultsId = useId();
  const iconMode = Boolean(iconClass);
  const query = normalize(text.trim());
  useEffect(() => () => onFocusChange(false), [onFocusChange]);
  const fileResults = useMemo(() => Object.values(nodes).flatMap((file) => {
    if (file.kind !== 'file' || !file.parentId) return [];
    const location = getFileLocation(file, nodes);
    return location ? [{
      id: file.id, name: file.name, icon: file.icon, key: `file:${file.id}`, location, folderId: file.parentId,
      modifiedAt: file.modifiedAt, category: getFileTypeInfo(file).category,
    }] : [];
  }).sort((a, b) => b.modifiedAt - a.modifiedAt), [nodes]);
  const appResults = useMemo<SearchResult[]>(() => apps.map((app) => ({
    ...app, key: `app:${app.id}`, location: null, folderId: null,
  })), [apps]);
  const pinned = pinnedIds.flatMap((id) => appResults.find((app) => app.id === id) ?? []).slice(0, 6);
  const home = !query && filter === 'All';
  const matches = useMemo(() => {
    const rank = (name: string) => {
      const normalized = normalize(name);
      return normalized === query ? 0 : normalized.startsWith(query) ? 1 : normalized.includes(query) ? 2 : -1;
    };
    const candidates = filter === 'All' ? [...appResults, ...fileResults]
      : filter === 'Apps' ? appResults
      : filter === 'Files' ? fileResults
      : appResults.filter((app) => app.id === 'settings');
    if (!query) return candidates;
    return candidates.map((result) => ({ result, score: rank(result.name) }))
      .filter(({ score }) => score >= 0)
      .sort((a, b) => a.score - b.score || a.result.name.localeCompare(b.result.name, 'vi'))
      .map(({ result }) => result);
  }, [appResults, fileResults, filter, query]);
  const selected = home ? undefined : matches.find((match) => match.key === selectedKey) ?? matches[0];
  const related = selected && !selected.folderId && (selected.id === 'excel' || selected.id === 'word')
    ? fileResults.filter((file) => file.category === selected.id).slice(0, 4)
    : [];

  useEffect(() => {
    if (selectedKey && selected?.key === selectedKey) selectedRow.current?.scrollIntoView({ block: 'nearest' });
  }, [selected?.key, selectedKey]);

  const close = () => {
    setFocused(false);
    onFocusChange(false);
  };

  const openResult = (result: SearchResult, reveal = false) => {
    if (result.folderId) {
      if (reveal) openApp('explorer', result.folderId, result.id);
      else openVirtualFile(result.id);
    } else {
      openApp(result.id);
    }
    setText('');
    setFilter('All');
    setSelectedKey(null);
    input.current?.blur();
    close();
  };

  const panel = focused && (
    <section id={resultsId} aria-label="Search results"
      className={`taskbar-search-panel ${iconMode ? '' : placement === 'above' ? 'taskbar-search-above' : 'taskbar-search-below'}`}>
      <header className="taskbar-search-header">
        <div role="group" aria-label="Filter search results" className="taskbar-search-filters">
          {filters.map((name) => (
            <button key={name} type="button" aria-pressed={filter === name} onClick={() => {
              setFilter(name);
              setSelectedKey(null);
              input.current?.focus();
            }}>{name}</button>
          ))}
        </div>
        <button type="button" aria-label="Close search" className="taskbar-search-close" onClick={() => {
          input.current?.blur();
          close();
        }}><DismissRegular aria-hidden /></button>
      </header>
      {home ? (
        <div className="taskbar-search-home">
          {pinned.length > 0 && <section aria-label="Pinned apps">
            <h2>Pinned apps</h2>
            <div className="taskbar-search-tiles">
              {pinned.map((app) => <button type="button" key={app.key} title={app.name} onClick={() => openResult(app)}>
                <img src={app.icon} alt="" /><span>{app.name}</span>
              </button>)}
            </div>
          </section>}
          <section aria-label="Recent files">
            <h2>Recent files</h2>
            {fileResults.length ? <div className="taskbar-search-recent">
              {fileResults.slice(0, 6).map((file) => (
                <button key={file.key} type="button" className="taskbar-search-row" onClick={() => openResult(file)}>
                  <img src={file.icon} alt="" />
                  <span><strong title={file.name}>{file.name}</strong><small title={file.location}>{file.location}</small></span>
                </button>
              ))}
            </div> : <p>No recent files yet.</p>}
          </section>
        </div>
      ) : selected ? (
        <div className="taskbar-search-results">
          <section className="taskbar-search-list" aria-label="Matches">
            <h2>{query ? 'Matches' : filter}</h2>
            <ul>
              {matches.map((result) => (
                <li key={result.key}>
                  <button type="button" className="taskbar-search-row" ref={selected === result ? selectedRow : null}
                    aria-current={selected === result ? 'true' : undefined}
                    onKeyDown={(event) => {
                      if (event.key !== 'Enter') return;
                      event.preventDefault();
                      openResult(result);
                    }}
                    onClick={() => setSelectedKey(result.key)} onDoubleClick={() => openResult(result)}>
                    <img src={result.icon} alt="" />
                    <span><strong title={result.name}>{result.name}</strong>
                      <small title={result.location ?? undefined}>{result.location ?? 'App'}</small></span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <section className="taskbar-search-detail" aria-label="Result details">
            <div className="taskbar-search-identity">
              <img src={selected.icon} alt="" />
              <div><h2 title={selected.name}>{selected.name}</h2><p title={selected.location ?? undefined}>{selected.location ?? 'App'}</p></div>
            </div>
            <div className="taskbar-search-actions">
              <button type="button" onClick={() => openResult(selected)}><ArrowUpRightRegular aria-hidden />Open</button>
              {selected.folderId && (
                <button type="button" onClick={() => openResult(selected, true)}><FolderOpenRegular aria-hidden />Open file location</button>
              )}
            </div>
            {related.length > 0 && <div className="taskbar-search-related">
              <h3>Recent files</h3>
              {related.map((file) => <button key={file.key} type="button" title={file.name} onClick={() => openResult(file)}>
                <img src={file.icon} alt="" /><span>{file.name}</span>
              </button>)}
            </div>}
          </section>
        </div>
      ) : <p role="status" className="taskbar-search-empty">{query ? 'No matches. Try a different name or filter.' : 'No items in this filter yet.'}</p>}
      {selected && <footer className="taskbar-search-help"><span><kbd>↑</kbd> <kbd>↓</kbd> Select</span><span><kbd>Enter</kbd> Open</span></footer>}
    </section>
  );

  const search = (
    <div
      role="search"
      className={iconMode ? 'flex min-w-0 flex-col' : 'relative flex h-full shrink-0 items-center py-[2px] pr-1'}
      onFocus={() => {
        if (iconMode) return;
        closeStartMenu();
        setFocused(true);
        onFocusChange(true);
      }}
      onBlur={(event) => {
        if (!iconMode && !event.currentTarget.contains(event.relatedTarget)) close();
      }}
      onKeyDown={(event) => {
        if (!iconMode && event.key === 'Escape') {
          input.current?.focus();
          close();
        }
      }}
    >
      <div className={`flex items-center gap-2 border px-2.5 ${iconMode
        ? 'm-2 h-9 border-[#0078d7] bg-white text-black'
        : 'h-full w-[min(240px,45vw)] border-white/15 bg-[#2a2a2a] text-white hover:bg-[#333333] focus-within:border-[#0078d7] focus-within:bg-white focus-within:text-black'}`}>
        <Win10SearchIcon className="h-4 w-4 shrink-0 opacity-80" />
        <input ref={input} type="text" value={text} autoComplete="off"
          onChange={(event) => { setText(event.target.value); setSelectedKey(null); setFocused(true); onFocusChange(true); }}
          onClick={() => { setFocused(true); onFocusChange(true); }}
          onKeyDown={(event) => {
            if (!focused || !selected || event.nativeEvent.isComposing) return;
            if (event.key === 'Enter') {
              event.preventDefault();
              openResult(selected);
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              const next = matches.indexOf(selected) + (event.key === 'ArrowDown' ? 1 : -1);
              setSelectedKey(matches[Math.max(0, Math.min(next, matches.length - 1))].key);
            }
          }}
          aria-label="Search apps and files" aria-controls={focused ? resultsId : undefined}
          placeholder="Search apps and files"
          className={`min-w-0 w-full bg-transparent text-[12px] outline-none ${iconMode ? 'placeholder:text-black/55' : 'placeholder:text-white/65 focus:placeholder:text-black/55'}`}
        />
      </div>
      {panel}
    </div>
  );

  if (!iconMode) return search;

  return (
    <Popover open={focused} positioning={{ position: placement, align: 'start', offset: 4 }}
      onOpenChange={(_event, data) => {
        if (data.open) closeStartMenu();
        setFocused(data.open);
        onFocusChange(data.open);
      }}>
      <PopoverTrigger disableButtonEnhancement>
        <button type="button" aria-label="Search" aria-expanded={focused} title="Search apps and files"
          className={`flex items-center justify-center shrink-0 text-white hover:bg-white/10 active:bg-white/15 ${iconClass} ${focused ? 'bg-white/15' : ''}`}>
          <Win10SearchIcon />
        </button>
      </PopoverTrigger>
      <PopoverSurface aria-label="Search apps and files"
        className="!z-[80] !w-[min(680px,calc(100vw-12px))] !rounded-md !border-[#4a5159] !bg-[#22262b] !p-0">
        {search}
      </PopoverSurface>
    </Popover>
  );
}
