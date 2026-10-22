// Bundles src/extension.ts into one CommonJS file for the VS Code extension host.
// Usage: node esbuild.mjs [--watch] [--production]
import * as esbuild from 'esbuild';

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

const context = await esbuild.context({
  entryPoints: ['src/extension.ts'],
  bundle: true,
  format: 'cjs',
  platform: 'node',
  target: 'node20', // VS Code 1.90's extension host runs Node 20
  outfile: 'out/extension.cjs',
  external: ['vscode'], // provided by VS Code at runtime
  sourcemap: !production,
  minify: production,
  logLevel: 'info',
});

if (watch) {
  await context.watch();
} else {
  await context.rebuild();
  await context.dispose();
}
