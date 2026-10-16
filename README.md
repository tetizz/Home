# Home | tetizz

The Home router handles conditional asset requests with body-free 304 responses, avoids decoding bytes for HEAD, and reuses immutable decoded asset bytes within each instance. Card entrances follow scroll visibility in supporting browsers, with the existing entrance as fallback and reduced-motion behavior retained. Those performance changes came from source commit `38b1d3188d43c1f32bc1cd47a85903250fb32d04`. The October 14 Home selection came from `8175775`.

The primary Home page is [tetizz-home.pages.dev](https://tetizz-home.pages.dev/).
It brings seven project websites together while keeping the original dark
Home design and its CSS animations.

## Projects

- [Play Bots](https://tetizz-home.pages.dev/play)
- [Bookup](https://tetizz-home.pages.dev/bookup)
- [Chess Connections](https://tetizz-home.pages.dev/connections)
- [Scottish Progressive](https://tetizz-home.pages.dev/progressive)
- [Portfolio](https://tetizz-home.pages.dev/portfolio)
- [Chess Friend Graph](https://tetizz-home.pages.dev/graph)
- [HomeDesk](https://tetizz-home.pages.dev/desk)

The existing three redirect pages use the same descriptive Cloudflare links:

- `play/index.html` → [Play Bots](https://tetizz-home.pages.dev/play)
- `bookup/index.html` → [Bookup](https://tetizz-home.pages.dev/bookup)
- `connections/index.html` → [Chess Connections](https://tetizz-home.pages.dev/connections)

## Deployment

The primary site and project short links run on Cloudflare Pages at
https://tetizz-home.pages.dev/. See [Home on Pages](cloudflare/PAGES.md) for the
release checks, routing details and legacy redirect maintenance.

From this repository, prepare and check the Pages bundle:

```powershell
node cloudflare/build-worker.mjs
node cloudflare/build-pages.mjs
node --test cloudflare/worker.test.mjs cloudflare/pages-package.test.mjs
```

After reviewing that exact fresh `.pages-dist` upload, publish with the default
root Pages configuration:

```powershell
wrangler pages deploy .pages-dist --project-name tetizz-home --branch main
```

The old Worker address serves a legacy redirect. Do not deploy the asset Worker
configuration to maintain the primary site.

## Historical Worker verification

The October 14, 2026 publication used Worker version
`eeb4e2e5-4a6e-4ed0-a459-55cd40ce0aef`. It served seven cards after removing
FaithChess (Chess Notes), A Little Chess, and DrawbackGuesser from Home.
The existing project redirects remained available. All nine public asset bodies
(135,855 bytes), 22 aliases, HEAD, conditional 304, and method checks passed.
The browser review confirmed the seven names, updated count, and no horizontal
overflow. The 187,021-byte prepared bundle has SHA-256
`ff395fc89dfd88ad35c680f1e62b34816414df0ec601609cc733985384c405c8`.
Worker preview URLs were explicitly disabled in that deployment configuration.

The earlier performance publication was verified on October 14, 2026. Worker version:
`6f4f5fd2-5ac0-45e6-a076-bdf3e6df0a7a`, 100% Ready. The prepared
190,501-byte bundle is based on source commit `38b1d31`; all nine published
asset bodies (138,463 bytes) match their hashes and lengths. All 22 named/short
aliases, HEAD 200, conditional 304, POST 405 and unknown-route 404 checks passed.
The primary browser review confirmed ten project cards, the Projects link,
scroll-linked card entrance behavior and no horizontal overflow. These checks
do not establish a public-network performance multiplier.

The October 14 review preview was separate at
[asset-cache-preview.tetizz-home.pages.dev](https://asset-cache-preview.tetizz-home.pages.dev/),
version `934faf2c-2f00-4d3a-8464-1078b4f7c88e`. Its advanced-mode wrapper adds
noindex and build metadata; it was not the primary Worker bundle.

The earlier October 6 publication `237839e98f71447fa8cd8ff405629bcd` is retained
as historical deployment evidence and rollback source, not the active version.

The historical Cloudflare Worker publication was managed separately from this static source repository.
GitHub Pages remains a mirror: a push to `main` runs
`.github/workflows/pages.yml`, builds a small `_site` artifact, checks its files
and redirects, and deploys it to the `github-pages` environment.

Run the static check locally before publishing:

```powershell
node .github/scripts/validate-static-site.mjs .
```

The mirror deployment uses GitHub Actions' built-in Pages permissions. It does not
need an API key or repository secret.

## Source

- Home: <https://github.com/tetizz/Home>
- Play Bots: <https://github.com/tetizz/Play>
- Bookup: <https://github.com/tetizz/Bookup>
- Chess Connections: <https://github.com/tetizz/Connections>
- Scottish Progressive: <https://github.com/tetizz/progressive>

## Third-party artwork

The decorative king, knight, and rook use the
[Chessnut piece set](https://github.com/LexLuengas/chessnut-pieces) by Alexis
Luengas, imported unchanged from upstream commit
`2b8eaf14a31edad7e9deb53b1473e1d4857868a9`. Chessnut is licensed under
Apache-2.0; the original license and copyright notice are kept beside the SVGs
in `assets/pieces/chessnut/`.

