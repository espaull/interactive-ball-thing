import { distance, type Point } from "../geometry/point";
import { Signal } from "../signal";
import type { Layout } from "../world/layout";
import { roundPoint } from "../world/saved";
import {
  fitsLimits,
  isLevelId,
  MAX_HEARTS,
  usage,
  type Level,
  type LevelLimits,
  type Rider,
} from "./level";

// Tapping this close (pixels) to a heart with the Heart tool takes it
// away.
const HEART_TAP_PX = 24;
// What a new level lets the player place, to begin with: plenty, so it
// can be tried out, then tightened with "Limit to what I used".
export const NEW_LEVEL_LIMITS: LevelLimits = {
  ink: 1000,
  boost: 500,
  portals: 1,
};
// "Limit to what I used" leaves this much spare, and rounds up to a
// multiple of 10.
const SPARE = 0.15;

// A level being made in the editor: everything but its pieces, which are
// the playground's design while it's edited. It can only be saved once
// it's been won with every heart since it last changed, and that win's
// pieces are kept as its solution. Changing its limits doesn't undo a win
// as long as the winning pieces still fit.
export class LevelDraft {
  id = "";
  name = "";
  tip = "";
  rider: Rider = "ball";
  start: Point | null = null;
  goal: Point | null = null;
  hearts: Point[] = [];
  limits: LevelLimits = {};
  // The pieces that last won with every heart, and the level as it was
  // then (as JSON, without its solution). Any change since means it has
  // to be won again.
  private win: { solution: Layout; level: string } | null = null;
  // Whenever anything about it changes.
  readonly changed = new Signal();

  // Start again from a saved level (still won, if it has a solution), or
  // from nothing.
  load(level: Level | null): void {
    Object.assign(this, {
      id: level?.id ?? "",
      name: level?.name ?? "",
      tip: level?.tip ?? "",
      rider: level?.rider ?? "ball",
      start: level?.start ?? null,
      goal: level?.goal ?? null,
      hearts: [...(level?.hearts ?? [])],
      limits: { ...(level ? level.limits : NEW_LEVEL_LIMITS) },
    });
    this.win = level?.solution
      ? { solution: level.solution, level: fingerprint(level) }
      : null;
    this.changed.emit();
  }

  // Change its details (id, name, tip, rider or limits).
  update(
    details: Partial<Pick<LevelDraft, "id" | "name" | "tip" | "rider">> & {
      limits?: LevelLimits;
    },
  ): void {
    Object.assign(this, details);
    this.changed.emit();
  }

  setStart(p: Point): void {
    this.start = roundPoint(p);
    this.changed.emit();
  }

  setGoal(p: Point): void {
    this.goal = roundPoint(p);
    this.changed.emit();
  }

  // Add a heart at `p` (up to MAX_HEARTS), or take away the one there.
  toggleHeart(p: Point): void {
    const near = this.hearts.findIndex((h) => distance(h, p) < HEART_TAP_PX);
    if (near !== -1) this.hearts.splice(near, 1);
    else if (this.hearts.length < MAX_HEARTS) this.hearts.push(roundPoint(p));
    else return;
    this.changed.emit();
  }

  // The level, with these pieces, as it would be played (and saved), or
  // null while it has no start or goal. Its solution is the last win's, if
  // nothing's changed since.
  level(pieces: Layout): Level | null {
    const { start, goal } = this;
    if (!start || !goal) return null;
    const level: Level = {
      id: this.id,
      name: this.name || this.id,
      tip: this.tip,
      rider: this.rider,
      start,
      goal,
      hearts: [...this.hearts],
      limits: { ...this.limits },
      pieces,
      solution: null,
    };
    const win = this.win;
    if (
      win?.level === fingerprint(level) &&
      fitsLimits(win.solution, this.limits)
    ) {
      level.solution = win.solution;
    }
    return level;
  }

  // The winning pieces, if it's been won and nothing's changed since.
  solution(pieces: Layout): Layout | null {
    return this.level(pieces)?.solution ?? null;
  }

  // Set the limits to what the win used (and a little spare), so the
  // level's as tricky as it can be while still possible. Supplies it
  // didn't use aren't offered at all. Does nothing if it hasn't been won.
  limitToWin(pieces: Layout): void {
    const solution = this.solution(pieces);
    if (!solution) return;
    const used = usage(solution);
    const spare = (amount: number) =>
      Math.ceil((amount * (1 + SPARE)) / 10) * 10;
    const limits: LevelLimits = {};
    if (used.ink > 0) limits.ink = spare(used.ink);
    if (used.boost > 0) limits.boost = spare(used.boost);
    if (used.portals > 0) limits.portals = used.portals;
    this.update({ limits });
  }

  // A win while trying `level` out, with these pieces placed and this many
  // hearts. Kept as its solution if it got every heart.
  won(level: Level, solution: Layout, hearts: number): void {
    if (hearts < level.hearts.length) return;
    this.win = { solution, level: fingerprint(level) };
    this.changed.emit();
  }

  // What's still needed before it can be saved, with these pieces (none
  // when it's ready).
  needs(pieces: Layout): string[] {
    const needs: string[] = [];
    if (!isLevelId(this.id)) needs.push("an id, like my-level");
    if (!this.start) needs.push("a start");
    if (!this.goal) needs.push("a goal");
    const solution = this.start && this.goal && this.level(pieces)?.solution;
    if (this.start && this.goal && !solution) {
      needs.push(
        this.hearts.length > 0
          ? "a win with every heart (Try it)"
          : "a win (Try it)",
      );
    } else if (solution && isEmpty(solution)) {
      // Then it isn't a puzzle (levels.test.ts checks this too).
      needs.push("something to do: it wins without placing anything");
    }
    return needs;
  }
}

function isEmpty(layout: Layout): boolean {
  const { version: _, ...parts } = layout;
  return Object.values(parts).every((things) => things.length === 0);
}

// What about a level changes how it plays (not its id, name, tip,
// solution or limits, which are checked against the win separately), to
// tell whether it needs winning again.
function fingerprint(level: Level): string {
  const { rider, start, goal, hearts, pieces } = level;
  return JSON.stringify({ rider, start, goal, hearts, pieces });
}
