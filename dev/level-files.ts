// A dev server plugin for the level editor (src/ui/editor.ts): saving a
// level writes its file into src/levels/data/, and adds it to the order if
// it's new. Only while running `npm run dev`; the built site has no way to
// write anything.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { format } from "prettier";
import type { Plugin } from "vite";

export const SAVE_PATH = "/__levels/save";
const LEVELS_DIR = "src/levels/data";

// Ids are file names: lower case letters, digits and dashes.
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Write a level's file, formatted as Prettier would (CI checks the
// formatting), and add it to the end of the order if it isn't in it.
// Returns what went wrong, or null.
export async function saveLevel(
  dir: string,
  level: unknown,
): Promise<string | null> {
  if (typeof level !== "object" || level === null) return "Not a level";
  const { id } = level as { id?: unknown };
  if (typeof id !== "string" || !ID.test(id)) return "Not a good id";
  const json = (value: unknown) =>
    format(JSON.stringify(value), { parser: "json" });
  writeFileSync(join(dir, `${id}.json`), await json(level));

  const orderFile = join(dir, "order.json");
  const order: unknown = existsSync(orderFile)
    ? JSON.parse(readFileSync(orderFile, "utf8"))
    : [];
  const ids = Array.isArray(order) ? order : [];
  if (!ids.includes(id)) {
    writeFileSync(orderFile, await json([...ids, id]));
  }
  return null;
}

export function levelFiles(): Plugin {
  return {
    name: "level-files",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(SAVE_PATH, (req, res) => {
        // Only from the editor's own page (not another site in the same
        // browser).
        const origin = req.headers.origin;
        if (
          req.method !== "POST" ||
          (origin && !origin.endsWith(`//${req.headers.host}`))
        ) {
          res.statusCode = 403;
          res.end();
          return;
        }
        let body = "";
        req.on("data", (chunk) => (body += chunk));
        req.on("end", async () => {
          let problem: string | null;
          try {
            problem = await saveLevel(
              join(server.config.root, LEVELS_DIR),
              JSON.parse(body),
            );
          } catch (error) {
            problem = String(error);
          }
          res.statusCode = problem ? 400 : 200;
          res.end(problem ?? "Saved");
        });
      });
    },
  };
}
