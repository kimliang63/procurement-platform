import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const isVercel = process.env.VERCEL

export default defineConfig({
  plugins: [react()],
  base: isVercel ? '/' : '/procurement-platform/',
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:4000',
    }
  }
})
