// extension/build.mjs
import { build } from "esbuild";
import { cp, mkdir, rm } from "node:fs/promises";

await rm("dist", { recursive: true, force: true });
await mkdir("dist", { recursive: true });

await build({
  entryPoints: {
    "service-worker": "src/service-worker.ts",
    content: "src/content.ts",
    popup: "src/popup.ts",
  },
  outdir: "dist",
  bundle: true,
  format: "esm",
  target: "chrome114",
  logLevel: "info",
});

await cp("manifest.json", "dist/manifest.json");
await cp("src/popup.html", "dist/popup.html");
await cp("icons", "dist/icons", { recursive: true }).catch(() => {});
console.log("built → dist/");
