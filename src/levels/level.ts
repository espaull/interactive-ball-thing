import type { Point } from "../geometry/point";
import type { Limits } from "../world/budget";
import { parseLayout, type Layout } from "../world/layout";
import { isNumber, isPoint, isRecord, list, roundPoint } from "../world/saved";

// What rides the track in a level.
export type Rider = "ball" | "sledge";

// What a level can let the player place (the rest of `Limits` is never
// allowed in a level).
export type LevelLimits = Partial<Pick<Limits, "ink" | "boost" | "portals">>;

// A puzzle: get the rider from its start into the goal cup, using only
// what the level gives you, collecting hearts on the way. Positions in
// pixels. Levels are kept as JSON files in data/ (made with the editor),
// read with `parseLevel`.
export interface Level {
  // Also its file name. Stays the same, so progress is kept if a level's
  // renamed or moved.
  id: string;
  name: string;
  // A line of help, shown above the tool's hint.
  tip: string;
  rider: Rider;
  // Where the rider waits for Go (its centre).
  start: Point;
  // Where the goal cup is.
  goal: Point;
  // Hearts to collect on the way (up to three).
  hearts: Point[];
  // What the player gets to place. Anything left out, they get none of.
  limits: LevelLimits;
  // The level's own pieces, fixed in place. The goal cup is added to them.
  pieces: Layout;
  // Pieces a player can place to win with every heart (recorded in the
  // editor), which the tests check still work. Null until it's been won.
  solution: Layout | null;
}

export const MAX_HEARTS = 3;

// Ids are file names: lower case letters, digits and dashes.
export function isLevelId(id: unknown): id is string {
  return typeof id === "string" && /^[a-z0-9]+(-[a-z0-9]+)*$/.test(id);
}

// A level read from a file, or null if it isn't one.
export function parseLevel(data: unknown): Level | null {
  if (!isRecord(data) || !isLevelId(data.id)) return null;
  if (!isPoint(data.start) || !isPoint(data.goal)) return null;
  const pieces = parseLayout(data.pieces);
  if (!pieces) return null;
  const limits: LevelLimits = {};
  if (isRecord(data.limits)) {
    for (const key of ["ink", "boost", "portals"] as const) {
      const value = data.limits[key];
      if (isNumber(value) && value > 0) limits[key] = value;
    }
  }
  return {
    id: data.id,
    name: typeof data.name === "string" ? data.name : data.id,
    tip: typeof data.tip === "string" ? data.tip : "",
    rider: data.rider === "sledge" ? "sledge" : "ball",
    start: roundPoint(data.start),
    goal: roundPoint(data.goal),
    hearts: list(data.hearts)
      .filter(isPoint)
      .map(roundPoint)
      .slice(0, MAX_HEARTS),
    limits,
    pieces,
    solution: parseLayout(data.solution),
  };
}
