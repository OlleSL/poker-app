// ui/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/poker-app/',
  plugins: [react()],
  build: {
    sourcemap: false, // Disable source maps to prevent 404s for source files
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks: {
          "playing-cards": ["@heruka_urgyen/react-playing-cards/lib/TcN"],
          pokersolver: ["pokersolver"],
        },
      },
    },
  },
  server: {
    host: '127.0.0.1',  // bind IPv4 loopback (avoids IPv6/alias weirdness)
    port: 5173,         // standard Vite dev port
    strictPort: true,   // fail if 5173 is taken instead of auto-bumping
    open: false
  }
})
