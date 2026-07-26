import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:6967',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
      },
      '/health': {
        target: 'http://localhost:6967',
        changeOrigin: true,
      },
      '/upload': {
        target: 'http://localhost:6967',
        changeOrigin: true,
      },
      '/swap': {
        target: 'http://localhost:6967',
        changeOrigin: true,
      },
      '/cameras': {
        target: 'http://localhost:6967',
        changeOrigin: true,
      },
      '/virtual-cam': {
        target: 'http://localhost:6967',
        changeOrigin: true,
      },
      '/files': {
        target: 'http://localhost:6967',
        changeOrigin: true,
      },
      '/outputs': {
        target: 'http://localhost:6967',
        changeOrigin: true,
      },
      '/stream': {
        target: 'ws://localhost:6967',
        ws: true,
      },
    },
  },
})
