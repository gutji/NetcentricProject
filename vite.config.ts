import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on all interfaces
    port: 5173,
  // HMR host will default to server host; configurable via CLI if needed
  },
})
