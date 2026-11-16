// Builds the web version for GitHub Pages.
// Usage: EXPO_BASE_URL=/omniroute EXPO_PUBLIC_AI_PROXY_URL=https://... node scripts/export-web.mjs [outDir]
//
// GitHub Pages won't serve folders named "node_modules", which is where Expo puts the
// icon fonts, so the icons would be missing. This moves them and rewrites the paths.
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const out = path.resolve(process.argv[2] ?? "dist");
fs.rmSync(out, { recursive: true, force: true });
execFileSync("npx", ["expo", "export", "--platform", "web", "--output-dir", out], {
  stdio: "inherit",
});

const from = path.join(out, "assets", "node_modules");
if (fs.existsSync(from)) {
  fs.renameSync(from, path.join(out, "assets", "vendor"));
  const walk = (dir) =>
    fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
      const p = path.join(dir, e.name);
      return e.isDirectory() ? walk(p) : [p];
    });
  for (const file of walk(out).filter((f) => /\.(js|html|json|css)$/.test(f))) {
    const text = fs.readFileSync(file, "utf8");
    if (text.includes("/assets/node_modules/")) {
      fs.writeFileSync(file, text.replaceAll("/assets/node_modules/", "/assets/vendor/"));
    }
  }
}

// Deep links (e.g. /omniroute/food) load the app instead of a 404 page.
fs.copyFileSync(path.join(out, "index.html"), path.join(out, "404.html"));
// Tell GitHub Pages not to run Jekyll, which would hide files starting with "_".
fs.writeFileSync(path.join(out, ".nojekyll"), "");
console.log(`Web build ready in ${out}`);
