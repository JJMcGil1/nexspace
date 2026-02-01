import * as esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/index.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outfile: 'dist/bundle.js',
  banner: {
    js: '#!/usr/bin/env node',
  },
  external: [],
});

console.log('Bundle created: dist/bundle.js');
