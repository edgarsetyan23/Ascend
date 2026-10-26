import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  build: {
    rollupOptions: {
      input: { main: 'index.html', studio: 'mini-edgar-studio.html' },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Optional route modules are fetched when visited, not during SW install.
        globIgnores: ['**/TrackerApp-*', '**/ResumeReview-*', '**/PortfolioResumeReview-*', '**/TourGuide-*', '**/studio-*', 'mini-edgar-studio.html'],
        runtimeCaching: [{
          urlPattern: ({ url, request }) => url.origin === self.location.origin && url.pathname.startsWith('/assets/') && ['script', 'style', 'worker'].includes(request.destination),
          handler: 'CacheFirst',
          options: { cacheName: 'ascend-visited-assets', expiration: { maxEntries: 40, maxAgeSeconds: 30 * 24 * 60 * 60 } },
        }],
      },
      includeAssets: ['favicon.svg', 'favicon.ico', 'apple-touch-icon-180x180.png'],
      manifest: {
        name: 'Ascend — Accountability Tracker',
        short_name: 'Ascend',
        description: 'Track your LeetCode progress, job applications, daily activity, and more.',
        theme_color: '#0f0f0f',
        background_color: '#0f0f0f',
        display: 'standalone',
        start_url: '/app',
        scope: '/',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/__tests__/setup.js'],
    include: ['src/__tests__/**/*.test.{js,jsx}'],
  },
})
