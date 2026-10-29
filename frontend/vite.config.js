import { fileURLToPath, URL } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],

  resolve: {
    // '@' ko src/ par point karta hai -> import x from '@/features/jobs'
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.js',
    css: true,
    // Each worker is a heavy jsdom + antd process: more workers than half the
    // cores only fight over the CPU (#77).
    maxWorkers: '50%',
    // Page tests render a full antd form and type into it - ~2s alone, ~3x on a
    // busy laptop. 5s is meant for unit tests (#77).
    testTimeout: 15000,
  },
})
