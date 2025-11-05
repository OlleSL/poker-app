// ui/vite.config.js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  base: '/poker-app/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',  // bind IPv4 loopback (avoids IPv6/alias weirdness)
    port: 5174,         // pick the port you want
    strictPort: true,   // fail if 5174 is taken instead of auto-bumping
    open: false
  }
})
