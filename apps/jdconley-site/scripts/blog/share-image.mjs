import { readFile, realpath } from "node:fs/promises";
import { resolve, sep } from "node:path";
import { createHash } from "node:crypto";
import { validOgImage } from "./content.mjs";
import { addAuthorPortrait, authorPortrait } from "./author-portrait.mjs";
import satori from "satori";
import sharp from "sharp";

const fonts = new Map();
export const archiveSocial = { slug: "index", title: "Starin’ at the Wall", ogImage: "/blog-assets/og/index-v1.jpg", ogImageAlt: "STEP BACK. A wall opens onto Lake Tahoe beyond a writing desk — JD Conley." };

export async function prepareShareImage(post, root) {
  const artwork = await renderShareImage({ ...post, root });
  const position = authorPortrait.positions[post.slug] || (post.ogImage ? "bottom-right" : "top-right");
  const source = await addAuthorPortrait(artwork, root, position);
  if (source.length >= 5_000_000) throw new Error(`Sharing image exceeds 5 MB: ${post.slug}`);
  const hash = createHash("sha256").update(source).digest("hex").slice(0, 12);
  return { source, path: `/blog-assets/social/${post.slug}.png?v=${hash}` };
}

export async function renderShareImage({ title, date, root, ogImage }) {
  if (ogImage !== undefined) {
    if (!validOgImage(ogImage)) throw new Error(`Invalid ogImage: ${ogImage}`);
    try {
      const publicRoot = await realpath(resolve(root, "public"));
      const path = await realpath(resolve(publicRoot, `.${ogImage}`));
      if (!path.startsWith(publicRoot + sep)) throw new Error("Image must stay inside public assets");
      const png = await sharp(await readFile(path)).rotate().resize(1200, 630, { fit: "cover" }).flatten({ background: "#ffffff" }).png({ compressionLevel: 9 }).toBuffer();
      if (png.length >= 5_000_000) throw new Error("Sharing image exceeds 5 MB");
      return png;
    } catch (error) { throw new Error(`Cannot render ogImage ${ogImage}: ${error.message}`, { cause: error }); }
  }
  if (!fonts.has(root)) fonts.set(root, readFile(resolve(root, "node_modules/@fontsource/inter/files/inter-latin-500-normal.woff")));
  const font = await fonts.get(root);
  const row = (text, style) => ({ type: "div", props: { style: { display: "flex", ...style }, children: text } });
  const svg = await satori({ type: "div", props: {
    style: { width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "66px 76px", backgroundColor: "#fcfcfa", color: "#242623", fontFamily: "Inter", borderLeft: "14px solid #3030d8" },
    children: [
      row("JD Conley  /  Writing", { fontSize: 27, color: "#687068" }),
      row(title, { fontSize: title.length > 105 ? 48 : title.length > 75 ? 58 : 70, lineHeight: 1.12, letterSpacing: "-2px", maxWidth: 1040 }),
      { type: "div", props: { style: { display: "flex", justifyContent: "space-between", fontSize: 23, color: "#687068" }, children: [row("jdconley.com/blog", {}), row(date ? date.slice(0, 4) : "Software. Startups. Life.", {})] } }
    ]
  } }, { width: 1200, height: 630, fonts: [{ name: "Inter", data: font, weight: 500, style: "normal" }] });
  return sharp(Buffer.from(svg)).png().toBuffer();
}
