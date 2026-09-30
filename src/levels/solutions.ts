// A way to finish each level with every heart, as the pieces a player
// would place. Only the tests use these: they prove every level can be
// done, within its limits.
import type { Point } from "../geometry/point";
import { catmullRom } from "../geometry/spline";
import { LINE_SPACING_PX } from "../geometry/stroke";
import type { Playground } from "../world/playground";

export interface Solution {
  lines?: Point[][];
  boosts?: Point[][];
  portals?: { a: Point; b: Point; aimA?: number; aimB?: number }[];
}

// A smooth curve through points given as [x, y] pairs, like a drawn line.
function curve(...points: [number, number][]): Point[] {
  return catmullRom(
    points.map(([x, y]) => ({ x, y })),
    LINE_SPACING_PX,
  );
}

export const SOLUTIONS: Record<string, Solution> = {
  "first-line": {
    lines: [curve([225, 212], [480, 318], [742, 440])],
  },
  "mind-the-gap": {
    lines: [curve([290, 194], [370, 232], [445, 277])],
  },
  boost: {
    boosts: [curve([70, 480], [360, 480])],
  },
  "sledge-run": {
    lines: [curve([465, 385], [630, 398], [785, 404])],
  },
  portal: {
    portals: [
      { a: { x: 600, y: 294 }, b: { x: 860, y: 130 }, aimB: Math.PI / 2 },
    ],
  },
  loop: {
    boosts: [curve([230, 515], [400, 520])],
  },
  "up-to-the-shelf": {
    lines: [curve([445, 432], [560, 410], [650, 300], [700, 232], [718, 222])],
    boosts: [curve([470, 428], [530, 418])],
  },
  "grand-tour": {
    lines: [curve([215, 153], [320, 255], [425, 358])],
    portals: [
      { a: { x: 725, y: 350 }, b: { x: 840, y: 130 }, aimB: Math.PI / 2 },
    ],
  },
};

export function applySolution(pg: Playground, solution: Solution): void {
  for (const points of solution.lines ?? []) pg.lines.add(points);
  for (const points of solution.boosts ?? []) pg.boosts.add(points);
  for (const { a, b, aimA, aimB } of solution.portals ?? []) {
    pg.portals.add(a, b, "#a855f7", aimA ?? null, aimB ?? null);
  }
}
