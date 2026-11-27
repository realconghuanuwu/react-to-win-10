import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { ytDlpPlugin } from './server/ytDlpPlugin';

const headers = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

const DEFAULT_YT_API_PROXY = 'https://react-win-api.dftactics.win';
const rawYtApiProxy = process.env.YT_API_PROXY?.trim();
const ytApiProxy = rawYtApiProxy === 'local' ? '' : rawYtApiProxy || DEFAULT_YT_API_PROXY;
const proxy = ytApiProxy
  ? {
      '/api/yt': {
        target: ytApiProxy,
        changeOrigin: true,
      },
    }
  : undefined;

export default defineConfig({
  plugins: [react(), tailwindcss(), ...(ytApiProxy ? [] : [ytDlpPlugin()])],
  optimizeDeps: {
    include: ['monaco-editor', '@webcontainer/api', '@lipoe/browser-qpdf', '@lipoe/browser-qpdf/codecs', 'exceljs', 'fflate'],
  },
  server: { headers, proxy },
  preview: { headers, proxy },
});
