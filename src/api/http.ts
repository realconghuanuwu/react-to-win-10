import axios from 'axios';

export const apiClient = axios.create({
  baseURL: '',
});

const ytApiBase = (import.meta.env.VITE_YT_API_BASE ?? '').trim().replace(/\/+$/, '');

export const ytApiClient = axios.create({
  baseURL: ytApiBase,
});

export async function extractAxiosErrorMessage(
  err: unknown,
  fallback: string,
): Promise<string> {
  if (axios.isAxiosError(err)) {
    const data: unknown = err.response?.data;
    if (data instanceof Blob) {
      try {
        const parsed = JSON.parse(await data.text()) as { error?: unknown };
        if (typeof parsed?.error === 'string' && parsed.error) {
          return parsed.error;
        }
      } catch {
        // Ignore non-JSON error blob
      }
    } else if (
      data &&
      typeof data === 'object' &&
      'error' in data &&
      typeof (data as { error?: unknown }).error === 'string' &&
      (data as { error: string }).error
    ) {
      return (data as { error: string }).error;
    }

    if (err.response?.status) {
      return `${fallback} (${err.response.status})`;
    }
    if (err.message) {
      return err.message;
    }
  }

  if (err instanceof Error && err.message) {
    return err.message;
  }
  return fallback;
}
