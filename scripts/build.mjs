import * as esbuild from 'esbuild';
import { readFile, writeFile, mkdir, rm, cp } from 'node:fs/promises';
import { dirname, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const pages = process.argv.includes('--pages');
const output = resolve(root, pages ? 'docs' : 'dist');
if (dirname(output) !== root || !['dist', 'docs'].includes(basename(output))) throw new Error('Invalid build output path');
await rm(output, { recursive: true, force: true });
await mkdir(resolve(output, 'assets'), { recursive: true });
await cp(resolve(root, 'public'), output, { recursive: true });
const html = (await readFile(resolve(root, 'index.html'), 'utf8')).replace('/src/main.jsx', './assets/app.js').replace('</head>', '  <link rel="stylesheet" href="./assets/app.css" />\n  </head>');
await writeFile(resolve(output, 'index.html'), html);
await writeFile(resolve(output, '.nojekyll'), '');
const development = process.argv.includes('--dev');
const serve = development || process.argv.includes('--serve');
const options = { absWorkingDir: root, entryPoints: ['src/main.jsx'], bundle: true, outfile: resolve(output, 'assets/app.js'), format: 'esm', jsx: 'automatic', target: ['es2020'], minify: !development, sourcemap: development, loader: { '.jpg': 'file' }, assetNames: '../images/[name]', define: { 'process.env.NODE_ENV': JSON.stringify(development ? 'development' : 'production') }, logLevel: 'info' };
if (serve) {
  const context = await esbuild.context(options);
  await context.rebuild();
  if (development) await context.watch();
  const server = await context.serve({ servedir: output, host: '127.0.0.1', port: 5173 });
  console.log(`Local: http://127.0.0.1:${server.port}/`);
  console.log('Após editar o código, atualize a página para ver as alterações.');
  const shutdown = async () => { await context.dispose(); process.exit(0); };
  process.on('SIGINT', shutdown); process.on('SIGTERM', shutdown);
} else await esbuild.build(options);
