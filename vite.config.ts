import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { ytDlpPlugin } from './server/ytDlpPlugin';

export default defineConfig({
  plugins: [react(), tailwindcss(), ytDlpPlugin()],
});
