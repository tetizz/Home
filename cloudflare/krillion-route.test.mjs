import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import worker, { sites } from '../.cloudflare-dist/worker.mjs';

const origin = 'https://tetizz-home.pages.dev';
const request = (pathname, options) => worker.fetch(new Request(origin + pathname, options));
const manifest = JSON.parse(await fs.readFile(new URL('../.cloudflare-dist/assets-manifest.json', import.meta.url)));

test('Krillion directory canonicalization preserves query and resolves relative modules', async () => {
  const redirect = request('/krillion?mode=review&x=1&x=2');
  assert.equal(redirect.status, 308);
  assert.equal(redirect.headers.get('Location'), origin + '/krillion/?mode=review&x=1&x=2');
  assert.equal(await redirect.text(), '');
  const index = request('/krillion/?mode=review');
  assert.equal(index.status, 200);
  assert.equal(index.headers.get('Content-Type'), 'text/html; charset=utf-8');
  assert.equal(index.headers.get('Cache-Control'), 'no-store');
  assert.equal(await index.text(), await request('/krillion/index.html').text());
  const html = await request('/krillion/').text();
  const scripts = [...html.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/g)];
  assert.ok(scripts.length > 0, 'game must ship a real runtime script');
  assert.ok(/<script\b[^>]*\btype=["']module["']/.test(html), 'game must retain its ES module entry');
  for (const match of scripts) {
    const url = new URL(match[1], origin + '/krillion/');
    assert.equal(url.origin, origin);
    assert.ok(url.pathname.startsWith('/krillion/'));
    assert.equal(request(url.pathname).status, 200, 'missing game script: ' + url.pathname);
    assert.match(request(url.pathname).headers.get('Content-Type'), /^text\/javascript;/);
  }
});

test('game JS modules and data are packaged with executable MIME and valid local import targets', async () => {
  const gameAssets = Object.entries(manifest).filter(([pathname]) => pathname.startsWith('/krillion/'));
  for (const pathname of ['/krillion/index.html', '/krillion/styles.css', '/krillion/app.js', '/krillion/engine.js', '/krillion/data.js']) {
    assert.ok(Object.hasOwn(manifest, pathname), 'missing game runtime asset: ' + pathname);
  }
  let modules = 0;
  for (const [pathname, asset] of gameAssets) {
    assert.equal(request(pathname).headers.get('Content-Type'), asset.type);
    if (!/\.(?:mjs|js)$/.test(pathname)) continue;
    modules += 1;
    assert.equal(asset.type, 'text/javascript; charset=utf-8');
    const source = await request(pathname).text();
    for (const dependency of source.matchAll(/(?:\bfrom\s*|\bimport\s*\(\s*)["'](\.[^"']+)["']/g)) {
      const url = new URL(dependency[1], origin + pathname);
      assert.equal(url.origin, origin);
      assert.ok(url.pathname.startsWith('/krillion/'));
      assert.ok(Object.hasOwn(manifest, url.pathname), 'missing imported module: ' + url.pathname);
      assert.match(request(url.pathname).headers.get('Content-Type'), /^text\/javascript;/);
    }
  }
  assert.ok(modules >= 3, 'game entry, memory engine and dataset must be independently packaged');
  for (const [pathname] of gameAssets.filter(([name]) => name.endsWith('.json'))) JSON.parse(await request(pathname).text());
});

test('Krillion gets a scoped app CSP while Home and existing redirects retain their policies', () => {
  const gameCsp = request('/krillion/').headers.get('Content-Security-Policy');
  assert.match(gameCsp, /script-src 'self'/);
  assert.match(gameCsp, /connect-src 'self'/);
  assert.ok(!/unsafe-inline|unsafe-eval|https?:/.test(gameCsp));
  for (const path of ['/', '/styles.css', '/play']) {
    const csp = request(path).headers.get('Content-Security-Policy');
    assert.match(csp, /script-src 'none'/);
    assert.match(csp, /connect-src 'none'/);
  }
  assert.ok(!sites.some(site => [site.path, site.alias].includes('krillion')));
  for (const path of ['/krillion/missing.js', '/krillion-other', '/Krillion', '/krillion//index.html']) {
    assert.equal(request(path).status, 404);
    assert.equal(request(path).headers.get('Location'), null);
  }
  assert.equal(request('/krillion/', { method: 'POST' }).status, 405);
  const head = request('/krillion/', { method: 'HEAD' });
  assert.equal(head.status, 200);
  assert.equal(head.headers.get('Content-Type'), 'text/html; charset=utf-8');
});
