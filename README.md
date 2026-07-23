# tetizz chess lab

Home page for the chess projects: <https://tetizz.github.io/Home/>

## Projects

- Play Bots: <https://tetizz.github.io/Play/>
- Bookup: <https://tetizz.github.io/Bookup/>
- Chess Connections: <https://tetizz.github.io/Connections/>

Short links are also available from the Home site:

- <https://tetizz.github.io/Home/play/>
- <https://tetizz.github.io/Home/bookup/>
- <https://tetizz.github.io/Home/connections/>

## Deployment

GitHub Pages is the canonical host. A push to `main` runs
`.github/workflows/pages.yml`, builds a small `_site` artifact, checks its files
and redirects, and deploys it to the `github-pages` environment.

Run the same static check locally before pushing:

```powershell
node .github/scripts/validate-static-site.mjs .
```

The deployment uses GitHub Actions' built-in Pages permissions. It does not
need an API key or repository secret.

## Source

- Home: <https://github.com/tetizz/Home>
- Play Bots: <https://github.com/tetizz/Play>
- Bookup: <https://github.com/tetizz/Bookup>
- Chess Connections: <https://github.com/tetizz/Connections>

## Third-party artwork

The decorative king, knight, and rook use the
[Chessnut piece set](https://github.com/LexLuengas/chessnut-pieces) by Alexis
Luengas, imported unchanged from upstream commit
`2b8eaf14a31edad7e9deb53b1473e1d4857868a9`. Chessnut is licensed under
Apache-2.0; the original license and copyright notice are kept beside the SVGs
in `assets/pieces/chessnut/`.

