import { defineConfig } from "vite";

export default defineConfig({
  // Relative asset paths work on both Cloudflare Pages at / and the GitHub
  // project fallback at /poke/ without separate builds.
  base: "./",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
