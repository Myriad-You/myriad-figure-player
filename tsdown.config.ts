import { defineConfig } from 'tsdown'

// The three entries as ESM with their declarations and source maps; code they share lands in common chunks, so a
// class reached through two entries is one class.

/** Kept by minifiers (`/*!`), so a bundle that takes any chunk keeps the third-party notice with it. */
const LICENSE_BANNER = `/*!
 * @myriad-you/figure-player — MIT License, Copyright (c) 2026 Myriad Contributors.
 * Contains code derived from Anime2.5DRig (https://github.com/852wa/Anime2.5DRig), MIT License,
 * Copyright (c) 2026 hakoniwa, and from its research fork by izumix77
 * (https://github.com/izumix77/Anime2.5DRig), MIT License. Full texts: LICENSE and NOTICE in the package.
 */`

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
  dts: true,
  hash: false,
  outputOptions: {
    chunkFileNames: 'chunks/[name].js',
    // The maps point into src/, which ships beside dist/, instead of carrying a second copy of it.
    sourcemapExcludeSources: true,
    banner: chunk => chunk.fileName.endsWith('.js') ? LICENSE_BANNER : '',
  },
})
