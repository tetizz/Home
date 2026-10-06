import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sites } from './sites.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const origin = 'https://s.tetizz.workers.dev';
const checks = [];
const digest = body => crypto.createHash('sha256').update(body).digest('hex');
async function get(url, options = {}) {
  const response = await fetch(url, { signal: AbortSignal.timeout(30000), ...options });
  return response;
}
const homepage = await get(origin + '/?verify=home-all-sites-20261006');
assert.equal(homepage.status, 200);
assert.equal(new URL(homepage.url).origin, origin);
const html = await homepage.text();
assert.equal(html, await fs.readFile(path.join(root, 'index.html'), 'utf8'));
assert.equal((html.match(/<article\b/g) || []).length, 10);
checks.push({ role: 'Home', status: 200, url: homepage.url, sha256: digest(html), projectCards: 10 });
const manifest = JSON.parse(await fs.readFile(path.join(root, '.cloudflare-dist/assets-manifest.json'), 'utf8'));
await Promise.all(Object.entries(manifest).map(async ([pathname, asset]) => {
  const response = await get(origin + pathname + '?verify=home-all-sites-20261006');
  assert.equal(response.status, 200, pathname);
  assert.equal(response.headers.get('content-type'), asset.type, pathname);
  const body = Buffer.from(await response.arrayBuffer());
  assert.equal(body.length, asset.bytes, pathname);
  assert.equal(digest(body), asset.sha256, pathname);
  checks.push({ role: 'asset', pathname, status: 200, bytes: body.length, sha256: digest(body) });
}));
await Promise.all(sites.map(async site => {
  for (const route of [site.path, site.alias]) {
    const response = await get(origin + '/' + route + '?via=home', { redirect: 'manual' });
    assert.equal(response.status, 302, route);
    assert.equal(response.headers.get('location'), site.destination + '?via=home', route);
    checks.push({ role: 'short link', name: site.name, route, status: 302, destination: site.destination });
  }
  const response = await get(site.destination, { method: 'HEAD' });
  assert.equal(response.status, 200, site.name);
  assert.ok(!new URL(response.url).hostname.endsWith('.github.io'), site.name);
  checks.push({ role: 'destination', name: site.name, status: response.status, url: response.url });
}));
for (const route of ['home', 'h']) {
  const response = await get(origin + '/' + route, { redirect: 'manual' });
  assert.equal(response.status, 302);
  assert.equal(response.headers.get('location'), origin + '/');
}
const receipt = { passed: true, observedAt: new Date().toISOString(), origin, distinctSites: 11, projectCards: 10, checks };
await fs.writeFile(path.join(root, '.cloudflare-dist/live-verification.json'), JSON.stringify(receipt, null, 2) + '\n');
console.log(JSON.stringify({ passed: true, distinctSites: 11, projectCards: 10, assets: Object.keys(manifest).length, readableRoutes: sites.length, aliases: sites.length + 2, checks: checks.length }));
