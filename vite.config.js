import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
 
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: process.env.VITE_API_URL || 'http://localhost:5002',
        changeOrigin: true,
      },
    },
  },
})
