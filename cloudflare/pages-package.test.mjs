import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

test('Pages executes the identical tested Home router and complete embedded assets', async () => {
  const root = new URL('../', import.meta.url);
  assert.deepEqual(await fs.readFile(new URL('.pages-dist/_worker.js', root)),
    await fs.readFile(new URL('.cloudflare-dist/worker.mjs', root)));
  assert.deepEqual(JSON.parse(await fs.readFile(new URL('.pages-build-manifest.json', root))),
    JSON.parse(await fs.readFile(new URL('.cloudflare-dist/assets-manifest.json', root))));
  assert.deepEqual(JSON.parse(await fs.readFile(new URL('.pages-dist/_routes.json', root))),
    { version: 1, include: ['/*'], exclude: [] });
  assert.deepEqual((await fs.readdir(new URL('.pages-dist/', root))).sort(), ['_routes.json', '_worker.js']);
});
