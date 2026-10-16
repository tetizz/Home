# Home on Pages

On October 16, 2026, Home was deployed at https://tetizz-home.pages.dev/. Checks verified the Home and Chess Friend Graph Pages migration with 1,811 HTTP checks across both sites. That is HTTP/source and routing verification, not a claim that every browser interaction was exercised.

From the Home repository, run:

```
node cloudflare/build-worker.mjs
node cloudflare/build-pages.mjs
node --test cloudflare/worker.test.mjs cloudflare/pages-package.test.mjs
```

The Pages build requires a fresh `.pages-dist` directory and refuses to reuse one. It produces advanced-mode `_worker.js` plus `_routes.json` routing all requests through the same Home router. Every public asset is embedded with its original bytes, MIME and SHA-256; no additional static asset binding is needed. The private local `.pages-build-manifest.json` stays outside the upload directory. The package test requires byte-identical generated Worker code and asset manifests between the existing Worker build and Pages build; routing tests cover seven cards, all aliases, suffixes/queries, HEAD, assets, unsupported methods and 404.

The reviewed deployment input is `.pages-dist`, with the default root `wrangler.jsonc` selecting `tetizz-home`. From Home, the separate deployment command after build/test and exact upload review is:

```
wrangler pages deploy .pages-dist --project-name tetizz-home --branch main
```

Pages uses the default root configuration; do not supply a custom config path. The legacy https://s.tetizz.workers.dev address now serves a verified HTTP 308 redirect to the Pages origin, preserving the full path and query. The Connections and Chess Friend Graph legacy frontend addresses were also verified as 308 redirects. These frontend redirects do not modify their backends, KV or Durable Objects.

`cloudflare/legacy-redirect.mjs` is byte-identical to the tested and published migration bundle for Worker `s`. Its explicit Worker-only configuration is `cloudflare/wrangler-redirect.jsonc`. The older `cloudflare/wrangler.jsonc` and embedded Worker builder remain for historical comparison and package parity; they are not the normal Pages deployment path or the current legacy redirect entrypoint. Keep Pages publication and legacy Worker maintenance separate.

Home links now use `tetizz-home.pages.dev`, Connections uses `tetizz-connections.pages.dev`, and graph uses `tetizz-chess-friend-graph.pages.dev`. Other Pages targets and the seven-card removals are preserved. The old origin's browser storage and old bookmarks do not move automatically.
