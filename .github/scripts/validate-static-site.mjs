import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const siteRoot = path.resolve(process.argv[2] ?? ".");
const requiredFiles = [
  "index.html",
  "styles.css",
  "favicon.svg",
  ".nojekyll",
  "assets/pieces/chessnut/wK.svg",
  "assets/pieces/chessnut/wN.svg",
  "assets/pieces/chessnut/wR.svg",
  "assets/pieces/chessnut/LICENSE.txt",
  "assets/pieces/chessnut/COPYRIGHT.txt",
];
const routes = {
  play: "https://tetizz.github.io/Play/",
  bookup: "https://tetizz.github.io/Bookup/",
  connections: "https://tetizz.github.io/Connections/",
};
const failures = [];

async function requireFile(relativePath) {
  try {
    await access(path.join(siteRoot, relativePath));
  } catch {
    failures.push(`Missing required file: ${relativePath}`);
  }
}

await Promise.all(requiredFiles.map(requireFile));

try {
  const home = await readFile(path.join(siteRoot, "index.html"), "utf8");
  if (!/<a\s+class="brand"\s+href="\.\/"\s+aria-label="tetizz chess lab home">/i.test(home)) {
    failures.push("The header brand must link to ./ so it stays inside the Home project site");
  }
  if (!/href="https:\/\/github\.com\/tetizz\/progressive"/i.test(home)) {
    failures.push("The homepage must link to the Scottish Progressive source repository");
  }
  if (!home.includes('<a class="button small primary" href="https://tetizz.github.io/progressive/">Open Progressive</a>')) {
    failures.push("The Progressive card must open the public playable site");
  }
  if (!home.includes('<a class="button small secondary" href="https://github.com/tetizz/progressive" target="_blank" rel="noreferrer">Source</a>')) {
    failures.push("The Progressive card must keep a separate source link");
  }
} catch {
  // The required-file check above reports the missing homepage.
}

for (const [route, target] of Object.entries(routes)) {
  const relativePath = path.join(route, "index.html");
  let html;

  try {
    html = await readFile(path.join(siteRoot, relativePath), "utf8");
  } catch {
    failures.push(`Missing route page: ${relativePath}`);
    continue;
  }

  const escapedTarget = target.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const targetPattern = new RegExp(escapedTarget, "g");
  const targetMatches = html.match(targetPattern) ?? [];

  if (targetMatches.length < 2) {
    failures.push(
      `${relativePath} must expose ${target} in both its redirect and fallback link`,
    );
  }

  if (!/<meta\s+http-equiv="refresh"\s+content="0;\s*url=https:\/\//i.test(html)) {
    failures.push(`${relativePath} is missing an immediate HTTPS meta redirect`);
  }

  if (/<script\b/i.test(html)) {
    failures.push(`${relativePath} must not require JavaScript to redirect`);
  }

  if (!/<link\s+rel="icon"\s+href="\.\.\/favicon\.svg"\s+type="image\/svg\+xml">/i.test(html)) {
    failures.push(`${relativePath} must reuse the site favicon without requesting a missing favicon.ico`);
  }
}

if (failures.length > 0) {
  console.error("Static site validation failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(
  `Validated ${requiredFiles.length} core files and ${Object.keys(routes).length} project routes in ${siteRoot}`,
);
