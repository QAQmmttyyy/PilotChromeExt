import { defineConfig } from 'vite'
import { resolve } from 'path'

export default defineConfig({
  build: {
    emptyOutDir: false, // 不要清空 dist，否则会删掉主构建的文件
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
})
