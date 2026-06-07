import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/*.png', 'icons/*.svg'],
      manifest: {
        name: 'Cambio VES – Tasas BCV Venezuela',
        short_name: 'Cambio VES',
        description: 'Tasas de cambio BCV en tiempo real: Dólar, Euro, USDT e Intervención Digital. Calculadora de bolívares.',
        theme_color: '#0a0d12',
        background_color: '#0a0d12',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        lang: 'es',
        categories: ['finance', 'utilities'],
        icons: [
          { src: '/icons/icon-72.png',   sizes: '72x72',   type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-96.png',   sizes: '96x96',   type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-128.png',  sizes: '128x128', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-144.png',  sizes: '144x144', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-152.png',  sizes: '152x152', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-192.png',  sizes: '192x192', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-384.png',  sizes: '384x384', type: 'image/png', purpose: 'any maskable' },
          { src: '/icons/icon-512.png',  sizes: '512x512', type: 'image/png', purpose: 'any maskable' }
        ],
        screenshots: [
          {
            src: '/icons/screenshot.png',
            sizes: '390x844',
            type: 'image/png',
            form_factor: 'narrow',
            label: 'Tasas BCV en tiempo real'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'google-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'gstatic-fonts-cache', expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 } }
          },
          {
            urlPattern: /^https:\/\/api\.exchangerate-api\.com\/.*/i,
            handler: 'NetworkFirst',
            options: { cacheName: 'exchange-api-cache', expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 12 }, networkTimeoutSeconds: 8 }
          },
          {
            urlPattern: /^https:\/\/api\.qrserver\.com\/.*/i,
            handler: 'CacheFirst',
            options: { cacheName: 'qr-cache', expiration: { maxEntries: 5, maxAgeSeconds: 60 * 60 * 24 } }
          }
        ]
      }
    })
  ]
})
