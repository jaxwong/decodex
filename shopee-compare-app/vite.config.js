import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import process from 'node:process'

const apiTarget = process.env.LUNA_API_PROXY_TARGET || 'http://127.0.0.1:8000'

// Same-origin /api proxy avoids browser CORS and keeps the demo token in browser memory.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: apiTarget,
        changeOrigin: true,
      },
    },
  },
})
