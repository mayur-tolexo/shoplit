// Render icon.svg → PNG icons (16/48/128) for the extension. Run: npm run icons
import { Resvg } from "@resvg/resvg-js";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";

const svg = readFileSync(new URL("../icon.svg", import.meta.url), "utf8");
mkdirSync(new URL("../icons", import.meta.url), { recursive: true });

for (const size of [16, 48, 128]) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  writeFileSync(new URL(`../icons/${size}.png`, import.meta.url), png);
  console.log(`icons/${size}.png`);
}
