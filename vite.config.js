import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// https://vite.dev/config/
export default defineConfig({
  // 폰 테스트용: LAN 바인딩(host) + 터널(loca.lt 등) 호스트 허용. dev/preview 둘 다.
  server: { host: true, allowedHosts: true },
  preview: { host: true, allowedHosts: true },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      // 데이터(JSON) 파일까지 캐싱해 오프라인에서도 퀴즈가 돌아가게 한다.
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,json,woff2}'],
        // hanja 데이터가 커질 수 있으니 캐시 개별 파일 한도를 넉넉히.
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      manifest: {
        name: '한자 퀴즈',
        short_name: '한자퀴즈',
        description: '한자·단어 퀴즈와 단어장 (오프라인 지원)',
        lang: 'ko',
        theme_color: '#1b1b1f',
        background_color: '#1b1b1f',
        display: 'standalone',
        orientation: 'portrait',
        start_url: '/',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
})
