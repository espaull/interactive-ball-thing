import type { Point } from "../geometry/point";
import type { Limits } from "../world/budget";
import type { Layout } from "../world/layout";

// What rides the track in a level.
export type Rider = "ball" | "sledge";

// A puzzle: get the rider from its start into the goal cup, using only
// what the level gives you, collecting hearts on the way. Positions in
// pixels.
export interface Level {
  // Stays the same, so progress is kept if levels are renamed or reordered.
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
  // The level's own pieces, fixed in place. The goal cup is added to them.
  pieces: Partial<Omit<Layout, "version">>;
  // What the player gets to place. Anything left out, they get none of.
  limits: Partial<Limits>;
}
