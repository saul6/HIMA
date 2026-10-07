import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { nodePolyfills } from 'vite-plugin-node-polyfills'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
    // Buffer/global/process polyfills — requeridos por @react-pdf/renderer y qrcode en el navegador
    nodePolyfills({ globals: { Buffer: true, global: true, process: true } }),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      workbox: {
        // Precache el app shell: JS, CSS, fonts, icons
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
        navigateFallback: '/index.html',
        // No cachear peticiones a Supabase — los datos van por IndexedDB
        runtimeCaching: [],
        // Excluir rutas de auth del navigateFallback
        navigateFallbackDenylist: [/^\/nfc\//],
        // El bundle principal de esta app supera el límite por defecto de 2 MiB
        maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
      },
      manifest: {
        name: 'M.A.D.Y',
        short_name: 'M.A.D.Y',
        description: 'Inocuidad Inteligente',
        theme_color: '#2B7AB5',
        background_color: '#F8F9FA',
        display: 'standalone',
        start_url: '/',
        icons: [
          { src: '/icon-192.png',    sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png',    sizes: '512x512', type: 'image/png' },
          { src: '/mask-icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
      // Buffer polyfill — needed by exceljs in the browser
      buffer: 'buffer',
    },
  },

  // ExcelJS needs global and Buffer available in browser bundles
  define: {
    global: 'globalThis',
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],

  build: {
    sourcemap: false,
  },
})
