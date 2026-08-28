import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3004,
    host: '0.0.0.0',
    allowedHosts: true,
    proxy: {
      '/api': 'https://gestor-tecnico-vdih.onrender.com',
    },
  },
  optimizeDeps: {
    include: ['@react-pdf/renderer'],
  },
})
