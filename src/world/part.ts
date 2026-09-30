import type { Point } from "../geometry/point";

// One kind of thing in the playground's design: lines, boost strips,
// portals, cups or cannons. Each keeps its own things, and knows how to rub
// them out, pick them up, save and load them, so Playground can loop over
// them rather than knowing about each one. Everything that changes the
// design goes through a part, which calls `changed` (for Undo and the
// autosave).
//
// Some things are *fixed*: a level's own pieces. They work like any other
// (balls roll on fixed lines, fall into fixed cups), but can't be rubbed
// out, moved or re-aimed, and aren't in the design that's saved or undone.
// Everything else is the player's own.
export interface Part<Saved> {
  // No things at all, fixed or not.
  readonly isEmpty: boolean;
  // Rub out whatever's within `radius` of a point (but nothing fixed).
  eraseAt(x: number, y: number, radius: number): void;
  // Pick up the thing at a point to move it, if this part's things move
  // (fixed ones don't).
  grabAt?(x: number, y: number): Grabbed | null;
  // Say how far each thing reaches, and from where (for fitting the
  // gallery's pictures and the view of a level).
  extent(add: (p: Point, reach: number) => void): void;
  // The player's things, or with `fixed` the fixed ones, as saved data.
  save(fixed?: boolean): Saved;
  // Replace the player's things (or with `fixed`, the fixed ones) with a
  // saved design.
  load(saved: Saved, fixed?: boolean): void;
  // Remove the player's things. Fixed ones stay.
  clear(): void;
}

// A thing picked up by the Move tool.
export interface Grabbed {
  // Where it is now, in pixels.
  readonly x: number;
  readonly y: number;
  moveTo(x: number, y: number): void;
  // Put it down.
  drop(): void;
}

// Extra reach (pixels) when tapping on something, for fingers.
export const TAP_SLACK_PX = 6;

// Things' positions (and the like) are read-only outside their part, so
// every change goes through it. Inside, they're changed with this.
export type Mutable<T> = { -readonly [K in keyof T]: T[K] };

// Pick something up: its position is read from it as it moves.
export function grab(
  thing: Point,
  moveTo: (x: number, y: number) => void,
  drop = () => {},
): Grabbed {
  return {
    get x() {
      return thing.x;
    },
    get y() {
      return thing.y;
    },
    moveTo,
    drop,
  };
}
