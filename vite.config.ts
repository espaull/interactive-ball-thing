import { defineConfig } from "vite";
import { levelFiles } from "./dev/level-files";

export default defineConfig({
  // Load the built files relative to the page, so the site works wherever
  // it's served from, e.g. GitHub Pages' /interactive-ball-thing/ sub-path.
  base: "./",
  // Lets the level editor save levels while running `npm run dev`.
  plugins: [levelFiles()],
});
