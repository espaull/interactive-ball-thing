import { distance, type Box, type Point } from "../geometry/point";
import { Signal } from "../signal";
import { NO_LIMITS, type Budget, type Limits } from "../world/budget";
import { emptyLayout } from "../world/layout";
import {
  randomBallColor,
  type Ball,
  type Cup,
  type Playground,
} from "../world/playground";
import type { Level } from "./level";

// Slower than this (pixels/s) for this long (seconds), the rider's stuck.
const STUCK_SPEED = 15;
const STUCK_SECONDS = 2;
// Further than this (pixels) outside the level, the rider's lost.
const LOST_MARGIN_PX = 400;
// A run that goes on longer than this (seconds) without reaching the goal
// is over too: the rider's rolling to and fro in a valley for ever.
const MAX_RUN_SECONDS = 20;
// A heart is collected when the rider's edge comes this close (pixels) to
// its middle.
export const HEART_REACH_PX = 14;

// "building": placing pieces, with the rider waiting at the start (the
// playground's paused). "running": after Go. "won": it reached the goal.
export type Stage = "building" | "running" | "won";

// Playing a level: its pieces fixed in the playground, the budget set to
// its limits, the rider waiting at the start until Go, then watching for
// hearts collected, the goal reached, or the rider getting lost (falling
// off, stuck, or rubbed out), which puts it back at the start. The
// player's own pieces stay put through all of that.
export class LevelPlay {
  private current: Level | null = null;
  private currentStage: Stage = "building";
  private rider: Ball | null = null;
  // The rider's colour, the same each try.
  private color = "";
  private goal: Cup | null = null;
  // The goal's count when the rider set off.
  private caughtBefore = 0;
  // Which hearts (by index) this run has collected.
  private collected = new Set<number>();
  // The area the level covers.
  private bounds: Box = { left: 0, top: 0, right: 0, bottom: 0 };
  private slowFor = 0;
  private runTime = 0;
  // Whenever the level or the stage changes (for the Go button).
  readonly changed = new Signal();

  // A heart was collected.
  onHeart: (heart: Point) => void = () => {};
  // The rider reached the goal, with this many hearts.
  onWin: (hearts: number) => void = () => {};
  // The rider got lost here, and went back to the start.
  onLost: (at: Point) => void = () => {};

  constructor(
    private playground: Playground,
    private budget: Budget,
  ) {}

  get level(): Level | null {
    return this.current;
  }

  get stage(): Stage {
    return this.currentStage;
  }

  // The hearts not collected yet on this run.
  get hearts(): Point[] {
    return (this.current?.hearts ?? []).filter(
      (_, i) => !this.collected.has(i),
    );
  }

  get heartsCollected(): number {
    return this.collected.size;
  }

  // The area the level covers: its pieces, start, goal and hearts.
  get view(): Box {
    return this.bounds;
  }

  // Start playing a level: its pieces replace whatever was there.
  start(level: Level): void {
    const { playground } = this;
    this.current = level;
    playground.clear();
    const { pieces, goal } = level;
    playground.fix({ ...pieces, cups: [...pieces.cups, goal] });
    this.goal =
      playground.cups.all.find(
        (cup) => cup.fixed && cup.x === goal.x && cup.y === goal.y,
      ) ?? null;
    const none: Limits = {
      ink: 0,
      boost: 0,
      portals: 0,
      cups: 0,
      cannons: 0,
      drops: 0,
    };
    this.budget.limits = { ...none, ...level.limits };
    this.color = randomBallColor();
    this.bounds = this.measure(level);
    this.reset();
  }

  // Stop playing: the level's pieces go, and there are no limits again.
  leave(): void {
    this.current = null;
    this.rider = null;
    this.goal = null;
    this.playground.clear();
    this.playground.fix(emptyLayout());
    this.budget.limits = NO_LIMITS;
    this.playground.setPaused(false);
    this.currentStage = "building";
    this.changed.emit();
  }

  // Let the rider go.
  go(): void {
    if (!this.current || this.currentStage !== "building") return;
    this.placeRider();
    this.caughtBefore = this.goal?.caught ?? 0;
    this.slowFor = 0;
    this.runTime = 0;
    this.currentStage = "running";
    this.playground.setPaused(false);
    this.changed.emit();
  }

  // Back to the start, to try again: the rider waits there, and the hearts
  // are all back. The player's pieces stay.
  reset(): void {
    if (!this.current) return;
    if (this.rider) this.playground.removeBall(this.rider);
    this.rider = null;
    this.collected.clear();
    this.currentStage = "building";
    this.placeRider();
    this.playground.setPaused(true);
    this.changed.emit();
  }

  // Every frame: while building, keep the rider waiting at the start (it
  // can be rubbed out, or cleared away with the player's pieces).
  update(): void {
    if (this.current && this.currentStage === "building") this.placeRider();
  }

  // After each physics step.
  afterStep(dt: number): void {
    const rider = this.rider;
    if (!this.current || this.currentStage !== "running" || !rider) return;

    if (!this.playground.contains(rider)) {
      // Gone: into the goal cup (which counts what it catches), or rubbed
      // out.
      if ((this.goal?.caught ?? 0) > this.caughtBefore) this.win();
      else this.lose(rider.position);
      return;
    }

    const p = rider.position;
    this.current.hearts.forEach((heart, i) => {
      if (this.collected.has(i)) return;
      if (distance(p, heart) < rider.radius + HEART_REACH_PX) {
        this.collected.add(i);
        this.onHeart(heart);
      }
    });

    this.slowFor = rider.speed < STUCK_SPEED ? this.slowFor + dt : 0;
    this.runTime += dt;
    const { left, top, right, bottom } = this.bounds;
    const m = LOST_MARGIN_PX;
    const outside =
      p.x < left - m || p.x > right + m || p.y < top - m || p.y > bottom + m;
    const stuck = this.slowFor > STUCK_SECONDS;
    if (outside || stuck || this.runTime > MAX_RUN_SECONDS) this.lose(p);
  }

  private win(): void {
    this.rider = null;
    this.currentStage = "won";
    this.changed.emit();
    this.onWin(this.collected.size);
  }

  private lose(at: Point): void {
    this.onLost(at);
    this.reset();
  }

  // Put the rider at the start, unless it's already there.
  private placeRider(): void {
    const { playground, current: level } = this;
    if (!level || (this.rider && playground.contains(this.rider))) return;
    const { x, y } = level.start;
    this.rider =
      level.rider === "sledge"
        ? playground.addSledge(x, y, this.color)
        : playground.addBall(x, y, this.color);
  }

  private measure(level: Level): Box {
    const box = this.playground.designBounds() ?? {
      left: level.start.x,
      top: level.start.y,
      right: level.start.x,
      bottom: level.start.y,
    };
    for (const p of [level.start, level.goal, ...level.hearts]) {
      box.left = Math.min(box.left, p.x - 30);
      box.top = Math.min(box.top, p.y - 30);
      box.right = Math.max(box.right, p.x + 30);
      box.bottom = Math.max(box.bottom, p.y + 30);
    }
    return box;
  }
}
