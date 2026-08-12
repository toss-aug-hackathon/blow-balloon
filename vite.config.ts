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
  server: {
    host: '0.0.0.0',
    // Cloudflare Quick Tunnel은 실행할 때마다 임시 하위 도메인을 만들기
    // 때문에 특정 주소가 아닌 trycloudflare.com 하위 호스트만 허용한다.
    allowedHosts: ['.trycloudflare.com'],
  },
});
