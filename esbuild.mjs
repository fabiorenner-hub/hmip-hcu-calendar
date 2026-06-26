import { build } from 'esbuild';

const isWatch = process.argv.includes('--watch');

/** @type {import('esbuild').BuildOptions} */
const options = {
  entryPoints: ['src/spa/main.tsx'],
  bundle: true,
  outfile: 'public/app.js',
  format: 'esm',
  target: ['es2022'],
  jsx: 'automatic',
  jsxImportSource: 'preact',
  sourcemap: true,
  minify: !isWatch,
  logLevel: 'info',
  // No CDN: everything (Preact, signals) is bundled into app.js.
};

if (isWatch) {
  const ctx = await (await import('esbuild')).context(options);
  await ctx.watch();
  console.log('esbuild watching…');
} else {
  await build(options);
}
