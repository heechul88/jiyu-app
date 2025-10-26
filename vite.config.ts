import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,
        type: 'module'
      },
      includeAssets: ['favicon.ico'],
      manifest: {
        name: '지유 영상 플레이어',
        short_name: '지유플레이어',
        description: 'JSON 기반 영상 플레이어 앱',
        start_url: '/',
        display: 'standalone',
        background_color: '#111111',
        theme_color: '#111111',
        icons: [
          {
            src: '/favicon.ico',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/x-icon'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true
      }
    })
  ]
})
