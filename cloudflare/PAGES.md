# Home on Pages

Source preparation only. No build, tests or deployment were run during this change.

From the Home repository, Root can run:

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

Pages uses the default root configuration; do not supply a custom config path. Existing Worker configuration at `cloudflare/wrangler.jsonc` remains available for historical comparison; no Workers endpoint is disabled by source preparation.

Home links now use `tetizz-home.pages.dev`, Connections uses `tetizz-connections.pages.dev`, and graph uses `tetizz-chess-friend-graph.pages.dev`. Other Pages targets and the seven-card removals are preserved. The old origin's browser storage and old bookmarks do not move automatically.
