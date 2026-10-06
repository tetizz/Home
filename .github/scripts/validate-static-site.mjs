import { access, readFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const siteRoot = path.resolve(process.argv[2] ?? ".");
const requiredFiles = [
  "index.html",
  "styles.css",
  "favicon.svg",
  ".nojekyll",
  "assets/brands/bookup-mark.png",
  "assets/pieces/chessnut/wK.svg",
  "assets/pieces/chessnut/wN.svg",
  "assets/pieces/chessnut/wR.svg",
  "assets/pieces/chessnut/LICENSE.txt",
  "assets/pieces/chessnut/COPYRIGHT.txt",
];
const routes = {
  play: "https://s.tetizz.workers.dev/play",
  bookup: "https://s.tetizz.workers.dev/bookup",
  connections: "https://s.tetizz.workers.dev/connections",
};
const projects = new Map([
  ["Play Bots", "play"],
  ["Bookup", "bookup"],
  ["Chess Connections", "connections"],
  ["Scottish Progressive", "progressive"],
  ["FaithChess (Chess Notes)", "notes"],
  ["DrawbackGuesser", "drawback"],
  ["A Little Chess", "starter"],
  ["Portfolio", "portfolio"],
  ["Chess Friend Graph", "graph"],
  ["HomeDesk", "desk"],
]);
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
  if (!home.includes('class="skip-link" href="#projects"') ||
      !home.includes('id="projects" tabindex="-1"')) {
    failures.push("The homepage must keep its keyboard skip link and focusable project target");
  }
  if (/<script\b/i.test(home)) {
    failures.push("The homepage must remain usable without runtime JavaScript");
  }
  if (!/<a\s+class="brand"\s+href="\.\/"\s+aria-label="tetizz chess lab home">/i.test(home)) {
    failures.push("The header brand must link to ./ so it stays inside the Home project site");
  }
  if (!/href="https:\/\/github\.com\/tetizz\/progressive"/i.test(home)) {
    failures.push("The homepage must link to the Scottish Progressive source repository");
  }
  if (!home.includes('<a class="button small primary" href="https://s.tetizz.workers.dev/progressive">Open Progressive</a>')) {
    failures.push("The Progressive card must open the public playable site");
  }
  if (!home.includes('<a class="button small secondary" href="https://github.com/tetizz/progressive" target="_blank" rel="noreferrer">Source</a>')) {
    failures.push("The Progressive card must keep a separate source link");
  }
  if (!home.includes('<title>Home | tetizz</title>') ||
      !home.includes('<link rel="canonical" href="https://s.tetizz.workers.dev/">')) {
    failures.push("Home must declare its clear title and primary Cloudflare root");
  }
  const cards = home.match(/<article\b[^>]*\bclass="project-card\b[^\"]*"[^>]*>[\s\S]*?<\/article>/g) ?? [];
  if (cards.length !== projects.size) failures.push("Home must contain exactly ten project cards");
  const names = new Set(), destinations = new Set();
  for (const card of cards) {
    const name = /<h3>([^<]+)<\/h3>/.exec(card)?.[1];
    const links = [...card.matchAll(/<a\b[^>]*class="button small primary"[^>]*href="([^\"]+)"/g)];
    const destination = links[0]?.[1];
    if (!projects.has(name) || names.has(name) || links.length !== 1 ||
        destination !== `https://s.tetizz.workers.dev/${projects.get(name)}` || destinations.has(destination)) {
      failures.push(`Invalid, duplicate, or unclear project card: ${name ?? "missing name"}`);
    }
    names.add(name); destinations.add(destination);
  }
  for (const name of projects.keys()) if (!names.has(name)) failures.push(`Missing project card: ${name}`);
  for (const match of home.matchAll(/(?:href|src)="([^\"]+)"/g)) {
    const target = match[1];
    if (/^(?:javascript:|data:|\/\/|http:)/i.test(target) || /^https?:\/\/tetizz\.github\.io(?:\/|$)/i.test(target))
      failures.push(`Unsafe or stale homepage link: ${target}`);
    if (target.startsWith("https:")) {
      try {
        const url = new URL(target);
        if (url.username || url.password || !["s.tetizz.workers.dev", "github.com"].includes(url.hostname))
          failures.push(`Unexpected external homepage destination: ${target}`);
      } catch {
        failures.push(`Malformed homepage destination: ${target}`);
      }
    }
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

  if (targetMatches.length !== 3 ||
      !html.includes(`<meta http-equiv="refresh" content="0; url=${target}">`) ||
      !html.includes(`<link rel="canonical" href="${target}">`) ||
      !html.includes(`href="${target}"`)) {
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
  `Validated ${requiredFiles.length} core files, ${projects.size} named project cards, and ${Object.keys(routes).length} redirect routes in ${siteRoot}`,
);
