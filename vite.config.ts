import { defineConfig } from "vite";

export default defineConfig({
  // Load the built files relative to the page, so the site works wherever
  // it's served from, e.g. GitHub Pages' /interactive-ball-thing/ sub-path.
  base: "./",
});
