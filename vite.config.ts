import path from 'path';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      headers: {
        'Cross-Origin-Opener-Policy': 'unsafe-none',
        'Cross-Origin-Embedder-Policy': 'unsafe-none'
      },
      proxy: {
        '/api': {
          target: 'https://breww.live',
          changeOrigin: true,
          secure: false,
        },
        '/firmware': {
          target: 'https://breww.live',
          changeOrigin: true,
          secure: false
        }
      }
    },
    plugins: [
      tailwindcss(),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        workbox: {
          importScripts: ['/push-sw.js'],
          // Login do app e API sempre pela rede (nunca a pagina antiga do cache)
          navigateFallbackDenylist: [/^\/app-login/, /^\/api\//],
          maximumFileSizeToCacheInBytes: 3000000
        },
        includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'mask-icon.svg'],
        manifest: {
          name: 'Breww Dashboard',
          short_name: 'Breww',
          description: 'Brewery Management System',
          theme_color: '#EEEFF1',
          background_color: '#EEEFF1',
          display: 'standalone',
          icons: [
            {
              src: 'pwa-64x64.png',
              sizes: '64x64',
              type: 'image/png'
            },
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png'
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any'
            },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable'
            }
          ]
        }
      })
    ],
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            if (id.includes('node_modules/jspdf')) {
              return 'jspdf';
            }
            if (id.includes('node_modules/html2canvas')) {
              return 'html2canvas';
            }
            if (id.includes('node_modules/react-simple-maps') || id.includes('node_modules/d3-geo')) {
              return 'admin-maps';
            }
            if (id.includes('node_modules/recharts') || id.includes('node_modules/d3-')) {
              return 'charts';
            }
            if (id.includes('node_modules/mqtt')) {
              return 'mqtt-client';
            }
          }
        }
      }
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    test: {
      globals: true,
      environment: 'jsdom',
      setupFiles: './tests/setup.ts',
      // backend/tests usa node:test (rodar com "cd backend && npm test")
      exclude: ['**/node_modules/**', '**/dist/**', 'backend/**'],
    }
  };
});
