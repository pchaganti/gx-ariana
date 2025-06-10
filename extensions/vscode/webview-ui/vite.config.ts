import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'index.js', // Ensure the main entry is always named index.js
        chunkFileNames: 'chunk-[name].js', // Optional: Set a fixed pattern for chunks
        assetFileNames: 'assets/[name].[ext]' // Optional: Set a fixed pattern for assets
      }
    }
  }
});