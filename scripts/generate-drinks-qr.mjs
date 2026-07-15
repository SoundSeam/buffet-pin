import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import jsQR from "jsqr";
import QRCode from "qrcode";
import sharp from "sharp";

const DEFAULT_URL = "https://buffetpin.com/drinks";
const url = process.argv[2] ?? DEFAULT_URL;
const outputDirectory = path.join(process.cwd(), "public", "qr");
const svgPath = path.join(outputDirectory, "buffet-pin-drinks.svg");
const pngPath = path.join(outputDirectory, "buffet-pin-drinks.png");

function validateUrl(value) {
  const parsed = new URL(value);

  if (parsed.protocol !== "https:") {
    throw new Error("The public drink-menu URL must use HTTPS.");
  }

  if (parsed.search || parsed.hash) {
    throw new Error("Use a stable URL without query parameters or a fragment.");
  }

  return parsed.toString().replace(/\/$/, "");
}

function escapeXml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function createSvg(value) {
  const qr = QRCode.create(value, { errorCorrectionLevel: "H" });
  const moduleCount = qr.modules.size;
  const quietZone = 4;
  const qrWidth = moduleCount + quietZone * 2;
  const labelHeight = 4;
  const totalHeight = qrWidth + labelHeight;
  const pixelsPerUnit = 24;
  const pathCommands = [];

  for (let row = 0; row < moduleCount; row += 1) {
    let column = 0;

    while (column < moduleCount) {
      if (!qr.modules.get(row, column)) {
        column += 1;
        continue;
      }

      const start = column;

      while (column < moduleCount && qr.modules.get(row, column)) {
        column += 1;
      }

      const length = column - start;
      pathCommands.push(
        `M${start + quietZone} ${row + quietZone}h${length}v1h-${length}z`,
      );
    }
  }

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${qrWidth * pixelsPerUnit}" height="${totalHeight * pixelsPerUnit}" viewBox="0 0 ${qrWidth} ${totalHeight}" role="img" aria-labelledby="title description">`,
    "<title id=\"title\">Buffet Pin drink menu QR code</title>",
    `<description id="description">Scan to open ${escapeXml(value)}</description>`,
    `<rect width="${qrWidth}" height="${totalHeight}" fill="#fff"/>`,
    `<path d="${pathCommands.join("")}" fill="#000" shape-rendering="crispEdges"/>`,
    `<text x="${qrWidth / 2}" y="${qrWidth + 2.1}" fill="#000" font-family="Arial, Helvetica, sans-serif" font-size="1.15" font-weight="600" text-anchor="middle">${escapeXml(value)}</text>`,
    "</svg>",
  ].join("\n");
}

const canonicalUrl = validateUrl(url);
const svg = createSvg(canonicalUrl);

await mkdir(outputDirectory, { recursive: true });
await writeFile(svgPath, svg, "utf8");
await sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toFile(pngPath);

const { data, info } = await sharp(pngPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });
const decoded = jsQR(
  new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength),
  info.width,
  info.height,
);

if (decoded?.data !== canonicalUrl) {
  throw new Error(
    `QR validation failed: expected ${canonicalUrl}, decoded ${decoded?.data ?? "nothing"}.`,
  );
}

console.log(`Created ${path.relative(process.cwd(), svgPath)}`);
console.log(`Created ${path.relative(process.cwd(), pngPath)}`);
console.log(`Validated QR destination: ${decoded.data}`);
