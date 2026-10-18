import { fileURLToPath, URL } from 'node:url'

import { TanStackRouterVite } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: process.env.VITE_PROXY_TARGET ?? 'http://127.0.0.1:8000',
        // The C++ backend does not tolerate a trailing slash before a query
        // string (Django does). Strip it only when proxying to the C++ backend.
        rewrite:
          (process.env.VITE_PROXY_TARGET ?? '').includes('8080')
            ? (path: string) => path.replace(/\/(\?|$)/, '$1')
            : undefined,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './tests/setup.ts',
    restoreMocks: true,
  },
})
