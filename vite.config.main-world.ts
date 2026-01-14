import { defineConfig } from 'vite'
import { resolve } from 'path'
import { existsSync, unlinkSync, statSync, copyFileSync } from 'fs'

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/main-world.ts'),
      name: 'MainWorld',
      fileName: () => 'main-world.js',
      formats: ['iife'],
    },
    rollupOptions: {
      output: {
        extend: true,
      },
    },
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV),
  },
  plugins: [{
    name: 'remove-placeholder',
    buildStart() {
      const placeholderPath = resolve(__dirname, 'dist/main-world.js');
      if (existsSync(placeholderPath)) {
        const stats = statSync(placeholderPath);
        console.log(`[vite-plugin] Found existing main-world.js (${stats.size} bytes)`);
        unlinkSync(placeholderPath);
        console.log('[vite-plugin] Removed placeholder main-world.js');
      }
    },
    closeBundle() {
      const outputPath = resolve(__dirname, 'dist/main-world.js');
      const publicPath = resolve(__dirname, 'public/main-world.js');
      if (existsSync(outputPath)) {
        const stats = statSync(outputPath);
        console.log(`[vite-plugin] Final main-world.js (${stats.size} bytes)`);
        copyFileSync(outputPath, publicPath);
        console.log('[vite-plugin] Copied to public/main-world.js');
      } else {
        console.log('[vite-plugin] ERROR: main-world.js was not written!');
      }
    }
  }]
})
