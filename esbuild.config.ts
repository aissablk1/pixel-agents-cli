/**
 * esbuild configuration for pixel-agents-cli.
 * Bundles everything into a single executable file.
 */

import * as esbuild from 'esbuild';
import * as fs from 'fs';
import * as path from 'path';

const outdir = 'dist';

// Clean dist
if (fs.existsSync(outdir)) {
  fs.rmSync(outdir, { recursive: true });
}

// Bundle the CLI entry point
await esbuild.build({
  entryPoints: ['bin/pixel-agents.ts'],
  bundle: true,
  platform: 'node',
  target: 'node20',
  format: 'esm',
  outdir: path.join(outdir, 'bin'),
  outExtension: { '.js': '.js' },
  sourcemap: true,
  minify: false,
  external: [
    // Keep pngjs as external (native addon compat)
    'pngjs',
  ],
  banner: {
    js: '#!/usr/bin/env node\nimport { createRequire } from "module"; const require = createRequire(import.meta.url);',
  },
});

// Copy assets to dist
const assetsSource = path.resolve('assets');
const assetsDest = path.resolve(outdir, 'assets');

function copyDirSync(src: string, dest: string): void {
  fs.mkdirSync(dest, { recursive: true });
  for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDirSync(assetsSource, assetsDest);

console.log('Build complete: dist/');
