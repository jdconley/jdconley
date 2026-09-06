import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import satori from "satori";
import sharp from "sharp";

const fonts = new Map();
export async function renderShareImage({ title, date, root }) {
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
