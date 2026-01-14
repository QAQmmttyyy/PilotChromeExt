import { defineConfig } from 'vite'
import { resolve } from 'path'
import { existsSync, unlinkSync, copyFileSync, statSync } from 'fs'

export default defineConfig({
  build: {
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/content/page-agent-init.ts'),
      name: 'PageAgentInit',
      fileName: () => 'page-agent-init.js',
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
      const placeholderPath = resolve(__dirname, 'dist/page-agent-init.js');
      if (existsSync(placeholderPath)) {
        unlinkSync(placeholderPath);
        console.log('[vite-plugin] Removed placeholder page-agent-init.js');
      }
    },
    closeBundle() {
      const outputPath = resolve(__dirname, 'dist/page-agent-init.js');
      const publicPath = resolve(__dirname, 'public/page-agent-init.js');
      if (existsSync(outputPath)) {
        const stats = statSync(outputPath);
        console.log(`[vite-plugin] Final page-agent-init.js (${stats.size} bytes)`);
        copyFileSync(outputPath, publicPath);
        console.log('[vite-plugin] Copied to public/page-agent-init.js');
      }
    }
  }]
})

