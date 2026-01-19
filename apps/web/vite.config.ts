import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // Point to source files for instant hot reload (no rebuild needed)
      '@aperture/ui': path.resolve(__dirname, '../../packages/ui/src'),
    },
  },
  server: {
    port: 3457,
    host: true,
    allowedHosts: ['aperture.gru.digital'],
    proxy: {
      '/api': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
      '/openapi': {
        target: 'http://localhost:3456',
        changeOrigin: true,
      },
    },
    // Watch for changes in workspace packages
    watch: {
      ignored: ['!**/node_modules/@aperture/**'],
    },
  },
  // Don't pre-bundle workspace packages (allows hot reload)
  optimizeDeps: {
    exclude: ['@aperture/ui'],
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
})

