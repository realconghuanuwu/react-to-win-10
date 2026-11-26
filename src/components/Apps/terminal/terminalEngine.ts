import type { FsNode } from '../../../db/types';
import { formatStorageBytes } from '../../../store/useFileSystemStore';
import type { AppWindow } from '../../../store/useDesktopStore';

export type TerminalProfile = 'cmd' | 'powershell';

export type OutputTone = 'normal' | 'info' | 'success' | 'warn' | 'error' | 'muted' | 'prompt';

export interface TerminalLine {
  id: string;
  text: string;
  tone?: OutputTone;
}

export interface TerminalTheme {
  id: 'campbell' | 'powershell-blue' | 'vintage-green' | 'retro-amber';
  label: string;
  bg: string;
  fg: string;
  promptFg: string;
  mutedFg: string;
}

export const TERMINAL_THEMES: TerminalTheme[] = [
  {
    id: 'campbell',
    label: 'Campbell Dark',
    bg: '#0c0c0c',
    fg: '#cccccc',
    promptFg: '#f2f2f2',
    mutedFg: '#767676',
  },
  {
    id: 'powershell-blue',
    label: 'PowerShell Blue',
    bg: '#012456',
    fg: '#eeedf0',
    promptFg: '#ffff00',
    mutedFg: '#9ab3d5',
  },
  {
    id: 'vintage-green',
    label: 'Phosphor Green',
    bg: '#09120c',
    fg: '#33ff66',
    promptFg: '#99ffb3',
    mutedFg: '#289e48',
  },
  {
    id: 'retro-amber',
    label: 'Retro Amber',
    bg: '#120d06',
    fg: '#ffb000',
    promptFg: '#ffd670',
    mutedFg: '#9c6c10',
  },
];

const USER_SUBFOLDER_IDS = ['desktop', 'documents', 'downloads', 'music', 'pictures', 'videos'] as const;
const USER_SUBFOLDER_NAME_TO_ID: Record<string, string> = {
  desktop: 'desktop',
  documents: 'documents',
  downloads: 'downloads',
  music: 'music',
  pictures: 'pictures',
  videos: 'videos',
};

const KNOWN_COMMANDS = [
  'help', 'cls', 'clear', 'dir', 'ls', 'cd', 'chdir', 'pwd', 'tree',
  'mkdir', 'md', 'rmdir', 'rd', 'del', 'rm', 'erase', 'ren', 'rename',
  'copy', 'move', 'touch', 'type', 'cat', 'echo', 'ver', 'whoami',
  'hostname', 'date', 'time', 'systeminfo', 'tasklist', 'taskkill',
  'ipconfig', 'ping', 'color', 'title', 'start', 'notepad', 'calc',
  'explorer', 'mspaint', 'paint', 'winword', 'word', 'excel', 'chrome',
  'code', 'taskmgr', 'settings', 'photos', 'snip', 'pdf', 'exit',
  'Get-ChildItem', 'Set-Location', 'Get-Location', 'Get-Content',
  'New-Item', 'Remove-Item', 'Rename-Item', 'Get-Process', 'Stop-Process',
  'Get-Date', 'Write-Output', 'Clear-Host',
];

let lineSeq = 1;
export function nextLineId(): string {
  lineSeq += 1;
  return `tl-${Date.now()}-${lineSeq}`;
}

export function getInitialCwdId(nodes: Record<string, FsNode>): string {
  if (nodes['c-users-user']) return 'c-users-user';
  if (nodes['drive-c']) return 'drive-c';
  return 'this-pc';
}

export function getDosPath(nodeId: string, nodes: Record<string, FsNode>): string {
  if (nodeId === 'this-pc') return 'This PC';
  if (nodeId === 'drive-c') return 'C:\\';
  if (nodeId === 'drive-d') return 'D:\\';
  if (nodeId === 'recycle-bin') return 'C:\\$Recycle.Bin';

  if (USER_SUBFOLDER_NAME_TO_ID[nodeId]) {
    const node = nodes[nodeId];
    return `C:\\Users\\User\\${node?.name ?? nodeId}`;
  }

  const parts: string[] = [];
  let cur: FsNode | undefined = nodes[nodeId];
  const visited = new Set<string>();
  while (cur && !visited.has(cur.id)) {
    visited.add(cur.id);
    if (cur.id === 'drive-c') {
      parts.unshift('C:');
      break;
    }
    if (cur.id === 'drive-d') {
      parts.unshift('D:');
      break;
    }
    if (USER_SUBFOLDER_NAME_TO_ID[cur.id]) {
      parts.unshift(`C:\\Users\\User\\${cur.name}`);
      break;
    }
    if (cur.id === 'this-pc') {
      parts.unshift('This PC');
      break;
    }
    parts.unshift(cur.name);
    cur = cur.parentId ? nodes[cur.parentId] : undefined;
  }

  if (parts.length === 0) return 'C:\\Users\\User';
  if (parts.length === 1 && (parts[0] === 'C:' || parts[0] === 'D:')) return `${parts[0]}\\`;
  return parts.join('\\');
}

export function getParentFolderId(nodeId: string, nodes: Record<string, FsNode>): string {
  if (USER_SUBFOLDER_NAME_TO_ID[nodeId] && nodes['c-users-user']) {
    return 'c-users-user';
  }
  const node = nodes[nodeId];
  if (!node?.parentId) return nodeId;
  return node.parentId;
}

export function getFolderChildren(folderId: string, nodes: Record<string, FsNode>): FsNode[] {
  const direct = Object.values(nodes).filter((n) => n.parentId === folderId);
  if (folderId === 'c-users-user') {
    const extra = USER_SUBFOLDER_IDS
      .map((id) => nodes[id])
      .filter((n): n is FsNode => Boolean(n) && !direct.some((d) => d.id === n.id));
    return [...extra, ...direct];
  }
  return direct;
}

export function resolveVirtualPath(
  cwdId: string,
  rawPath: string,
  nodes: Record<string, FsNode>,
): string | null {
  const cleaned = rawPath.trim().replace(/^"(.*)"$/, '$1').replace(/\//g, '\\');
  if (!cleaned || cleaned === '.') return cwdId;

  const upper = cleaned.toUpperCase();
  if (upper === '~' || upper === '%USERPROFILE%' || upper === '$ENV:USERPROFILE') {
    return getInitialCwdId(nodes);
  }
  if (upper === 'C:' || upper === 'C:\\') return nodes['drive-c'] ? 'drive-c' : null;
  if (upper === 'D:' || upper === 'D:\\') return nodes['drive-d'] ? 'drive-d' : null;

  let currentId = cwdId;
  let rest = cleaned;

  if (/^C:\\/i.test(rest)) {
    currentId = 'drive-c';
    rest = rest.slice(3);
  } else if (/^D:\\/i.test(rest)) {
    currentId = 'drive-d';
    rest = rest.slice(3);
  } else if (rest.startsWith('\\')) {
    currentId = cwdId === 'drive-d' || getDosPath(cwdId, nodes).startsWith('D:') ? 'drive-d' : 'drive-c';
    rest = rest.slice(1);
  }

  const segments = rest.split('\\').filter(Boolean);
  for (const seg of segments) {
    if (seg === '.') continue;
    if (seg === '..') {
      currentId = getParentFolderId(currentId, nodes);
      continue;
    }
    const children = getFolderChildren(currentId, nodes);
    const match = children.find((n) => n.name.toLowerCase() === seg.toLowerCase());
    if (!match) return null;
    currentId = match.id;
  }

  return currentId;
}

export function tokenizeCommand(input: string): string[] {
  const tokens: string[] = [];
  let cur = '';
  let quote: '"' | "'" | null = null;
  for (let i = 0; i < input.length; i += 1) {
    const ch = input[i];
    if (quote) {
      if (ch === quote) quote = null;
      else cur += ch;
      continue;
    }
    if (ch === '"' || ch === "'") {
      quote = ch;
    } else if (/\s/.test(ch)) {
      if (cur.length > 0) {
        tokens.push(cur);
        cur = '';
      }
    } else {
      cur += ch;
    }
  }
  if (cur.length > 0) tokens.push(cur);
  return tokens;
}

export function getAutocompleteSuggestions(
  cwdId: string,
  rawInput: string,
  nodes: Record<string, FsNode>,
): { completed: string; suggestions: string[] } {
  const trimmedStart = rawInput.trimStart();
  if (!trimmedStart) return { completed: rawInput, suggestions: [] };

  const endsWithSpace = /\s$/.test(rawInput);
  const tokens = tokenizeCommand(trimmedStart);

  // Command completion when editing first token
  if (tokens.length === 1 && !endsWithSpace) {
    const prefix = tokens[0].toLowerCase();
    const matches = KNOWN_COMMANDS.filter((c) => c.toLowerCase().startsWith(prefix));
    if (matches.length === 1) {
      return { completed: `${matches[0]} `, suggestions: [] };
    }
    if (matches.length > 1) {
      return { completed: rawInput, suggestions: matches.slice(0, 12) };
    }
    return { completed: rawInput, suggestions: [] };
  }

  // File / folder name completion on trailing argument
  const partial = endsWithSpace ? '' : (tokens[tokens.length - 1] ?? '');
  const children = getFolderChildren(cwdId, nodes)
    .slice()
    .sort((a, b) => a.name.localeCompare(b.name));
  const matches = children.filter((n) => n.name.toLowerCase().startsWith(partial.toLowerCase()));
  if (matches.length === 0) return { completed: rawInput, suggestions: [] };

  const chosen = matches[0];
  const formatted = chosen.name.includes(' ') ? `"${chosen.name}"` : chosen.name;

  if (endsWithSpace) {
    return {
      completed: `${rawInput}${formatted}`,
      suggestions: matches.length > 1 ? matches.map((m) => m.name) : [],
    };
  }

  const lastArgIdx = rawInput.lastIndexOf(partial);
  const prefix = lastArgIdx >= 0 ? rawInput.slice(0, lastArgIdx) : `${rawInput} `;
  return {
    completed: `${prefix}${formatted}`,
    suggestions: matches.length > 1 ? matches.map((m) => m.name) : [],
  };
}

function formatDosTimestamp(ts: number): string {
  const d = new Date(ts);
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const yr = d.getFullYear();
  let hr = d.getHours();
  const ap = hr >= 12 ? 'PM' : 'AM';
  hr = hr % 12 || 12;
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${mo}/${dd}/${yr}  ${String(hr).padStart(2, '0')}:${min} ${ap}`;
}

export function resolveCmdColorAttr(attr: string): { bg?: string; fg?: string } | null {
  const clean = attr.trim().toLowerCase();
  if (!/^[0-9a-f]{1,2}$/.test(clean)) return null;
  const palette: Record<string, string> = {
    '0': '#0c0c0c',
    '1': '#0037da',
    '2': '#13a10e',
    '3': '#3a96dd',
    '4': '#c50f1f',
    '5': '#881798',
    '6': '#c19c00',
    '7': '#cccccc',
    '8': '#767676',
    '9': '#3b78ff',
    a: '#16c60c',
    b: '#61d6d6',
    c: '#e74856',
    d: '#b4009e',
    e: '#f9f1a5',
    f: '#f2f2f2',
  };
  if (clean.length === 1) return { fg: palette[clean[0]] };
  if (clean[0] === clean[1]) return null;
  return { bg: palette[clean[0]], fg: palette[clean[1]] };
}

export interface ExecutionContext {
  cwdId: string;
  profile: TerminalProfile;
  userName: string;
  wifiEnabled: boolean;
  airplaneMode: boolean;
  networkName: string;
  windows: AppWindow[];
  nodes: Record<string, FsNode>;
  storageUsedBytes: number;
  storageQuotaBytes: number;
  fsActions: {
    createFolder: (parentId: string, desiredName?: string) => string | null;
    createTextFile: (parentId: string, desiredName?: string, content?: string) => string | null;
    updateFileContent: (id: string, content: string) => void;
    renameNode: (id: string, newName: string) => void;
    deleteNodes: (ids: string[]) => void;
    moveNodes: (ids: string[], destinationId: string) => boolean;
  };
  desktopActions: {
    openApp: (id: string, explorerFolderId?: string, revealFileId?: string, forceNew?: boolean) => void;
    openNotepadFile: (fileId: string) => void;
    openPhotoFile: (fileId: string) => void;
    openOfficeFile: (appId: 'word' | 'excel', fileId: string) => void;
    closeWindow: (id: string) => void;
  };
  tabActions: {
    clearScreen: () => void;
    setCwdId: (nextId: string) => void;
    setTitle: (title: string) => void;
    setCustomColors: (colors: { bg?: string; fg?: string } | null) => void;
    exitTab: () => void;
    appendAsyncLine: (line: TerminalLine) => void;
    startPing: (host: string, count?: number) => void;
  };
}

export function buildBannerLines(profile: TerminalProfile): TerminalLine[] {
  if (profile === 'powershell') {
    return [
      { id: nextLineId(), text: 'Windows PowerShell', tone: 'normal' },
      { id: nextLineId(), text: 'Copyright (C) Microsoft Corporation. All rights reserved.', tone: 'normal' },
      { id: nextLineId(), text: '', tone: 'normal' },
      { id: nextLineId(), text: 'Try the new cross-platform PowerShell or type "help" for available commands.', tone: 'muted' },
      { id: nextLineId(), text: '', tone: 'normal' },
    ];
  }
  return [
    { id: nextLineId(), text: 'Microsoft Windows [Version 10.0.19045.4651]', tone: 'normal' },
    { id: nextLineId(), text: '(c) Microsoft Corporation. All rights reserved.', tone: 'normal' },
    { id: nextLineId(), text: '', tone: 'normal' },
  ];
}

export function formatPrompt(profile: TerminalProfile, cwdId: string, nodes: Record<string, FsNode>): string {
  const path = getDosPath(cwdId, nodes);
  return profile === 'powershell' ? `PS ${path}>` : `${path}>`;
}

export function executeTerminalCommand(rawInput: string, ctx: ExecutionContext): TerminalLine[] {
  const trimmed = rawInput.trim();
  if (!trimmed) return [];

  // Output redirection support for echo / type (`>` and `>>`)
  const redirectMatch = trimmed.match(/^(.*?)\s*(>>|>)\s*(.+)$/);
  if (redirectMatch && !trimmed.startsWith('"$') && /^(echo|Write-Output|type|cat)\b/i.test(redirectMatch[1].trim())) {
    const [, lhs, op, rhsRaw] = redirectMatch;
    const rhsName = rhsRaw.trim().replace(/^"(.*)"$/, '$1');
    if (!rhsName) {
      return [{ id: nextLineId(), text: 'The syntax of the command is incorrect.', tone: 'error' }];
    }
    const lhsTokens = tokenizeCommand(lhs.trim());
    const lhsCmd = (lhsTokens[0] ?? '').toLowerCase();
    let payload = '';
    if (lhsCmd === 'echo' || lhsCmd === 'write-output') {
      const arg = lhs.trim().slice(lhsTokens[0].length).trim();
      payload = arg.toLowerCase() === 'nul' ? '' : arg.replace(/^"(.*)"$/, '$1');
    } else if (lhsCmd === 'type' || lhsCmd === 'cat') {
      const targetArg = lhsTokens[1];
      if (targetArg?.toLowerCase() === 'nul') {
        payload = '';
      } else {
        const srcId = targetArg ? resolveVirtualPath(ctx.cwdId, targetArg, ctx.nodes) : null;
        const srcNode = srcId ? ctx.nodes[srcId] : undefined;
        if (!srcNode || srcNode.kind !== 'file') {
          return [{ id: nextLineId(), text: 'The system cannot find the file specified.', tone: 'error' }];
        }
        payload = srcNode.content ?? '';
      }
    }

    const existing = getFolderChildren(ctx.cwdId, ctx.nodes).find(
      (n) => n.name.toLowerCase() === rhsName.toLowerCase(),
    );
    if (existing && existing.kind !== 'file') {
      return [{ id: nextLineId(), text: 'Access is denied.', tone: 'error' }];
    }
    if (existing) {
      const nextText = op === '>>'
        ? `${existing.content ?? ''}${existing.content ? '\n' : ''}${payload}`
        : payload;
      ctx.fsActions.updateFileContent(existing.id, nextText);
      return [];
    }
    const createdId = ctx.fsActions.createTextFile(ctx.cwdId, rhsName, payload);
    if (!createdId) {
      return [{ id: nextLineId(), text: 'Cannot create file in current directory.', tone: 'error' }];
    }
    return [];
  }

  const tokens = tokenizeCommand(trimmed);
  if (tokens.length === 0) return [];
  const rawCmd = tokens[0];
  const cmd = rawCmd.toLowerCase();
  const args = tokens.slice(1);
  const out: TerminalLine[] = [];
  const push = (text: string, tone: OutputTone = 'normal') => out.push({ id: nextLineId(), text, tone });

  // PowerShell variables
  if (cmd === '$psversiontable') {
    push('Name                           Value');
    push('----                           -----');
    push('PSVersion                      5.1.19041.4648');
    push('PSEdition                      Desktop');
    push('PSCompatibleVersions           {1.0, 2.0, 3.0, 4.0...}');
    push('BuildVersion                   10.0.19041.4648');
    return out;
  }
  if (cmd === '$env:username') {
    push(ctx.userName);
    return out;
  }
  if (cmd === '$env:computername') {
    push('DESKTOP-WIN10');
    return out;
  }
  if (cmd === '$env:userprofile') {
    push('C:\\Users\\User');
    return out;
  }
  if (cmd === '$env:os') {
    push('Windows_NT');
    return out;
  }

  // Clear / Exit
  if (cmd === 'cls' || cmd === 'clear' || cmd === 'clear-host') {
    ctx.tabActions.clearScreen();
    return [];
  }
  if (cmd === 'exit') {
    ctx.tabActions.exitTab();
    return [];
  }

  // Help
  if (cmd === 'help') {
    push('Available Windows 10 Terminal commands:', 'info');
    push('  DIR / LS           Displays a list of files and subdirectories in a directory.');
    push('  CD [path]          Displays the name of or changes the current directory.');
    push('  TREE               Graphically displays the folder structure of current directory.');
    push('  MKDIR / MD [name]  Creates a directory.');
    push('  TOUCH [file]       Creates a new empty text file.');
    push('  TYPE / CAT [file]  Displays the contents of a text file.');
    push('  ECHO [text] [> f]  Displays messages or writes/appends text to a file.');
    push('  REN [old] [new]    Renames a file or directory.');
    push('  DEL / RM [target]  Moves a file or folder to the Recycle Bin.');
    push('  MOVE [src] [dest]  Moves files/folders to another directory.');
    push('  CLS / CLEAR        Clears the screen.');
    push('  TASKLIST           Displays currently open apps and system processes.');
    push('  TASKKILL /IM name  Ends a running window (e.g. taskkill /IM notepad).');
    push('  IPCONFIG           Displays network adapter configuration.');
    push('  PING [host]        Sends ICMP echo requests to test connectivity.');
    push('  SYSTEMINFO         Displays OS, memory, storage, and network details.');
    push('  COLOR [attr]       Sets console foreground/background color (e.g. color 0a).');
    push('  TITLE [text]       Sets the current tab title.');
    push('  START [app]        Launches Notepad, Calc, Explorer, Paint, Word, Excel, Chrome, etc.');
    push('  EXIT               Closes the current tab or terminal window.');
    return out;
  }

  // Drive switching e.g. `C:` or `D:`
  if (cmd === 'c:' || cmd === 'd:') {
    const driveId = cmd === 'c:' ? 'drive-c' : 'drive-d';
    if (ctx.nodes[driveId]) {
      ctx.tabActions.setCwdId(driveId);
      return [];
    }
    push('The system cannot find the drive specified.', 'error');
    return out;
  }

  // pwd / Get-Location
  if (cmd === 'pwd' || cmd === 'get-location') {
    if (ctx.profile === 'powershell') {
      push('');
      push('Path');
      push('----');
      push(getDosPath(ctx.cwdId, ctx.nodes));
      push('');
    } else {
      push(getDosPath(ctx.cwdId, ctx.nodes));
    }
    return out;
  }

  // cd / chdir / Set-Location
  if (cmd === 'cd' || cmd === 'chdir' || cmd === 'set-location' || cmd === 'cd..') {
    const targetRaw = cmd === 'cd..' ? '..' : args.join(' ').trim();
    if (!targetRaw) {
      push(getDosPath(ctx.cwdId, ctx.nodes));
      return out;
    }
    const nextId = resolveVirtualPath(ctx.cwdId, targetRaw, ctx.nodes);
    if (!nextId) {
      push('The system cannot find the path specified.', 'error');
      return out;
    }
    const targetNode = ctx.nodes[nextId];
    if (!targetNode || (targetNode.kind !== 'folder' && targetNode.kind !== 'drive' && targetNode.kind !== 'root')) {
      push('The directory name is invalid.', 'error');
      return out;
    }
    ctx.tabActions.setCwdId(nextId);
    return [];
  }

  // dir / ls / Get-ChildItem
  if (cmd === 'dir' || cmd === 'ls' || cmd === 'get-childitem') {
    const targetId = args[0] ? resolveVirtualPath(ctx.cwdId, args[0], ctx.nodes) : ctx.cwdId;
    if (!targetId || !ctx.nodes[targetId]) {
      push('File Not Found', 'error');
      return out;
    }
    const children = getFolderChildren(targetId, ctx.nodes)
      .slice()
      .sort((a, b) => {
        const aDir = a.kind !== 'file' ? 0 : 1;
        const bDir = b.kind !== 'file' ? 0 : 1;
        return aDir - bDir || a.name.localeCompare(b.name);
      });

    const dirPath = getDosPath(targetId, ctx.nodes);
    push(' Volume in drive C has no label.');
    push(' Volume Serial Number is 8A4F-210C');
    push('');
    push(` Directory of ${dirPath}`, 'info');
    push('');

    let fileCount = 0;
    let dirCount = 0;
    let totalBytes = 0;

    if (targetId !== 'this-pc' && targetId !== 'drive-c' && targetId !== 'drive-d') {
      const curTime = formatDosTimestamp(ctx.nodes[targetId].modifiedAt);
      push(`${curTime}    <DIR>          .`);
      push(`${curTime}    <DIR>          ..`);
      dirCount += 2;
    }

    for (const item of children) {
      const ts = formatDosTimestamp(item.modifiedAt);
      if (item.kind === 'folder' || item.kind === 'drive' || item.kind === 'root') {
        dirCount += 1;
        push(`${ts}    <DIR>          ${item.name}`);
      } else {
        fileCount += 1;
        const bytes = item.sizeBytes ?? new TextEncoder().encode(item.content ?? '').length;
        totalBytes += bytes;
        push(`${ts}    ${String(bytes).padStart(14, ' ')} ${item.name}`);
      }
    }

    const freeBytes = Math.max(0, ctx.storageQuotaBytes - ctx.storageUsedBytes);
    push(`               ${fileCount} File(s)    ${totalBytes.toLocaleString()} bytes`);
    push(`               ${dirCount} Dir(s)     ${freeBytes.toLocaleString()} bytes free`);
    return out;
  }

  // tree
  if (cmd === 'tree') {
    const targetId = args[0] ? resolveVirtualPath(ctx.cwdId, args[0], ctx.nodes) : ctx.cwdId;
    if (!targetId || !ctx.nodes[targetId]) {
      push('Invalid path - ' + (args[0] ?? ''), 'error');
      return out;
    }
    push(`Folder PATH listing for ${getDosPath(targetId, ctx.nodes)}`, 'info');
    const walk = (parentId: string, prefix: string, depth: number) => {
      if (depth > 4) return;
      const dirs = getFolderChildren(parentId, ctx.nodes)
        .filter((n) => n.kind === 'folder' || n.kind === 'drive')
        .sort((a, b) => a.name.localeCompare(b.name));
      dirs.forEach((d, idx) => {
        const isLast = idx === dirs.length - 1;
        push(`${prefix}${isLast ? '└───' : '├───'}${d.name}`);
        walk(d.id, `${prefix}${isLast ? '    ' : '│   '}`, depth + 1);
      });
    };
    walk(targetId, '', 0);
    return out;
  }

  // mkdir / md / New-Item
  if (cmd === 'mkdir' || cmd === 'md' || cmd === 'new-item') {
    const name = args.filter((a) => !a.startsWith('-')).join(' ').trim();
    if (!name) {
      push('The syntax of the command is incorrect.', 'error');
      return out;
    }
    const created = ctx.fsActions.createFolder(ctx.cwdId, name);
    if (!created) {
      push('Cannot create directory here.', 'error');
      return out;
    }
    push(`Created folder "${name}" in ${getDosPath(ctx.cwdId, ctx.nodes)}.`, 'success');
    return out;
  }

  // touch
  if (cmd === 'touch') {
    const name = args[0];
    if (!name) {
      push('Usage: touch <filename>', 'error');
      return out;
    }
    const existing = getFolderChildren(ctx.cwdId, ctx.nodes).find(
      (n) => n.name.toLowerCase() === name.toLowerCase(),
    );
    if (existing) {
      if (existing.kind === 'file') ctx.fsActions.updateFileContent(existing.id, existing.content ?? '');
      return [];
    }
    const created = ctx.fsActions.createTextFile(ctx.cwdId, name, '');
    if (!created) {
      push('Cannot create file in current directory.', 'error');
      return out;
    }
    push(`Created file "${name}".`, 'success');
    return out;
  }

  // type / cat / Get-Content
  if (cmd === 'type' || cmd === 'cat' || cmd === 'get-content') {
    const target = args[0];
    if (!target) {
      push('The syntax of the command is incorrect.', 'error');
      return out;
    }
    const nodeId = resolveVirtualPath(ctx.cwdId, target, ctx.nodes);
    const node = nodeId ? ctx.nodes[nodeId] : undefined;
    if (!node) {
      push('The system cannot find the file specified.', 'error');
      return out;
    }
    if (node.kind !== 'file') {
      push('Access is denied.', 'error');
      return out;
    }
    if (node.blobId && !node.content) {
      push(`[Binary file: ${node.name} (${formatStorageBytes(node.sizeBytes ?? 0)})]`, 'muted');
      return out;
    }
    const lines = (node.content ?? '').split(/\r?\n/);
    lines.forEach((l) => push(l));
    return out;
  }

  // del / rm / erase / rmdir / rd / Remove-Item
  if (cmd === 'del' || cmd === 'rm' || cmd === 'erase' || cmd === 'rmdir' || cmd === 'rd' || cmd === 'remove-item') {
    const targets = args.filter((a) => !a.startsWith('-') && !a.startsWith('/'));
    if (targets.length === 0) {
      push('The syntax of the command is incorrect.', 'error');
      return out;
    }
    const idsToDelete: string[] = [];
    for (const t of targets) {
      const resolved = resolveVirtualPath(ctx.cwdId, t, ctx.nodes);
      const node = resolved ? ctx.nodes[resolved] : undefined;
      if (!node) {
        push(`Could Not Find ${t}`, 'error');
        return out;
      }
      if (node.isSystem) {
        push(`Access is denied: "${node.name}" is a protected system item.`, 'error');
        return out;
      }
      idsToDelete.push(node.id);
    }
    ctx.fsActions.deleteNodes(idsToDelete);
    push(`Moved ${idsToDelete.length} item(s) to Recycle Bin.`, 'success');
    return out;
  }

  // ren / rename / Rename-Item
  if (cmd === 'ren' || cmd === 'rename' || cmd === 'rename-item') {
    if (args.length < 2) {
      push('The syntax of the command is incorrect.', 'error');
      return out;
    }
    const resolved = resolveVirtualPath(ctx.cwdId, args[0], ctx.nodes);
    const node = resolved ? ctx.nodes[resolved] : undefined;
    if (!node) {
      push('The system cannot find the file specified.', 'error');
      return out;
    }
    if (node.isSystem) {
      push('Access is denied.', 'error');
      return out;
    }
    ctx.fsActions.renameNode(node.id, args[1]);
    push(`Renamed "${node.name}" to "${args[1]}".`, 'success');
    return out;
  }

  // move / Move-Item
  if (cmd === 'move' || cmd === 'move-item') {
    if (args.length < 2) {
      push('The syntax of the command is incorrect.', 'error');
      return out;
    }
    const srcId = resolveVirtualPath(ctx.cwdId, args[0], ctx.nodes);
    const destId = resolveVirtualPath(ctx.cwdId, args[1], ctx.nodes);
    const srcNode = srcId ? ctx.nodes[srcId] : undefined;
    const destNode = destId ? ctx.nodes[destId] : undefined;
    if (!srcNode || !destNode || (destNode.kind !== 'folder' && destNode.kind !== 'drive')) {
      push('The system cannot find the path specified.', 'error');
      return out;
    }
    if (srcNode.isSystem) {
      push('Access is denied.', 'error');
      return out;
    }
    const ok = ctx.fsActions.moveNodes([srcNode.id], destNode.id);
    if (!ok) {
      push('Unable to move the specified item.', 'error');
      return out;
    }
    push(`        1 item(s) moved.`, 'success');
    return out;
  }

  // echo / Write-Output
  if (cmd === 'echo' || cmd === 'write-output') {
    const rest = trimmed.slice(rawCmd.length).trim();
    push(rest);
    return out;
  }

  // Basic info
  if (cmd === 'ver') {
    push('');
    push('Microsoft Windows [Version 10.0.19045.4651]');
    return out;
  }
  if (cmd === 'whoami') {
    push(`desktop-win10\\${ctx.userName.toLowerCase()}`);
    return out;
  }
  if (cmd === 'hostname') {
    push('DESKTOP-WIN10');
    return out;
  }
  if (cmd === 'date' || cmd === 'get-date') {
    push(`The current date is: ${new Date().toLocaleDateString('en-US', { weekday: 'short', year: 'numeric', month: '2-digit', day: '2-digit' })}`);
    if (cmd === 'get-date') push(`The current time is: ${new Date().toLocaleTimeString()}`);
    return out;
  }
  if (cmd === 'time') {
    push(`The current time is: ${new Date().toLocaleTimeString()}`);
    return out;
  }

  // systeminfo
  if (cmd === 'systeminfo') {
    push('Host Name:                 DESKTOP-WIN10', 'info');
    push('OS Name:                   Microsoft Windows 10 Pro');
    push('OS Version:                10.0.19045 N/A Build 19045');
    push(`Registered Owner:          ${ctx.userName}`);
    push('System Type:               x64-based PC');
    push('Processor(s):              Virtual x64 4-Core Processor ~3600 Mhz');
    push('Total Physical Memory:     16,384 MB');
    push(`Virtual FS Used:           ${formatStorageBytes(ctx.storageUsedBytes)} / ${formatStorageBytes(ctx.storageQuotaBytes)}`);
    push(`Network Card(s):           ${ctx.wifiEnabled && !ctx.airplaneMode ? ctx.networkName : 'Disconnected'}`);
    return out;
  }

  // tasklist / Get-Process
  if (cmd === 'tasklist' || cmd === 'get-process') {
    push('');
    push('Image Name                     PID Session Name        Mem Usage', 'info');
    push('========================= ======== ================ ============', 'muted');
    push('System Idle Process              0 Services                   8 K');
    push('explorer.exe                  1840 Console               48,620 K');
    push('dwm.exe                       2104 Console               39,240 K');
    ctx.windows.forEach((win, i) => {
      const exeName = `${(win.appId ?? win.id).replace(/[^a-z0-9-]/gi, '')}.exe`.slice(0, 24).padEnd(25, ' ');
      const pid = String(3200 + i * 112).padStart(8, ' ');
      const mem = `${(36 + ((win.id.length * 13 + i * 19) % 70)).toFixed(0)},420 K`.padStart(12, ' ');
      push(`${exeName} ${pid} Console          ${mem}`);
    });
    return out;
  }

  // taskkill / Stop-Process
  if (cmd === 'taskkill' || cmd === 'stop-process') {
    const imIdx = args.findIndex((a) => a.toLowerCase() === '/im' || a.toLowerCase() === '-name');
    const pidIdx = args.findIndex((a) => a.toLowerCase() === '/pid' || a.toLowerCase() === '-id');
    let killed = 0;

    if (imIdx >= 0 && args[imIdx + 1]) {
      const target = args[imIdx + 1].toLowerCase().replace(/\.exe$/, '');
      ctx.windows.forEach((win) => {
        const appId = (win.appId ?? win.id).toLowerCase();
        if (appId === target || win.title.toLowerCase().includes(target)) {
          ctx.desktopActions.closeWindow(win.id);
          killed += 1;
        }
      });
    } else if (pidIdx >= 0 && args[pidIdx + 1]) {
      const pidNum = Number(args[pidIdx + 1]);
      ctx.windows.forEach((win, i) => {
        if (3200 + i * 112 === pidNum) {
          ctx.desktopActions.closeWindow(win.id);
          killed += 1;
        }
      });
    } else if (args[0] && !args[0].startsWith('/') && !args[0].startsWith('-')) {
      const target = args[0].toLowerCase().replace(/\.exe$/, '');
      ctx.windows.forEach((win) => {
        if ((win.appId ?? win.id).toLowerCase() === target) {
          ctx.desktopActions.closeWindow(win.id);
          killed += 1;
        }
      });
    } else {
      push('Usage: taskkill /IM <process.exe>  or  taskkill /PID <pid>', 'warn');
      return out;
    }

    if (killed === 0) {
      push('ERROR: The process was not found.', 'error');
    } else {
      push(`SUCCESS: Sent termination signal to ${killed} window(s).`, 'success');
    }
    return out;
  }

  // ipconfig
  if (cmd === 'ipconfig') {
    const connected = ctx.wifiEnabled && !ctx.airplaneMode;
    push('');
    push('Windows IP Configuration', 'info');
    push('');
    push('Wireless LAN adapter Wi-Fi:');
    push('');
    if (!connected) {
      push('   Media State . . . . . . . . . . . : Media disconnected', 'warn');
      push('   Connection-specific DNS Suffix  . :');
    } else {
      push(`   Connection-specific DNS Suffix  . : home.local (${ctx.networkName})`);
      push('   IPv4 Address. . . . . . . . . . . : 192.168.1.42');
      push('   Subnet Mask . . . . . . . . . . . : 255.255.255.0');
      push('   Default Gateway . . . . . . . . . : 192.168.1.1');
    }
    return out;
  }

  // ping
  if (cmd === 'ping') {
    const host = args.find((a) => !a.startsWith('-')) ?? '';
    if (!host) {
      push('Usage: ping <host>', 'error');
      return out;
    }
    if (!ctx.wifiEnabled || ctx.airplaneMode) {
      push('Ping request could not find host ' + host + '. Check network connection (Wi-Fi is off).', 'error');
      return out;
    }
    ctx.tabActions.startPing(host, 4);
    return [];
  }

  // color
  if (cmd === 'color') {
    if (!args[0]) {
      ctx.tabActions.setCustomColors(null);
      return [];
    }
    const parsed = resolveCmdColorAttr(args[0]);
    if (!parsed) {
      push('Invalid color attribute. Example: COLOR 0A (light green on black), COLOR 1F (white on blue).', 'error');
      return out;
    }
    ctx.tabActions.setCustomColors(parsed);
    return [];
  }

  // title
  if (cmd === 'title') {
    const nextTitle = args.join(' ').trim();
    if (nextTitle) ctx.tabActions.setTitle(nextTitle);
    return [];
  }

  // Launchers (`start <app>`, or direct `notepad`, `calc`, `explorer`, etc.)
  const launchTarget = cmd === 'start' ? (args[0]?.toLowerCase() ?? '') : cmd;
  const launchArg = cmd === 'start' ? args[1] : args[0];
  const APP_ALIASES: Record<string, string> = {
    notepad: 'notepad',
    'notepad.exe': 'notepad',
    calc: 'calculator',
    'calc.exe': 'calculator',
    calculator: 'calculator',
    explorer: 'explorer',
    'explorer.exe': 'explorer',
    mspaint: 'paint',
    paint: 'paint',
    winword: 'word',
    word: 'word',
    excel: 'excel',
    chrome: 'chrome',
    'chrome.exe': 'chrome',
    code: 'code-studio',
    vscode: 'code-studio',
    taskmgr: 'task-manager',
    'taskmgr.exe': 'task-manager',
    settings: 'settings',
    photos: 'photos',
    snip: 'snip',
    pdf: 'pdf-tool',
  };

  if (APP_ALIASES[launchTarget]) {
    const targetAppId = APP_ALIASES[launchTarget];
    if (targetAppId === 'explorer') {
      const folderId = launchArg ? resolveVirtualPath(ctx.cwdId, launchArg, ctx.nodes) : ctx.cwdId;
      ctx.desktopActions.openApp('explorer', folderId ?? ctx.cwdId, undefined, true);
      push(`Opened File Explorer at ${getDosPath(folderId ?? ctx.cwdId, ctx.nodes)}.`, 'success');
      return out;
    }
    if (targetAppId === 'notepad' && launchArg) {
      const fileId = resolveVirtualPath(ctx.cwdId, launchArg, ctx.nodes);
      const fileNode = fileId ? ctx.nodes[fileId] : undefined;
      if (fileNode?.kind === 'file') {
        ctx.desktopActions.openNotepadFile(fileNode.id);
        push(`Opened "${fileNode.name}" in Notepad.`, 'success');
        return out;
      }
    }
    ctx.desktopActions.openApp(targetAppId, undefined, undefined, targetAppId === 'notepad');
    push(`Launched ${launchTarget}.`, 'success');
    return out;
  }

  // Fallback unknown command error matching real CMD/PowerShell
  if (ctx.profile === 'powershell') {
    push(
      `${rawCmd} : The term '${rawCmd}' is not recognized as the name of a cmdlet, function, script file, or operable program.`,
      'error',
    );
  } else {
    push(
      `'${rawCmd}' is not recognized as an internal or external command, operable program or batch file.`,
      'error',
    );
  }
  return out;
}
