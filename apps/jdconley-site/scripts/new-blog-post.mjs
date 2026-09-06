import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { stringify } from "yaml";
import { validSlug, parsePost } from "./blog/content.mjs";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export async function newPost({ title, directory = join(appRoot, "content/blog"), date = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Los_Angeles" }).format(new Date()) }) {
  if (typeof title !== "string" || !title.trim()) throw new Error('Usage: pnpm run blog:new:site "Post title"');
  const slug = title.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  if (!validSlug(slug)) throw new Error("Title must produce a valid, nonreserved slug");
  const source = `---\n${stringify({ title: title.trim(), date, slug, description: "", tags: [], draft: true })}---\n\nWrite your post here.\n`;
  parsePost(source, `${slug}.md`);
  await mkdir(directory, { recursive: true });
  const path = join(directory, `${slug}.md`);
  try { await writeFile(path, source, { flag: "wx" }); }
  catch (error) { if (error.code === "EEXIST") throw new Error(`Post already exists: ${path}`); throw error; }
  return path;
}
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  newPost({ title: process.argv.slice(2).filter(arg => arg !== "--").join(" ") }).then(path => console.log(`Draft created: ${path}\nPreview with pnpm run dev:site, then open /blog.`)).catch(error => { console.error(error.message); process.exitCode = 1; });
}
