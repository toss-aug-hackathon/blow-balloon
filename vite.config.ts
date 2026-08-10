import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: '#apps-in-toss-sdk-v2',
        replacement: new URL(
          './node_modules/@apps-in-toss/web-framework/dist-web/index.js',
          import.meta.url,
        ).pathname,
      },
      {
        find: '@apps-in-toss/web-framework',
        replacement: new URL(
          './src/sdk/appsInTossV2Compat.ts',
          import.meta.url,
        ).pathname,
      },
    ],
  },
  server: { host: '0.0.0.0' },
});
