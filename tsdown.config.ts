import { defineConfig } from 'tsdown'

// The three entries as ESM with their declarations and source maps; code they share lands in common chunks, so a
// class reached through two entries is one class.
export default defineConfig({
  entry: {
    index: 'src/index.ts',
    workbench: 'src/workbench.ts',
    internals: 'src/internals.ts',
  },
  format: 'esm',
  platform: 'browser',
  target: 'es2022',
  outDir: 'dist',
  clean: true,
  sourcemap: true,
  dts: { sourcemap: true },
  hash: false,
  // The maps point into src/, which ships beside dist/, instead of carrying a second copy of it.
  outputOptions: { chunkFileNames: 'chunks/[name].js', sourcemapExcludeSources: true },
})
