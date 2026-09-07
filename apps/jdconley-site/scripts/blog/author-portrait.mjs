import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import sharp from "sharp";

// Keep the real photograph separate from generated artwork so every future
// build reflects a profile-photo change without regenerating the illustrations.
export const authorPortrait = {
  file: "images/headshot-256x256.png",
  size: 160,
  inset: 28,
  background: "#101822",
  border: "#e5c580",
  positions: {
    "functional-optimistic-concurrency-in-c": "bottom-left",
    "sorted-affair-history-of-c-sort": "top-right",
    "gentoo-linux-mac-based-host-name": "bottom-left",
    "cross-platform-deployment-project": "top-right",
    "using-mysql-command-line-from-cnet": "top-right",
    "xmpp-presence-priority": "top-right",
  },
};

export async function addAuthorPortrait(artwork, root, position = "bottom-right") {
  const { size, inset, background, border } = authorPortrait;
  const photo = await sharp(await readFile(resolve(root, authorPortrait.file)))
    .rotate().resize(size - 8, size - 8, { fit: "contain", background: "#00000000" }).png().toBuffer();
  const circle = attributes => Buffer.from(`<svg width="${size}" height="${size}" xmlns="http://www.w3.org/2000/svg"><circle cx="${size / 2}" cy="${size / 2}" r="${size / 2 - 2}" ${attributes}/></svg>`);
  const filled = await sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: photo, left: 4, top: 4 }]).png().toBuffer();
  const badge = await sharp(filled).composite([
    { input: circle('fill="white"'), blend: "dest-in" },
    { input: circle(`fill="none" stroke="${border}" stroke-width="2"`) },
  ]).png().toBuffer();
  const positions = {
    "bottom-right": { left: 1200 - size - inset, top: 630 - size - inset },
    "top-right": { left: 1200 - size - inset, top: inset },
    "bottom-left": { left: inset, top: 630 - size - inset },
    "top-left": { left: inset, top: inset },
  };
  if (!positions[position]) throw new Error(`Invalid author portrait position: ${position}`);
  return sharp(artwork).composite([{ input: badge, ...positions[position] }]).png({ compressionLevel: 9 }).toBuffer();
}
