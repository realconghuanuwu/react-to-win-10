import type { WebContainerProcess } from '@webcontainer/api';
import { toFileTree, type ProjectFiles } from './codeStudioProject';

let previousRun: Promise<unknown> = Promise.resolve();

interface ProjectManifest {
  scripts?: { dev?: string };
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  optionalDependencies?: Record<string, string>;
}

export function runProject(
  files: ProjectFiles,
  signal: AbortSignal,
  onOutput: (output: string) => void,
  onServerReady: (port: number, url: string) => void,
) {
  const run = previousRun.catch(() => {}).then(async () => {
    signal.throwIfAborted();
    if (!window.crossOriginIsolated) {
      throw new Error('Node.js requires cross-origin isolation. Open this desktop in a recent Chrome or Edge window served over HTTPS or localhost with the isolation header enabled.');
    }

    let manifest: ProjectManifest | null;
    try {
      manifest = JSON.parse(files['package.json']);
    } catch {
      throw new Error('Fix the JSON in package.json, then run again.');
    }
    if (typeof manifest?.scripts?.dev !== 'string' || !manifest.scripts.dev.trim()) {
      throw new Error('Add a dev script to package.json, then run again.');
    }
    const dependencyGroups = [manifest.dependencies, manifest.devDependencies, manifest.optionalDependencies];

    onOutput('Starting WebContainer…\n');
    const { WebContainer } = await import('@webcontainer/api');
    signal.throwIfAborted();
    const runtime = await WebContainer.boot({ coep: 'credentialless' });

    let stop: () => void = () => {};
    const stopped = new Promise<void>((resolve) => { stop = resolve; });
    const disposeReady = runtime.on('server-ready', onServerReady);
    const disposeError = runtime.on('error', ({ message }) => onOutput(message + '\n'));
    signal.addEventListener('abort', stop, { once: true });

    async function pipeOutput(process: WebContainerProcess) {
      const stream = process.output.pipeTo(new WritableStream<string>({ write: onOutput }));
      const [exitCode] = await Promise.all([process.exit, stream]);
      return exitCode;
    }

    async function startServer() {
      signal.throwIfAborted();
      await runtime.mount(toFileTree(files));
      signal.throwIfAborted();
      if (dependencyGroups.some((dependencies) => dependencies && Object.keys(dependencies).length > 0)) {
        onOutput('$ npm install\n');
        const install = await runtime.spawn('npm', ['install']);
        const code = await pipeOutput(install);
        signal.throwIfAborted();
        if (code !== 0) throw new Error(`npm install exited with code ${code}.`);
      }
      onOutput('$ npm run dev\n');
      const server = await runtime.spawn('npm', ['run', 'dev']);
      const code = await pipeOutput(server);
      if (code !== 0) throw new Error(`The dev server exited with code ${code}.`);
    }

    try {
      await Promise.race([startServer(), stopped]);
    } finally {
      signal.removeEventListener('abort', stop);
      disposeReady();
      disposeError();
      runtime.teardown();
    }
  });

  previousRun = run;
  return run;
}
