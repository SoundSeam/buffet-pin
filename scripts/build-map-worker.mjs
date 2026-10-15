import { build } from "esbuild";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { spawnSync } from "node:child_process";

const require = createRequire(import.meta.url);
const output = path.resolve("public/maplibre-worker.js");
// MapLibre 6 uses a separate ESM worker. Next chunks do not preserve the
// library's import.meta.url sibling layout; bundle it into a same-origin asset.
const result = await build({
  entryPoints: [require.resolve("maplibre-gl/dist/maplibre-gl-worker.mjs")],
  outfile: output, bundle: true, write: false, format: "esm", platform: "browser",
  target: "es2022", minify: true, legalComments: "inline",
  banner: { js: "/*! MapLibre GL JS - BSD-3-Clause - https://github.com/maplibre/maplibre-gl-js/blob/v6.14.0/LICENSE.txt */" },
});
const bytes = result.outputFiles[0].contents;
let previous;
try { previous = readFileSync(output); } catch { /* First clean build. */ }
if (!previous || !previous.equals(Buffer.from(bytes))) {
  mkdirSync(path.dirname(output), { recursive: true });
  writeFileSync(output, bytes);
}
if (process.argv.includes("--prisma")) {
  const generated = spawnSync(process.execPath, [require.resolve("prisma/build/index.js"), "generate"], { stdio: "inherit" });
  if (generated.error || generated.status !== 0) process.exit(generated.status ?? 1);
}
