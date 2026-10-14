import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      // Use a trailing slash so paths like /api-test (a SPA route,
      // not a backend endpoint) are NOT proxied to the backend.
      // Previously the prefix-only key matched /api-test as well and
      // the dev server returned 502 for that path even though the
      // production build serves it via React Router just fine.
      '/api/': {
        target: 'http://localhost:5002',
        changeOrigin: true,
      },
    },
  },
})
