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
