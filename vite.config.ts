import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import aitDevtools from '@apps-in-toss/devtools/unplugin';

export default defineConfig(({ mode }) => ({
  plugins:
    mode === 'browser-test'
      ? [react()]
      : [aitDevtools.vite(), react()],
  server: { host: '0.0.0.0' },
}));
