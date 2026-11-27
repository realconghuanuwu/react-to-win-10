import { extractAxiosErrorMessage, ytApiClient } from './http';

export interface YtHealthStatus {
  ok: boolean;
  ytdlp: string | null;
  ffmpeg: boolean;
}

export interface VideoInfo {
  title: string;
  channel: string;
  duration: number;
  thumbnail: string;
  webpageUrl: string;
}

export interface DownloadRequest {
  url: string;
  mode: 'video' | 'audio';
  quality: 'best' | '1080' | '720' | '480' | 'mp3' | 'm4a';
}

export interface DownloadedMediaResult {
  blob: Blob;
  fileName: string;
}

export async function fetchYtHealth(signal?: AbortSignal): Promise<YtHealthStatus> {
  try {
    const res = await ytApiClient.get<YtHealthStatus>('/api/yt/health', { signal });
    const data = res.data;
    if (!data || typeof data !== 'object' || typeof data.ok !== 'boolean') {
      return { ok: false, ytdlp: null, ffmpeg: false };
    }
    return data;
  } catch {
    return { ok: false, ytdlp: null, ffmpeg: false };
  }
}

export async function fetchYtVideoInfo(url: string, signal?: AbortSignal): Promise<VideoInfo> {
  try {
    const res = await ytApiClient.post<VideoInfo>('/api/yt/info', { url }, { signal });
    return res.data;
  } catch (err) {
    throw new Error(await extractAxiosErrorMessage(err, 'Unable to fetch video info.'));
  }
}

export async function downloadYtMedia(payload: DownloadRequest): Promise<DownloadedMediaResult> {
  try {
    const res = await ytApiClient.post<Blob>('/api/yt/download', payload, {
      responseType: 'blob',
    });

    const rawHeaderName = res.headers['x-file-name'];
    const headerValue = Array.isArray(rawHeaderName) ? rawHeaderName[0] : rawHeaderName;
    const fileName =
      typeof headerValue === 'string' && headerValue
        ? decodeURIComponent(headerValue)
        : payload.mode === 'audio'
          ? `audio.${payload.quality}`
          : 'video.mp4';

    return { blob: res.data, fileName };
  } catch (err) {
    throw new Error(await extractAxiosErrorMessage(err, 'Download failed'));
  }
}
