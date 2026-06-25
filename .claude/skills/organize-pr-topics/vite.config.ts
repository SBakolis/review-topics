import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  root: "app/ui",
  build: {
    outDir: "../../dist/ui",
    emptyOutDir: true,
  },
  test: {
    root: ".",
    include: ["tests/**/*.test.ts"],
    environment: "node",
  },
});
