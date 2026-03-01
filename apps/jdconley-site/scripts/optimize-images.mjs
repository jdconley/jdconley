import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";

import sharp from "sharp";

const SUPPORTED_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp"]);
const DIST_PATH = resolve("dist");
const qualitySettings = {
  jpg: 84,
  jpeg: 84,
  png: 85,
  webp: 84
};

async function* walk(directory) {
  const entries = await readdir(directory);

  for (const entry of entries) {
    const fullPath = join(directory, entry);
    const info = await stat(fullPath);

    if (info.isDirectory()) {
      yield* walk(fullPath);
      continue;
    }

    yield fullPath;
  }
}

async function optimizeImage(filePath) {
  const extension = extname(filePath).toLowerCase().slice(1);

  if (!SUPPORTED_EXTENSIONS.has(`.${extension}`)) {
    return { skipped: true, saved: 0 };
  }

  const originalBuffer = await readFile(filePath);
  let optimizedBuffer = null;

  if (extension === "jpg" || extension === "jpeg") {
    optimizedBuffer = await sharp(originalBuffer, { failOn: "none" })
      .jpeg({ quality: qualitySettings[extension], mozjpeg: true })
      .toBuffer();
  } else if (extension === "png") {
    optimizedBuffer = await sharp(originalBuffer, { failOn: "none" })
      .png({ compressionLevel: 9, quality: qualitySettings.png })
      .toBuffer();
  } else if (extension === "webp") {
    optimizedBuffer = await sharp(originalBuffer, { failOn: "none" })
      .webp({ quality: qualitySettings.webp, effort: 6 })
      .toBuffer();
  }

  if (!optimizedBuffer || optimizedBuffer.length >= originalBuffer.length) {
    return { skipped: true, saved: 0 };
  }

  await writeFile(filePath, optimizedBuffer);
  return { skipped: false, saved: originalBuffer.length - optimizedBuffer.length };
}

async function run() {
  let optimizedCount = 0;
  let skippedCount = 0;
  let bytesSaved = 0;

  for await (const filePath of walk(DIST_PATH)) {
    const result = await optimizeImage(filePath);
    if (result.skipped) {
      skippedCount += 1;
      continue;
    }

    optimizedCount += 1;
    bytesSaved += result.saved;
  }

  const kilobytesSaved = (bytesSaved / 1024).toFixed(2);
  console.log(
    `Image optimization complete. Optimized ${optimizedCount} files, skipped ${skippedCount}, saved ${kilobytesSaved} KB.`
  );
}

run().catch((error) => {
  console.error("Image optimization failed:", error);
  process.exit(1);
});
