import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  root: '.',
  resolve: {
    alias: [
      {
        find: '@pokerpocket/engine/cards',
        replacement: path.resolve(__dirname, '../engine/src/cards.public.ts'),
      },
      {
        find: '@pokerpocket/engine/eval',
        replacement: path.resolve(__dirname, '../engine/src/eval.public.ts'),
      },
      {
        find: '@pokerpocket/engine/format',
        replacement: path.resolve(__dirname, '../engine/src/format.public.ts'),
      },
      {
        find: '@pokerpocket/engine/testing',
        replacement: path.resolve(__dirname, '../engine/src/testing.public.ts'),
      },
      {
        find: '@pokerpocket/engine',
        replacement: path.resolve(__dirname, '../engine/src/index.ts'),
      },
    ],
  },
})
