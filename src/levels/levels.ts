import { parseLevel, type Level } from "./level";

// Every level file in data/ (made with the editor), by file name.
const files = import.meta.glob<unknown>("./data/*.json", {
  eager: true,
  import: "default",
});

function fileOf(path: string): string {
  return path.replace(/^.*\/|\.json$/g, "");
}

// The levels, in the order data/order.json lists them. Any level file not
// in the list comes after, so a new one isn't lost. Each is proven
// finishable, with every heart, by levels.test.ts.
export const LEVELS: Level[] = loadLevels();

function loadLevels(): Level[] {
  const order = files["./data/order.json"];
  const byId = new Map<string, Level>();
  for (const [path, data] of Object.entries(files)) {
    const level = parseLevel(data);
    if (level && level.id === fileOf(path)) byId.set(level.id, level);
  }
  const ids = Array.isArray(order) ? order.filter((id) => byId.has(id)) : [];
  const rest = [...byId.keys()].filter((id) => !ids.includes(id)).sort();
  return [...ids, ...rest].map((id) => byId.get(id)!);
}
