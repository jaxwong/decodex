import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Same-origin /api proxy avoids browser CORS and keeps the demo token in browser memory.
export default defineConfig({
  base: './',
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:8000',
        changeOrigin: true,
      },
    },
  },
})
