import { createRequire } from 'node:module';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const frontend = path.join(root, 'artifacts/falcon-eye');
const require = createRequire(path.join(root, 'artifacts/api-server/package.json'));
const { build } = require('esbuild');
const output = path.join(root, 'exports');
await mkdir(output, { recursive: true });
const assets = path.join(frontend, 'dist/public/assets');
const names = await readdir(assets);
const css = (await Promise.all(names.filter((name) => name.endsWith('.css')).map((name) => readFile(path.join(assets, name), 'utf8')))).join('\n');
const renderer = path.join(output, 'render-blueprint.cjs');
await build({
  stdin: {
    contents: `import React from 'react'; import {renderToStaticMarkup} from 'react-dom/server'; import {Router} from 'wouter'; import Guide from './src/pages/design-guide.tsx'; console.log(renderToStaticMarkup(React.createElement(Router,{ssrPath:'/design-guide'},React.createElement(Guide))));`,
    resolveDir: frontend, loader: 'tsx',
  },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile: renderer,
  alias: { '@': path.join(frontend, 'src') },
});
const markup = execFileSync(process.execPath, [renderer], { encoding: 'utf8', maxBuffer: 2_000_000 });
const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>FalconEye — Product &amp; UI improvement blueprint</title><style>${css}\nbody{margin:0;background:#f7f4ec;font-family:system-ui,sans-serif}main{max-width:1080px;margin:auto;padding:28px}.no-print{display:none!important}@media print{main{padding:0}}</style></head><body><main>${markup}</main></body></html>`;
await writeFile(path.join(output, 'FalconEye-UI-blueprint.html'), html);
console.log('Exported self-contained UI blueprint.');
