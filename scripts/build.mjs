import { cp, mkdir, readdir, rm } from "node:fs/promises";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const root = fileURLToPath(new URL("../", import.meta.url));
const dist = join(root, "dist");

async function collectTypeScript(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const path = join(directory, entry.name);

    if (entry.isDirectory() && entry.name !== "dist" && entry.name !== "node_modules") {
      files.push(...(await collectTypeScript(path)));
    } else if (entry.isFile() && path.endsWith(".ts") && !path.endsWith(".d.ts")) {
      files.push(path);
    }
  }

  return files;
}

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const entryPoints = await collectTypeScript(root);

await build({
  entryPoints,
  outdir: dist,
  outbase: root,
  format: "iife",
  platform: "browser",
  target: "es2020",
  logLevel: "info",
});

await cp(join(root, "popup.html"), join(dist, "popup.html"));
await cp(join(root, "popup.css"), join(dist, "popup.css"));

console.log(`Built ${entryPoints.length} TypeScript files into ${relative(root, dist)}/`);
