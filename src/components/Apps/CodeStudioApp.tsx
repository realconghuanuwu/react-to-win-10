import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import type { FileSystemTree } from '@webcontainer/api';
import {
  AddRegular,
  ArrowUpRightRegular,
  BracesRegular,
  ChevronDownRegular,
  ChevronRightRegular,
  CodeRegular,
  DismissRegular,
  DocumentRegular,
  FolderOpenRegular,
  FolderRegular,
  PlayFilled,
  StopFilled,
  WindowRegular,
} from '@fluentui/react-icons';
import { editor, languages, Uri } from 'monaco-editor';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import CssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker.js?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';
import { loadProject, saveProject, toFileTree, validateNewPath } from './codeStudioProject';
import { runProject } from './codeStudioRuntime';
import './codeStudio.css';

self.MonacoEnvironment = {
  getWorker(_id, label) {
    if (label === 'javascript' || label === 'typescript') return new TsWorker();
    if (label === 'html') return new HtmlWorker();
    if (label === 'css') return new CssWorker();
    if (label === 'json') return new JsonWorker();
    return new EditorWorker();
  },
};

editor.defineTheme('code-studio', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '829b9c' },
    { token: 'keyword', foreground: 'c3afff' },
    { token: 'string', foreground: 'a3e6be' },
    { token: 'number', foreground: 'ffc491' },
  ],
  colors: {
    'editor.background': '#151e27',
    'editor.foreground': '#e0eaf0',
    'editorLineNumber.foreground': '#8496a5',
    'editorLineNumber.activeForeground': '#bfe7da',
    'editor.lineHighlightBackground': '#1d2b36',
    'editor.selectionBackground': '#2e504e',
    'editorCursor.foreground': '#8be3c3',
  },
});

function FileIcon({ path }: { path: string }) {
  if (/\.[cm]?[jt]sx?$/.test(path)) return <CodeRegular className="studio-script-icon" aria-hidden />;
  if (path.endsWith('.json')) return <BracesRegular className="studio-json-icon" aria-hidden />;
  if (path.endsWith('.html')) return <CodeRegular className="studio-html-icon" aria-hidden />;
  return <DocumentRegular aria-hidden />;
}

interface ProjectTreeProps {
  tree: FileSystemTree;
  parent?: string;
  depth?: number;
  activeFile: string | null;
  collapsedFolders: Set<string>;
  toggleFolder: (path: string) => void;
  openFile: (path: string) => void;
}

function ProjectTree({ tree, parent = '', depth = 0, activeFile, collapsedFolders, toggleFolder, openFile }: ProjectTreeProps) {
  const entries = Object.entries(tree).sort(([leftName, left], [rightName, right]) =>
    Number('directory' in right) - Number('directory' in left) || leftName.localeCompare(rightName),
  );

  return (
    <ul>
      {entries.map(([name, entry]) => {
        const path = parent + name;
        const paddingInlineStart = 8 + depth * 14;
        if ('directory' in entry) {
          const expanded = !collapsedFolders.has(path);
          return (
            <li key={path}>
              <button type="button" aria-expanded={expanded} style={{ paddingInlineStart }} onClick={() => toggleFolder(path)}>
                {expanded ? <ChevronDownRegular aria-hidden /> : <ChevronRightRegular aria-hidden />}
                {expanded ? <FolderOpenRegular aria-hidden /> : <FolderRegular aria-hidden />}
                <span>{name}</span>
              </button>
              {expanded && (
                <ProjectTree tree={entry.directory} parent={path + '/'} depth={depth + 1} activeFile={activeFile}
                  collapsedFolders={collapsedFolders} toggleFolder={toggleFolder} openFile={openFile} />
              )}
            </li>
          );
        }

        return (
          <li key={path}>
            <button type="button" title={path} aria-current={activeFile === path ? 'true' : undefined}
              style={{ paddingInlineStart: paddingInlineStart + 16 }} onClick={() => openFile(path)}>
              <FileIcon path={path} />
              <span>{name}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default function CodeStudioApp() {
  const [files, setFiles] = useState(loadProject);
  const [activeFile, setActiveFile] = useState<string | null>(() => Object.hasOwn(files, 'server.js') ? 'server.js' : 'package.json');
  const [openFiles, setOpenFiles] = useState<string[]>(() => activeFile ? [activeFile] : []);
  const [collapsedFolders, setCollapsedFolders] = useState(() => new Set<string>());
  const [showFiles, setShowFiles] = useState(true);
  const [position, setPosition] = useState({ lineNumber: 1, column: 1 });
  const [language, setLanguage] = useState('');
  const [newPath, setNewPath] = useState<string | null>(null);
  const [fileError, setFileError] = useState('');
  const [storageError, setStorageError] = useState('');
  const [showPreview, setShowPreview] = useState(false);
  const [showOutput, setShowOutput] = useState(true);
  const [output, setOutput] = useState('');
  const [runError, setRunError] = useState('');
  const [running, setRunning] = useState(false);
  const [preview, setPreview] = useState<{ port: number; url: string } | null>(null);
  const editorHost = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const viewStates = useRef(new Map<string, editor.ICodeEditorViewState>());
  const filesRef = useRef(files);
  const runRef = useRef<AbortController | null>(null);
  const outputRef = useRef<HTMLPreElement>(null);
  const tree = useMemo(() => toFileTree(files), [files]);

  useEffect(() => {
    const instance = editor.create(editorHost.current!, {
      model: null,
      theme: 'code-studio',
      automaticLayout: true,
      fontFamily: 'Consolas, monospace',
      fontSize: 13,
      lineHeight: 21,
      minimap: { enabled: false },
      padding: { top: 12, bottom: 12 },
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      ariaLabel: 'Source code',
    });
    editorRef.current = instance;
    const change = instance.onDidChangeModelContent(() => {
      const model = instance.getModel();
      if (!model) return;
      storeFiles({ ...filesRef.current, [model.uri.path.slice('/code-studio/'.length)]: model.getValue() });
    });
    const cursor = instance.onDidChangeCursorPosition(({ position }) => setPosition(position));
    const layout = instance.onDidLayoutChange(({ width }) => {
      const enabled = width >= 660;
      if (instance.getRawOptions().minimap?.enabled !== enabled) {
        instance.updateOptions({ minimap: { enabled, renderCharacters: false, maxColumn: 80 } });
      }
    });
    return () => {
      layout.dispose();
      cursor.dispose();
      change.dispose();
      instance.dispose();
      for (const model of editor.getModels()) {
        if (model.uri.path.startsWith('/code-studio/')) model.dispose();
      }
      editorRef.current = null;
      runRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    const instance = editorRef.current;
    if (!instance) return;
    const previousModel = instance.getModel();
    const previousView = instance.saveViewState();
    if (previousModel && previousView) viewStates.current.set(previousModel.uri.path, previousView);
    if (!activeFile) {
      instance.setModel(null);
      return;
    }
    const uri = Uri.file('/code-studio/' + activeFile);
    const model = editor.getModel(uri) ?? editor.createModel(filesRef.current[activeFile], undefined, uri);
    instance.setModel(model);
    const previousFileView = viewStates.current.get(uri.path);
    if (previousFileView) instance.restoreViewState(previousFileView);
    setPosition(instance.getPosition() ?? { lineNumber: 1, column: 1 });
    const languageId = model.getLanguageId();
    setLanguage(languages.getLanguages().find(({ id }) => id === languageId)?.aliases?.[0] ?? languageId);
    tabsRef.current?.querySelector('[data-active="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [activeFile]);

  useEffect(() => {
    if (outputRef.current) outputRef.current.scrollTop = outputRef.current.scrollHeight;
  }, [output, showOutput]);

  function storeFiles(next: typeof files) {
    filesRef.current = next;
    try {
      saveProject(next);
      setStorageError('');
    } catch {
      setStorageError('Browser storage is unavailable or full. Your latest edits are only in this window.');
    }
  }

  function openFile(path: string) {
    setOpenFiles((current) => current.includes(path) ? current : [...current, path]);
    setActiveFile(path);
    const windowWidth = editorHost.current?.closest('.code-studio')?.clientWidth ?? Infinity;
    if (windowWidth <= 700) setShowPreview(false);
  }

  function closeFile(path: string) {
    const index = openFiles.indexOf(path);
    const next = openFiles.filter((file) => file !== path);
    setOpenFiles(next);
    if (path === activeFile) setActiveFile(next[Math.min(index, next.length - 1)] ?? null);
  }

  function toggleFolder(path: string) {
    const next = new Set(collapsedFolders);
    if (!next.delete(path)) next.add(path);
    setCollapsedFolders(next);
  }

  function createFile(event: FormEvent) {
    event.preventDefault();
    const path = newPath?.trim() ?? '';
    const error = validateNewPath(path, Object.keys(filesRef.current));
    if (error) {
      setFileError(error);
      return;
    }
    const next = { ...filesRef.current, [path]: '' };
    storeFiles(next);
    setFiles(next);
    setCollapsedFolders((current) => new Set([...current].filter((folder) => !path.startsWith(folder + '/'))));
    openFile(path);
    setNewPath(null);
  }

  function stop() {
    runRef.current?.abort();
    runRef.current = null;
    setRunning(false);
    setPreview(null);
    setShowPreview(false);
    setOutput((current) => current + '\nStopped.\n');
  }

  async function run() {
    if (runRef.current) return;
    const controller = new AbortController();
    runRef.current = controller;
    setRunning(true);
    setRunError('');
    setOutput('');
    setShowOutput(true);
    try {
      await runProject(filesRef.current, controller.signal, (chunk) => {
        if (controller.signal.aborted) return;
        const message = chunk.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, '');
        setOutput((current) => (current + message).slice(-32000));
      }, (port, url) => {
        if (controller.signal.aborted) return;
        setPreview((current) => current ?? { port, url });
        setShowPreview(true);
      });
    } catch (error) {
      if (!controller.signal.aborted) {
        setRunError(error instanceof Error ? error.message : 'The runtime could not start.');
      }
    } finally {
      if (runRef.current === controller && !controller.signal.aborted) {
        runRef.current = null;
        setRunning(false);
        setPreview(null);
      }
    }
  }

  return (
    <div className="code-studio">
      <header className="code-studio-toolbar">
        <button className="code-studio-action" type="button" aria-label="Explorer" title="Toggle Explorer"
          aria-pressed={showFiles} onClick={() => setShowFiles(!showFiles)}>
          <FolderOpenRegular aria-hidden />
        </button>
        <span className="code-studio-project" title="Node Playground">Node Playground</span>
        {preview && (
          <button className="code-studio-action" type="button" aria-label="Preview" title="Toggle Preview"
            aria-pressed={showPreview} onClick={() => setShowPreview(!showPreview)}>
            <WindowRegular aria-hidden /> <span className="code-studio-preview-label">Preview</span>
          </button>
        )}
        <button className="code-studio-run" type="button" onClick={running ? stop : run}>
          {running ? <StopFilled aria-hidden /> : <PlayFilled aria-hidden />}
          {running ? 'Stop' : 'Run'}
        </button>
      </header>
      <div className="code-studio-workspace">
        {showFiles && (
          <aside className="code-studio-files" aria-label="Project files">
            <div className="code-studio-heading">
              <span>Explorer</span>
              <button className="code-studio-action" type="button" aria-label="New file" title="New file"
                aria-expanded={newPath !== null} onClick={() => {
                  setNewPath(newPath === null ? '' : null);
                  setFileError('');
                }}>
                <AddRegular aria-hidden />
              </button>
            </div>
            {newPath !== null && (
              <form className="code-studio-add" onSubmit={createFile}>
                <input aria-label="File path" placeholder="src/main.js" value={newPath} autoFocus
                  onChange={(event) => {
                    setNewPath(event.target.value);
                    setFileError('');
                  }}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setNewPath(null);
                  }} />
                <button type="submit">Add</button>
                {fileError && <p role="alert">{fileError}</p>}
              </form>
            )}
            <div className="code-studio-tree">
              <ProjectTree tree={tree} activeFile={activeFile} collapsedFolders={collapsedFolders}
                toggleFolder={toggleFolder} openFile={openFile} />
            </div>
          </aside>
        )}
        <div className="code-studio-main">
          <div className="code-studio-panes" data-preview={Boolean(preview && showPreview)}>
            <section className="code-studio-source" aria-label="Editor">
              <div ref={tabsRef} className="code-studio-tabs" role="group" aria-label="Open files">
                {openFiles.map((path) => (
                  <div className="code-studio-tab" key={path} data-active={activeFile === path}>
                    <button type="button" aria-pressed={activeFile === path} title={path} onClick={() => openFile(path)}>
                      <FileIcon path={path} />
                      <span>{path.split('/').at(-1)}</span>
                    </button>
                    <button type="button" className="code-studio-action" aria-label={`Close ${path}`} title={`Close ${path}`}
                      onClick={() => closeFile(path)}>
                      <DismissRegular aria-hidden />
                    </button>
                  </div>
                ))}
              </div>
              {activeFile ? (
                <div className="code-studio-path" aria-label="File path" title={activeFile}>
                  {activeFile.split('/').map((part, index) => (
                    <span key={index}>{index > 0 && <ChevronRightRegular aria-hidden />}{part}</span>
                  ))}
                </div>
              ) : (
                <p className="code-studio-no-file">Open a file from Explorer.</p>
              )}
              <div ref={editorHost} className="code-studio-editor" hidden={!activeFile} />
            </section>
            {preview && (
              <section className="code-studio-preview" aria-label="Preview" hidden={!showPreview}>
                <div className="code-studio-heading">
                  <span>Preview</span>
                  <a href={preview.url} target="_blank" rel="noopener noreferrer" title="Open preview in a new tab">
                    :{preview.port} <ArrowUpRightRegular aria-hidden />
                  </a>
                </div>
                <iframe title="Application preview" src={preview.url} sandbox="allow-scripts allow-same-origin allow-forms" />
              </section>
            )}
          </div>
          <section className="code-studio-output" aria-label="Output">
            <div className="code-studio-heading">
              <button className="code-studio-action" type="button" aria-expanded={showOutput} onClick={() => setShowOutput(!showOutput)}>
                {showOutput ? <ChevronDownRegular aria-hidden /> : <ChevronRightRegular aria-hidden />}
                Output
              </button>
            </div>
            {showOutput && <pre ref={outputRef} tabIndex={0} aria-label="Server output">{output || 'Run the project to see output.'}</pre>}
            {(runError || storageError) && <div className="code-studio-error" role="alert">{[runError, storageError].filter(Boolean).join(' ')}</div>}
          </section>
        </div>
      </div>
      <footer className="code-studio-status">
        <span role="status" data-running={Boolean(preview)}>
          {preview ? `Listening on port ${preview.port}` : running ? 'Starting…' : runError ? 'Run failed' : 'Idle'}
        </span>
        {activeFile && <span>Ln {position.lineNumber}, Col {position.column}<span className="code-studio-language">{language}</span></span>}
      </footer>
    </div>
  );
}
