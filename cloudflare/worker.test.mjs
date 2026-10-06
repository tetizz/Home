import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import worker, { sites } from '../.cloudflare-dist/worker.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const request = (pathname, method = 'GET') => worker.fetch(new Request('https://s.tetizz.workers.dev' + pathname, { method }));

test('root serves the actual Home document and its complete project catalog', async () => {
  const response = request('/');
  assert.equal(response.status, 200);
  assert.equal(response.headers.get('Location'), null);
  assert.equal(await response.text(), await fs.readFile(path.join(root, 'index.html'), 'utf8'));
  const html = await request('/').text();
  assert.equal((html.match(/<article\b/g) || []).length, 10);
  for (const site of sites) assert.ok(html.includes('https://s.tetizz.workers.dev/' + site.path));
  for (const href of html.matchAll(/href="(https:\/\/[^"]+)"/g)) {
    assert.ok(!new URL(href[1]).hostname.endsWith('.github.io'));
  }
});

test('all public Home assets serve matching bytes, MIME, and empty HEAD bodies', async () => {
  const manifest = JSON.parse(await fs.readFile(path.join(root, '.cloudflare-dist/assets-manifest.json'), 'utf8'));
  for (const [pathname, asset] of Object.entries(manifest)) {
    const get = request(pathname);
    const head = request(pathname, 'HEAD');
    assert.equal(get.status, 200);
    assert.equal(get.headers.get('Content-Type'), asset.type);
    const body = Buffer.from(await get.arrayBuffer());
    assert.equal(body.length, asset.bytes);
    assert.equal(crypto.createHash('sha256').update(body).digest('hex'), asset.sha256);
    assert.deepEqual([...head.headers], [...get.headers]);
    assert.equal(await head.text(), '');
  }
});

test('all names and short aliases preserve deep paths and queries on fixed destinations', () => {
  assert.equal(sites.length, 10);
  for (const site of sites) for (const route of [site.path, site.alias]) {
    assert.equal(request('/' + route).headers.get('Location'), site.destination);
    assert.equal(request('/' + route + '/a%20b.json?x=1&x=2').headers.get('Location'), site.destination + 'a%20b.json?x=1&x=2');
  }
  for (const route of ['home', 'h']) assert.equal(request('/' + route + '?x=1').headers.get('Location'), 'https://s.tetizz.workers.dev/?x=1');
  for (const route of ['/h//evil.example', '/h/%2f%2fevil.example', '/g//evil.example', '/g?url=https://evil.example']) {
    assert.ok(['https://s.tetizz.workers.dev', 'https://chess-friend-graph.tetizz.workers.dev'].includes(new URL(request(route).headers.get('Location')).origin));
  }
});

test('unknown paths and unsupported methods do not redirect', () => {
  for (const route of ['/absent', '/__proto__', '/%68']) {
    assert.equal(request(route).status, 404);
    assert.equal(request(route).headers.get('Location'), null);
  }
  assert.equal(request('/play', 'POST').status, 405);
  assert.equal(request('/play', 'POST').headers.get('Allow'), 'GET, HEAD');
});
