import { readdirSync, statSync } from "node:fs";
import { cp, rm } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, extname, join, relative, resolve } from "node:path";

import { minify as minifyHtml } from "html-minifier-terser";
import { defineConfig } from "vite";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
process.env.VITE_SITE_URL ??= "https://www.jdconley.com";

function getHtmlInputs(startDir) {
  const inputs = {};
  const queue = [startDir];
  const ignoredDirectories = new Set([
    "dist",
    "node_modules",
    "playwright-report",
    "test-results"
  ]);

  while (queue.length > 0) {
    const currentDir = queue.pop();
    const entries = readdirSync(currentDir);

    for (const entry of entries) {
      if (ignoredDirectories.has(entry)) {
        continue;
      }

      const absolutePath = join(currentDir, entry);
      const stats = statSync(absolutePath);

      if (stats.isDirectory()) {
        queue.push(absolutePath);
        continue;
      }

      if (extname(entry) !== ".html") {
        continue;
      }

      const relativePath = relative(startDir, absolutePath).replace(/\\/g, "/");
      const key = relativePath === "index.html"
        ? "index"
        : relativePath.replace(/\.html$/u, "");

      inputs[key] = absolutePath;
    }
  }

  return inputs;
}

function htmlMinifierPlugin() {
  return {
    name: "html-minifier-terser",
    apply: "build",
    async generateBundle(_outputOptions, bundle) {
      const htmlAssets = Object.values(bundle).filter(
        (bundleItem) => bundleItem.type === "asset" && bundleItem.fileName.endsWith(".html")
      );

      for (const asset of htmlAssets) {
        if (typeof asset.source !== "string") {
          continue;
        }

        asset.source = await minifyHtml(asset.source, {
          collapseWhitespace: true,
          decodeEntities: true,
          minifyCSS: true,
          minifyJS: true,
          removeComments: true,
          removeRedundantAttributes: true,
          useShortDoctype: true
        });
      }
    }
  };
}

function copyRuntimeScriptsPlugin() {
  return {
    name: "copy-runtime-scripts",
    apply: "build",
    async closeBundle() {
      const distScriptsPath = resolve(__dirname, "dist/js");
      await rm(distScriptsPath, { force: true, recursive: true });
      await cp(resolve(__dirname, "js"), distScriptsPath, { recursive: true });
    }
  };
}

export default defineConfig({
  plugins: [htmlMinifierPlugin(), copyRuntimeScriptsPlugin()],
  build: {
    outDir: "dist",
    sourcemap: false,
    cssMinify: true,
    minify: "esbuild",
    rollupOptions: {
      input: getHtmlInputs(resolve(__dirname)),
      output: {
        assetFileNames: ({ name = "" }) => {
          const extension = extname(name).toLowerCase();
          if ([".jpg", ".jpeg", ".png", ".webp", ".svg", ".gif", ".ico"].includes(extension)) {
            return "images/[name][extname]";
          }

          return "assets/[name]-[hash][extname]";
        },
        chunkFileNames: "assets/[name]-[hash].js",
        entryFileNames: "assets/[name]-[hash].js"
      }
    }
  }
});
