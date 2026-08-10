import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    // 도커 컨테이너 호스트명(myqaweb-*-frontend)으로의 접근 허용 (에이전트 워커가 컨테이너 간 접속)
    allowedHosts: true,
    proxy: {
      '/api': {
        target: process.env.API_PROXY_TARGET || 'http://localhost:8080',
        changeOrigin: true,
        // 컨테이너 호스트명 origin(myqaweb-*-frontend)이 백엔드 CORS에 막히므로,
        // 서버사이드 프록시에서 Origin 헤더를 제거해 non-CORS 요청으로 전달한다 (dev 전용).
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
          });
        },
      },
    },
  },
})
