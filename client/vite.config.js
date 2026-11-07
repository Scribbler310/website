import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    // Send /api requests to the Express server during development
    proxy: {
      '/api': 'http://localhost:3001',
    },
  },
})
