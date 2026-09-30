import { polylineLength } from "../geometry/point";
import type { Playground } from "./playground";

// How much a level lets the player place: Infinity for no limit (free
// play), 0 for none (the tool isn't offered).
export interface Limits {
  // Pixels of track, drawn or curved.
  ink: number;
  // Pixels of boost strip.
  boost: number;
  // Pairs of portals.
  portals: number;
  cups: number;
  cannons: number;
  // Tapping to drop balls, sledges and bubbles (which aren't counted: it's
  // allowed or not).
  drops: number;
  // Pieces of terrain (rocks, strips of spikes and no-drawing areas),
  // counted. Levels never give the player any, as it's what levels are made
  // of.
  terrain: number;
}

export type Supply = keyof Limits;

export const NO_LIMITS: Limits = {
  ink: Infinity,
  boost: Infinity,
  portals: Infinity,
  cups: Infinity,
  cannons: Infinity,
  drops: Infinity,
  terrain: Infinity,
};

// Supplies measured by length (shown as a meter), rather than counted.
export function isMeasured(supply: Supply): boolean {
  return supply === "ink" || supply === "boost";
}

// What's left of each supply: the limit, less what the player has placed.
// Only the player's things count (not a level's fixed ones), and rubbing
// something out gives it back.
export class Budget {
  limits: Limits = NO_LIMITS;

  constructor(private playground: Playground) {}

  // Can the player use this at all?
  allows(supply: Supply): boolean {
    return this.limits[supply] > 0;
  }

  // Is it limited (so worth showing how much is left)?
  isLimited(supply: Supply): boolean {
    return this.allows(supply) && Number.isFinite(this.limits[supply]);
  }

  // How much is left (can dip just below 0, as joining a line onto another
  // smooths the join and can add a pixel or two).
  left(supply: Supply): number {
    return this.limits[supply] - this.used(supply);
  }

  private used(supply: Supply): number {
    const { lines, boosts, portals, cups, cannons, rocks, spikes, noDraw } =
      this.playground;
    const own = <T extends { fixed: boolean }>(things: readonly T[]) =>
      things.filter((thing) => !thing.fixed);
    switch (supply) {
      case "ink":
        return sum(own(lines.all).map((line) => polylineLength(line.points)));
      case "boost":
        return sum(own(boosts.all).map((b) => polylineLength(b.points)));
      case "portals":
        return own(portals.pairs).length;
      case "cups":
        return own(cups.all).length;
      case "cannons":
        return own(cannons.all).length;
      case "drops":
        return 0;
      case "terrain":
        return (
          own(rocks.all).length +
          own(spikes.all).length +
          own(noDraw.all).length
        );
    }
  }
}

function sum(values: number[]): number {
  return values.reduce((total, v) => total + v, 0);
}
