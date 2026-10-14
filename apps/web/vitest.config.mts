import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  // The database tests make many round trips to a cloud database, so a single test can take a few seconds.
  test: { testTimeout: 30_000 },
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
});
