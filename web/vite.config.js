import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

const isVercel = process.env.VERCEL

export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: isVercel ? '/' : '/procurement-platform/',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    outDir: 'dist',
  },
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:4000',
      '/procurement-platform/api': {
        target: 'http://localhost:4000',
        rewrite: (path) => path.replace('/procurement-platform', ''),
      },
    }
  }
})
