import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './' + HashRouter so the build works on any static host (GitHub Pages, Vercel, Netlify)
export default defineConfig({
  base: './',
  plugins: [react()],
})
