import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import os from 'node:os';
import path from 'node:path';
import type { Plugin } from 'vite';

interface DownloadPayload {
  url?: string;
  mode?: 'video' | 'audio';
  quality?: 'best' | '1080' | '720' | '480' | 'mp3' | 'm4a';
}

function sendJson(res: ServerResponse, status: number, data: unknown) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(data));
}

function readJsonBody<T>(req: IncomingMessage): Promise<T> {
  return new Promise((resolve, reject) => {
    let raw = '';
    req.on('data', (chunk: Buffer) => {
      raw += chunk.toString('utf8');
      if (raw.length > 64 * 1024) {
        reject(new Error('Payload too large'));
      }
    });
    req.on('end', () => {
      try {
        resolve((raw ? JSON.parse(raw) : {}) as T);
      } catch {
        reject(new Error('Invalid JSON body'));
      }
    });
    req.on('error', reject);
  });
}

function isValidHttpUrl(input: string): boolean {
  try {
    const parsed = new URL(input.trim());
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch {
    return false;
  }
}

function runCommandCapture(
  cmd: string,
  args: string[],
): Promise<{ code: number; stdout: string; stderr: string }> {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { shell: false, windowsHide: true });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d: Buffer) => {
      stdout += d.toString('utf8');
    });
    child.stderr.on('data', (d: Buffer) => {
      stderr += d.toString('utf8');
    });
    child.on('error', (err) => {
      resolve({ code: -1, stdout, stderr: err.message });
    });
    child.on('close', (code) => {
      resolve({ code: code ?? -1, stdout, stderr });
    });
  });
}

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.mp4') return 'video/mp4';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mkv') return 'video/x-matroska';
  if (ext === '.mp3') return 'audio/mpeg';
  if (ext === '.m4a') return 'audio/mp4';
  if (ext === '.opus') return 'audio/opus';
  return 'application/octet-stream';
}

function attachYtDlpMiddleware(middlewares: {
  use: (
    route: string,
    handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void,
  ) => void;
}) {
  middlewares.use('/api/yt/health', async (req, res, next) => {
    if (req.method !== 'GET') return next();
    const [ytdlp, ffmpeg] = await Promise.all([
      runCommandCapture('yt-dlp', ['--version']),
      runCommandCapture('ffmpeg', ['-version']),
    ]);
    sendJson(res, 200, {
      ok: ytdlp.code === 0,
      ytdlp: ytdlp.code === 0 ? ytdlp.stdout.trim() : null,
      ffmpeg: ffmpeg.code === 0,
    });
  });

  middlewares.use('/api/yt/info', async (req, res, next) => {
    if (req.method !== 'POST') return next();
    try {
      const body = await readJsonBody<{ url?: string }>(req);
      const url = body.url?.trim() ?? '';
      if (!isValidHttpUrl(url)) {
        return sendJson(res, 400, { error: 'URL không hợp lệ.' });
      }

      const result = await runCommandCapture('yt-dlp', [
        '--dump-single-json',
        '--no-playlist',
        '--no-warnings',
        url,
      ]);

      if (result.code !== 0) {
        return sendJson(res, 500, {
          error: result.stderr.trim() || 'Không thể lấy thông tin video từ yt-dlp.',
        });
      }

      const info = JSON.parse(result.stdout) as {
        title?: string;
        uploader?: string;
        channel?: string;
        duration?: number;
        thumbnail?: string;
        webpage_url?: string;
      };

      sendJson(res, 200, {
        title: info.title ?? 'YouTube Video',
        channel: info.channel ?? info.uploader ?? 'Unknown channel',
        duration: info.duration ?? 0,
        thumbnail: info.thumbnail ?? '',
        webpageUrl: info.webpage_url ?? url,
      });
    } catch (err) {
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Lỗi không xác định.',
      });
    }
  });

  middlewares.use('/api/yt/download', async (req, res, next) => {
    if (req.method !== 'POST') return next();
    const tmpDir = path.join(os.tmpdir(), `win10-yt-${randomUUID()}`);
    try {
      const body = await readJsonBody<DownloadPayload>(req);
      const url = body.url?.trim() ?? '';
      if (!isValidHttpUrl(url)) {
        return sendJson(res, 400, { error: 'URL không hợp lệ.' });
      }

      fs.mkdirSync(tmpDir, { recursive: true });
      const outputTemplate = path.join(tmpDir, '%(title).120B.%(ext)s');
      const mode = body.mode === 'audio' ? 'audio' : 'video';
      const quality = body.quality ?? (mode === 'audio' ? 'mp3' : 'best');

      const args: string[] = ['--no-playlist', '--no-warnings', '-o', outputTemplate];

      if (mode === 'audio') {
        const audioFormat = quality === 'm4a' ? 'm4a' : 'mp3';
        args.push('-x', '--audio-format', audioFormat, '--audio-quality', '0');
      } else {
        if (quality === '1080' || quality === '720' || quality === '480') {
          args.push(
            '-f',
            `bv*[height<=${quality}][ext=mp4]+ba[ext=m4a]/b[height<=${quality}][ext=mp4]/bv*[height<=${quality}]+ba/b[height<=${quality}]`,
            '--merge-output-format',
            'mp4',
          );
        } else {
          args.push(
            '-f',
            'bv*[ext=mp4]+ba[ext=m4a]/b[ext=mp4]/bv*+ba/b',
            '--merge-output-format',
            'mp4',
          );
        }
      }

      args.push(url);

      const result = await runCommandCapture('yt-dlp', args);
      if (result.code !== 0) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return sendJson(res, 500, {
          error: result.stderr.trim() || 'yt-dlp tải thất bại.',
        });
      }

      const files = fs.readdirSync(tmpDir);
      if (files.length === 0) {
        fs.rmSync(tmpDir, { recursive: true, force: true });
        return sendJson(res, 500, { error: 'Không tìm thấy file sau khi tải.' });
      }

      const fileName = files[0];
      const filePath = path.join(tmpDir, fileName);
      const stat = fs.statSync(filePath);
      const encodedName = encodeURIComponent(fileName);

      res.statusCode = 200;
      res.setHeader('Content-Type', getMimeType(fileName));
      res.setHeader('Content-Length', String(stat.size));
      res.setHeader('X-File-Name', encodedName);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename*=UTF-8''${encodedName}`,
      );

      const stream = fs.createReadStream(filePath);
      stream.pipe(res);
      const cleanup = () => {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      };
      stream.on('close', cleanup);
      stream.on('error', cleanup);
    } catch (err) {
      fs.rmSync(tmpDir, { recursive: true, force: true });
      sendJson(res, 500, {
        error: err instanceof Error ? err.message : 'Lỗi tải video.',
      });
    }
  });
}

export function ytDlpPlugin(): Plugin {
  return {
    name: 'vite-plugin-yt-dlp',
    configureServer(server) {
      attachYtDlpMiddleware(server.middlewares);
    },
    configurePreviewServer(server) {
      attachYtDlpMiddleware(server.middlewares);
    },
  };
}
