import { cloudflareTest, readD1Migrations } from "@cloudflare/vitest-pool-workers";
import { defineConfig } from "vitest/config";

export default defineConfig(async () => ({
  plugins: [
    cloudflareTest({
      wrangler: { configPath: "./wrangler.toml" },
      miniflare: {
        bindings: {
          TEST_MIGRATIONS: await readD1Migrations("./migrations")
        },
        d1Databases: { UPGRADE_DB: "upgrade-db" }
      }
    })
  ],
  test: {
    include: ["tests/worker/**/*.test.js"],
    isolate: true
  }
}));
