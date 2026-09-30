// Guides for building a track around a moving ball, shown while paused: a
// trail showing where it's just been, and the path it's about to take. They
// follow one ball: the one the camera's following, or else the newest.
import type { Camera } from "./camera";
import { distance, type Point } from "./geometry/point";
import { Ball, type Playground, type Thing } from "./world/playground";
import { predictPath } from "./world/prediction";

// How long the trail lasts, in seconds of the playground's time, so it
// holds still while paused.
const TRAIL_SECONDS = 2;
// A jump further than this in one step (pixels) is a trip through a portal,
// so the trail breaks there rather than drawing a line across.
const JUMP_PX = 60;

// Where the ball was at one step.
interface Mark extends Point {
  time: number;
  // It jumped here (through a portal) from the mark before.
  jumped: boolean;
}

// A dot of the trail to draw: `age` goes from 0 (just now) to 1 (about to
// fade away).
export interface TrailDot extends Point {
  age: number;
}

export interface GuideView {
  trail: TrailDot[][];
  // The ball's colour, for its trail.
  color: string;
  // Where it'll go next, while paused: stretches of path, split at portals.
  path: Point[][];
}

export class Guides {
  private focus: Thing | null = null;
  private marks: Mark[] = [];
  // The last prediction, and what it was worked out from, so it's only
  // worked out again when the design or the ball changes.
  private path: Point[][] = [];
  private pathFrom = "";
  // Levels leave the path out, as it would give the answer away.
  showPath = true;

  // The ball the guides are about: the one being followed, or else the
  // newest ball.
  static focusOf(playground: Playground, camera: Camera): Thing | null {
    const target = camera.target;
    if (target && playground.contains(target)) return target;
    return playground.balls.at(-1) ?? null;
  }

  // Every frame: follow whichever ball is the focus now, starting afresh if
  // it's changed.
  update(playground: Playground, camera: Camera): void {
    const focus = Guides.focusOf(playground, camera);
    if (focus === this.focus) return;
    this.focus = focus;
    this.marks = [];
    this.pathFrom = "";
  }

  // After each physics step (not while paused): note where the ball is.
  afterStep(playground: Playground): void {
    if (!this.focus) return;
    const now = playground.now;
    const p = this.focus.position;
    const last = this.marks.at(-1);
    this.marks.push({
      ...p,
      time: now,
      jumped: last !== undefined && distance(p, last) > JUMP_PX,
    });
    while (this.marks.length > 0 && now - this.marks[0].time > TRAIL_SECONDS) {
      this.marks.shift();
    }
  }

  view(playground: Playground): GuideView {
    const color = this.focus instanceof Ball ? this.focus.color : "#ffffff";
    return {
      trail: this.trail(playground),
      color,
      path: this.predict(playground),
    };
  }

  // Where the ball has just been. It's recorded all the time, so it's there
  // the moment you pause, but only shown while paused: while playing, you
  // can watch the ball itself, and a trail behind it is distracting.
  private trail(playground: Playground): TrailDot[][] {
    if (!playground.paused) return [];
    const now = playground.now;
    const trail: TrailDot[][] = [];
    for (const mark of this.marks) {
      if (mark.jumped || trail.length === 0) trail.push([]);
      trail.at(-1)!.push({
        x: mark.x,
        y: mark.y,
        age: (now - mark.time) / TRAIL_SECONDS,
      });
    }
    return trail;
  }

  // Where the ball will go if play carries on. Only while paused (while
  // playing, you can just watch), and only for balls, as bubbles wander.
  private predict(playground: Playground): Point[][] {
    const ball = this.focus;
    if (!this.showPath || !playground.paused || !(ball instanceof Ball)) {
      return [];
    }
    const { x, y } = ball.position;
    const v = ball.body.getLinearVelocity();
    const from = `${playground.revision} ${x},${y} ${v.x},${v.y}`;
    if (from !== this.pathFrom) {
      this.path = predictPath(playground, ball);
      this.pathFrom = from;
    }
    return this.path;
  }
}
