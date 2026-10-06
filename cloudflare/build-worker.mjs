import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, '.cloudflare-dist');
const files = ['index.html', 'styles.css', 'favicon.svg'];
async function requirePublicEntry(absolute, directory = false) {
  const info = await fs.lstat(absolute);
  if (info.isSymbolicLink() || (directory ? !info.isDirectory() : !info.isFile())) {
    throw new Error('Public asset must be a regular ' + (directory ? 'directory: ' : 'file: ') + absolute);
  }
  const real = await fs.realpath(absolute);
  const relative = path.relative(root, real);
  if (relative === '..' || relative.startsWith('..' + path.sep) || path.isAbsolute(relative)) {
    throw new Error('Public asset leaves the Home directory: ' + absolute);
  }
}
async function walk(directory, prefix) {
  await requirePublicEntry(directory, true);
  for (const item of (await fs.readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name))) {
    const relative = prefix + '/' + item.name;
    if (item.isDirectory()) await walk(path.join(directory, item.name), relative);
    else if (item.isFile()) files.push(relative);
    else throw new Error('Unsupported asset entry: ' + relative);
  }
}
await walk(path.join(root, 'assets'), 'assets');
const types = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.txt': 'text/plain; charset=utf-8' };
const assets = {};
for (const relative of files) {
  const type = types[path.extname(relative)];
  if (!type) throw new Error('Unsupported public asset type: ' + relative);
  const absolute = path.join(root, relative);
  await requirePublicEntry(absolute);
  const body = await fs.readFile(absolute);
  assets['/' + relative] = { type, base64: body.toString('base64'), sha256: crypto.createHash('sha256').update(body).digest('hex'), bytes: body.length };
}
const worker = await fs.readFile(path.join(root, 'cloudflare', 'worker.mjs'), 'utf8');
const catalog = await fs.readFile(path.join(root, 'cloudflare', 'sites.mjs'), 'utf8');
const bundled = catalog + '\n' + worker.replace("import { sites } from './sites.mjs';", '') + '\nconst assets = ' + JSON.stringify(assets) + ';\nexport default createWorker(assets);\n';
await fs.mkdir(output, { recursive: true });
await fs.writeFile(path.join(output, 'worker.mjs'), bundled);
await fs.writeFile(path.join(output, 'assets-manifest.json'), JSON.stringify(Object.fromEntries(Object.entries(assets).map(([key, value]) => [key, { type: value.type, bytes: value.bytes, sha256: value.sha256 }])), null, 2) + '\n');
console.log(JSON.stringify({ output, assets: files.length, workerBytes: Buffer.byteLength(bundled), sha256: crypto.createHash('sha256').update(bundled).digest('hex') }));
