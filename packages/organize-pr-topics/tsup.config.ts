import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["app/server/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node20",
  outDir: "dist/server",
  clean: true,
  external: ["vite"],
  outExtension() {
    return { js: ".mjs" };
  },
});
