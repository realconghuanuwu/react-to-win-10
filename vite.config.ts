import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { ytDlpPlugin } from './server/ytDlpPlugin';

const headers = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'credentialless',
};

export default defineConfig({
  plugins: [react(), tailwindcss(), ytDlpPlugin()],
  optimizeDeps: { include: ['monaco-editor', '@webcontainer/api'] },
  server: { headers },
  preview: { headers },
});
