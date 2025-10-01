import { defineConfig } from 'vite'

export default defineConfig({
  base: '/pokerpocket/',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: true
  },
  server: {
    port: 3000
  }
})
