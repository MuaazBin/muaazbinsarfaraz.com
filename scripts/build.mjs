import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';

const root = process.cwd();

await mkdir('assets/tools', { recursive: true });

await Promise.all([
  build({
    absWorkingDir: root,
    entryPoints: [resolve(root, 'tools/app.js')],
    bundle: true,
    minify: true,
    sourcemap: false,
    format: 'esm',
    outfile: resolve(root, 'assets/tools/app.bundle.js'),
    target: ['es2022'],
  }),
  build({
    absWorkingDir: root,
    entryPoints: [resolve(root, 'tools/extraction-worker.js')],
    bundle: true,
    minify: true,
    sourcemap: false,
    format: 'esm',
    outfile: resolve(root, 'assets/tools/extraction-worker.bundle.js'),
    target: ['es2022'],
  }),
  copyFile('node_modules/pdfjs-dist/build/pdf.worker.min.mjs', 'assets/tools/pdf.worker.min.mjs'),
]);

console.log('Built Document to Deck browser assets.');
