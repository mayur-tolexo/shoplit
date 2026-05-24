import sharp from "sharp";
import { readFile, mkdir } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const svgPath = fileURLToPath(new URL("../app/icon.svg", import.meta.url));
const outDir = fileURLToPath(new URL("../public/icons/", import.meta.url));
const out = (name) => fileURLToPath(new URL(`../public/icons/${name}`, import.meta.url));

await mkdir(outDir, { recursive: true });
const svg = await readFile(svgPath);

// "any" purpose — edge-to-edge rounded mark.
await sharp(svg).resize(192, 192).png().toFile(out("192.png"));
await sharp(svg).resize(512, 512).png().toFile(out("512.png"));

// "maskable" — mark at ~80% on the brand background so it survives Android's
// circle/squircle mask without clipping.
const inner = await sharp(svg).resize(410, 410).png().toBuffer();
await sharp({
  create: { width: 512, height: 512, channels: 4, background: "#B5532A" },
})
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile(out("512-maskable.png"));

console.log("PWA icons written → web/public/icons/");
