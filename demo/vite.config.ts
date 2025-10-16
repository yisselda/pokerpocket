import { defineConfig } from 'vite'
import path from 'node:path'

export default defineConfig({
  base: '/pokerpocket/',
  root: '.',
  resolve: {
    alias: [
      {
        find: 'pokerpocket/cards',
        replacement: path.resolve(__dirname, '../engine/src/cards.public.ts'),
      },
      {
        find: 'pokerpocket/eval',
        replacement: path.resolve(__dirname, '../engine/src/eval.public.ts'),
      },
      {
        find: 'pokerpocket/format',
        replacement: path.resolve(__dirname, '../engine/src/format.public.ts'),
      },
      {
        find: 'pokerpocket',
        replacement: path.resolve(__dirname, '../engine/src/index.ts'),
      },
    ],
  },
})
