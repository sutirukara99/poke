import { defineConfig } from "vite";

export default defineConfig({
  // GitHub Pages project site lives under /poke/.
  // Change this to "/" when pokeregions.de is moved to the Vite deployment.
  base: "/poke/",
  build: {
    outDir: "dist",
    emptyOutDir: true,
  },
});
