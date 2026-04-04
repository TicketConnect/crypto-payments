import { defineConfig } from 'tsup'
import { copyFileSync } from 'fs'

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: true,
  splitting: false,
  sourcemap: true,
  clean: true,
  external: ['react', 'react-dom', 'viem'],
  esbuildOptions(options) {
    options.jsx = 'automatic'
  },
  onSuccess() {
    copyFileSync('src/styles.css', 'dist/styles.css')
  },
})
