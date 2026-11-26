import type { FileSystemTree } from '@webcontainer/api';

export type ProjectFiles = Record<string, string>;

const STORAGE_KEY = 'win10-code-studio-project';
const SAFE_PATH = /^[\w.-]+(?:\/[\w.-]+)*$/;

const starterFiles: ProjectFiles = {
  'server.js': `import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';

const port = Number(process.env.PORT) || 3000;

createServer(async (request, response) => {
  if (request.url === '/api/hello') {
    response.writeHead(200, { 'Content-Type': 'application/json' });
    response.end(JSON.stringify({ message: 'Hello from Node.js!' }));
    return;
  }

  const html = await readFile(new URL('./index.html', import.meta.url));
  response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  response.end(html);
}).listen(port, () => console.log(\`Listening on port \${port}\`));
`,
  'index.html': `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Node Playground</title>
  <style>
    body { margin: 0; padding: 36px 24px; background: #eef7f2; color: #162b24; font: 16px/1.5 system-ui; }
    h1 { margin: 0 0 8px; font-size: clamp(1.5rem, 6vw, 2rem); }
    p { margin: 0 0 16px; }
    a { color: #165d47; }
  </style>
</head>
<body>
  <h1>Node.js is running</h1>
  <p>Edit this page, then stop and run the server again to see your changes.</p>
  <a href="/api/hello">Open the example API</a>
</body>
</html>
`,
  'package.json': `{
  "name": "node-playground",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node server.js"
  }
}
`,
};

export function validateNewPath(path: string, existingPaths: string[]) {
  if (!SAFE_PATH.test(path) || path.split('/').some((segment) => segment === '..' || segment === '.')) {
    return 'Enter a project-relative file path, such as src/main.js.';
  }
  if (existingPaths.some((name) => name === path || name.startsWith(path + '/') || path.startsWith(name + '/'))) {
    return 'A file or folder already uses that path.';
  }
  return '';
}

export function loadProject(): ProjectFiles {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null');
    if (saved && typeof saved === 'object' && !Array.isArray(saved)) {
      const files: ProjectFiles = Object.create(null);
      for (const [path, value] of Object.entries(saved)) {
        if (typeof value !== 'string' || validateNewPath(path, Object.keys(files))) return starterFiles;
        files[path] = value;
      }
      if (Object.hasOwn(files, 'package.json')) return files;
    }
  } catch {
    // The starter is available even if browser storage is unavailable.
  }
  return starterFiles;
}

export function saveProject(files: ProjectFiles) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(files));
}

export function toFileTree(files: ProjectFiles): FileSystemTree {
  const tree: FileSystemTree = Object.create(null);
  for (const [path, contents] of Object.entries(files)) {
    const segments = path.split('/');
    const name = segments.pop()!;
    let directory = tree;
    for (const segment of segments) {
      const entry = directory[segment] ??= { directory: Object.create(null) };
      if ('directory' in entry) directory = entry.directory;
    }
    directory[name] = { file: { contents } };
  }
  return tree;
}
