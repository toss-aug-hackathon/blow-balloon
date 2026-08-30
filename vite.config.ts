import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import aitDevtools from '@apps-in-toss/devtools/unplugin';

export default defineConfig({
  plugins: [aitDevtools.vite(), react()],
  server: {
    host: '0.0.0.0',
    // Cloudflare Quick Tunnel은 실행할 때마다 임시 하위 도메인을 만들기
    // 때문에 특정 주소가 아닌 trycloudflare.com 하위 호스트만 허용한다.
    allowedHosts: ['.trycloudflare.com'],
  },
});
