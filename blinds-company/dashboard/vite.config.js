import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The dashboard reads the vault one level up (../vault), so allow the dev
// server to serve files from the blinds-company root.
export default defineConfig({
  plugins: [react()],
  base: './',
  build: { outDir: 'dist' },
  server: {
    fs: { allow: ['..', '.'] },
  },
})
