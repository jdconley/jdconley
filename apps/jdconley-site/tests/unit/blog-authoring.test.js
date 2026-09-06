import { it, expect } from "vitest";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { newPost } from "../../scripts/new-blog-post.mjs";
import { loadPosts } from "../../scripts/blog/content.mjs";

it("creates an editable draft and refuses to overwrite it", async () => {
  const directory = await mkdtemp(join(tmpdir(), "jd-author-"));
  try {
    const path = await newPost({ title: 'Hello: "Markdown"', directory, date: "2026-09-05" });
    expect(path).toBe(join(directory, "hello-markdown.md"));
    expect(await loadPosts(directory)).toEqual([]);
    const [draft] = await loadPosts(directory, { includeDrafts: true });
    expect(draft.title).toBe('Hello: "Markdown"');
    expect(draft.draft).toBe(true);
    const before = await readFile(path, "utf8");
    await expect(newPost({ title: 'Hello: "Markdown"', directory })).rejects.toThrow(/exists/);
    expect(await readFile(path, "utf8")).toBe(before);
    await expect(newPost({ title: "!!!", directory })).rejects.toThrow(/slug/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
