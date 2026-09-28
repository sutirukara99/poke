import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages serves this repository at /poke/. Cloudflare/custom-domain builds
  // stay rooted at /. Using an environment-aware base keeps both targets working.
  base: process.env.GITHUB_ACTIONS ? "/poke/" : "/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
