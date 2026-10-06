import { defineConfig } from "tsup";

export default defineConfig({
  entry: { cli: "src/cli/main.ts" },
  outDir: "dist",
  format: ["cjs"],
  platform: "node",
  target: "node20",
  clean: false,
  splitting: false,
  sourcemap: false,
  dts: false,
  shims: false,
});
