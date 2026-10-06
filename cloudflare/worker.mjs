import { sites } from './sites.mjs';

const routes = new Map(sites.flatMap(site => [[site.path, site], [site.alias, site]]));
const security = {
  'Content-Security-Policy': "default-src 'none'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'none'; script-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'; upgrade-insecure-requests",
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
};

export function createWorker(assets) {
  return {
    fetch(request) {
      const head = request.method === 'HEAD';
      const respond = (body, status, headers = {}) => new Response(head ? null : body, {
        status, headers: { ...security, ...headers },
      });
      if (request.method !== 'GET' && !head) return respond('Method not allowed.\n', 405, {
        Allow: 'GET, HEAD', 'Content-Type': 'text/plain; charset=utf-8',
      });
      let incoming;
      try { incoming = new URL(request.url); }
      catch { return respond('Invalid URL.\n', 400, { 'Content-Type': 'text/plain; charset=utf-8' }); }
      const assetPath = incoming.pathname === '/' || incoming.pathname === '/index.html'
        ? '/index.html' : incoming.pathname;
      const asset = Object.hasOwn(assets, assetPath) ? assets[assetPath] : undefined;
      if (asset) {
        const bytes = Uint8Array.from(atob(asset.base64), character => character.charCodeAt(0));
        return respond(bytes, 200, {
          'Content-Type': asset.type,
          'Cache-Control': assetPath === '/index.html' ? 'no-store' : 'public, max-age=3600',
          ETag: '"' + asset.sha256 + '"',
        });
      }
      const match = /^\/([^/]+)(\/.*)?$/.exec(incoming.pathname);
      if (match && (match[1] === 'home' || match[1] === 'h')) {
        const target = new URL('https://s.tetizz.workers.dev/');
        target.pathname = match[2] || '/';
        target.search = incoming.search;
        return respond(null, 302, { Location: target.href, 'Cache-Control': 'no-store' });
      }
      const site = match && routes.get(match[1]);
      if (site) {
        const target = new URL(site.destination);
        target.pathname = match[2] || '/';
        target.search = incoming.search;
        return respond(null, 302, { Location: target.href, 'Cache-Control': 'no-store' });
      }
      return respond('Not found. Visit / for all projects.\n', 404, {
        'Content-Type': 'text/plain; charset=utf-8',
      });
    },
  };
}
