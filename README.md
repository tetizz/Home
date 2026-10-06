# Home | tetizz

The primary Home page is [s.tetizz.workers.dev](https://s.tetizz.workers.dev/).
It brings all ten project websites together while keeping the original dark
Home design and its CSS animations.

## Projects

- [Play Bots](https://s.tetizz.workers.dev/play)
- [Bookup](https://s.tetizz.workers.dev/bookup)
- [Chess Connections](https://s.tetizz.workers.dev/connections)
- [Scottish Progressive](https://s.tetizz.workers.dev/progressive)
- [FaithChess (Chess Notes)](https://s.tetizz.workers.dev/notes)
- [DrawbackGuesser](https://s.tetizz.workers.dev/drawback)
- [A Little Chess](https://s.tetizz.workers.dev/starter)
- [Portfolio](https://s.tetizz.workers.dev/portfolio)
- [Chess Friend Graph](https://s.tetizz.workers.dev/graph)
- [HomeDesk](https://s.tetizz.workers.dev/desk)

The existing three redirect pages use the same descriptive Cloudflare links:

- `play/index.html` → [Play Bots](https://s.tetizz.workers.dev/play)
- `bookup/index.html` → [Bookup](https://s.tetizz.workers.dev/bookup)
- `connections/index.html` → [Chess Connections](https://s.tetizz.workers.dev/connections)

## Deployment

The Cloudflare Worker source is in `cloudflare/`. It serves this Home page and
its nine public assets at the root, and redirects the named project routes to
their Cloudflare sites. The one-letter links remain available.

```powershell
node cloudflare/build-worker.mjs
node --test cloudflare/worker.test.mjs
npx wrangler deploy --config cloudflare/wrangler.jsonc
node cloudflare/verify-live.mjs
```

The live deployment was verified on October 6, 2026: all ten project cards,
nine assets, readable routes, short aliases, and ten destination homepages
passed. Worker deployment: `237839e98f71447fa8cd8ff405629bcd`.

Cloudflare hosts the primary Home page and its project short links. Publishing
the Cloudflare Worker is managed separately from this static source repository.
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

