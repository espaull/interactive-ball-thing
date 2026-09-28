import {
  World,
  ChainShape,
  CircleShape,
  type Body,
  type Contact,
} from "planck";
import { erasePolyline } from "./erase";
import type { Point } from "./simplify";

// Planck works in metres; everything outside this file works in CSS pixels.
export const PX_PER_M = 40;

const BALL_RADIUS_M = 0.4;
const MAX_BALLS = 200;
const COLORS = [
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#06b6d4",
  "#3b82f6",
  "#a855f7",
  "#ec4899",
];

const BUBBLE_MIN_RADIUS_M = 0.35;
const BUBBLE_MAX_RADIUS_M = 0.65;
const MAX_BUBBLES = 100;
// Negative gravity makes bubbles rise; -0.15 of normal gravity is a gentle float.
const BUBBLE_GRAVITY_SCALE = -0.15;
// Air drag, so bubbles drift rather than accelerate forever.
const BUBBLE_DAMPING = 0.4;
// Sideways wobble force, as a fraction of the bubble's weight.
const BUBBLE_WOBBLE = 0.08;
// Bumps a bubble survives before popping, and the minimum time between two
// bumps counting separately (seconds).
const BUBBLE_HITS_TO_POP = 3;
const BUBBLE_HIT_COOLDOWN = 0.25;
// Something the bubble stopped touching less than this long ago (seconds)
// doesn't count as a new bump when it touches again. Covers sliding from one
// segment of a line to the next, and tiny lift-offs while scraping along.
const BUBBLE_TOUCH_GRACE = 0.15;
// Minimum downward speed after bumping into a line above (m/s). Bubbles only
// drift up slowly, so a normal bounce off a ceiling would barely register.
const CEILING_BOUNCE_SPEED = 2.5;

export interface Line {
  body: Body;
  points: Point[]; // pixels, kept for drawing
}

// One end of a line, for continuing it.
export interface LineEnd {
  line: Line;
  atStart: boolean;
  point: Point;
}

export interface Ball {
  body: Body;
  radius: number; // pixels
  color: string;
}

export interface Bubble {
  body: Body;
  radius: number; // pixels
  // Random offset so bubbles wobble and shimmer out of step with each other.
  phase: number;
  // Bumps so far; the bubble pops when this reaches BUBBLE_HITS_TO_POP.
  hits: number;
  // Playground time of the last counted bump (drives the wobble too).
  lastHitAt: number;
  // How many contacts the bubble has with each body it's touching (a line is
  // many segments, so it can have several with one line).
  touching: Map<Body, number>;
  // When the bubble was last seen touching each body, checked after each step.
  lastTouched: Map<Body, number>;
}

// Anything the camera can follow.
export type Thing = Ball | Bubble;

// The last (topmost) item in `list` within `slack` pixels of its edge.
function findAt<T extends Thing>(
  list: T[],
  x: number,
  y: number,
  slack: number,
): T | null {
  for (let i = list.length - 1; i >= 0; i--) {
    const pos = list[i].body.getPosition();
    const distance = Math.hypot(pos.x * PX_PER_M - x, pos.y * PX_PER_M - y);
    if (distance <= list[i].radius + slack) return list[i];
  }
  return null;
}

export class Playground {
  // y grows downwards, matching screen coordinates.
  readonly world = new World({ gravity: { x: 0, y: 10 } });
  readonly lines: Line[] = [];
  readonly balls: Ball[] = [];
  readonly bubbles: Bubble[] = [];
  // Highest and lowest points of any drawn line, in world pixels.
  private highestLineY = Infinity;
  private lowestLineY = -Infinity;
  private time = 0;
  private bubbleByBody = new Map<Body, Bubble>();
  private lineBodies = new Set<Body>();
  // Bubbles that bumped a line above them during this step.
  private ceilingHits = new Set<Bubble>();
  // Bubbles that took their last bump during this step.
  private worn = new Set<Bubble>();

  // Called whenever a bubble pops (clicked or bumped too often), for the
  // splash and sound.
  onPop: (x: number, y: number, radius: number) => void = () => {};

  constructor() {
    this.world.on("begin-contact", this.onBeginContact);
    this.world.on("end-contact", this.onEndContact);
  }

  // Seconds of simulation so far.
  get now(): number {
    return this.time;
  }

  addLine(points: Point[]): void {
    if (points.length < 2) return;
    this.lines.push({ body: this.createChain(points), points });
  }

  // Give an existing line a new shape (used when a line is continued), so it
  // stays one smooth chain with no bump at the join.
  replaceLine(line: Line, points: Point[]): void {
    if (points.length < 2) return;
    this.lineBodies.delete(line.body);
    this.world.destroyBody(line.body);
    line.body = this.createChain(points);
    line.points = points;
  }

  removeLine(line: Line): void {
    const index = this.lines.indexOf(line);
    if (index === -1) return;
    this.lineBodies.delete(line.body);
    this.world.destroyBody(line.body);
    this.lines.splice(index, 1);
  }

  // Rub out every part of every line inside a circle, splitting lines where
  // the eraser cuts through them.
  eraseAt(x: number, y: number, radius: number): void {
    for (const line of [...this.lines]) {
      const pieces = erasePolyline(line.points, { x, y }, radius);
      if (!pieces) continue;
      this.removeLine(line);
      for (const piece of pieces) this.addLine(piece);
    }
  }

  // The line end closest to a world point, within `radius` pixels, ignoring
  // the ends of `except`.
  lineEndAt(x: number, y: number, radius: number, except?: Line): LineEnd | null {
    let best: LineEnd | null = null;
    let bestDistance = radius;
    for (const line of this.lines) {
      if (line === except) continue;
      for (const atStart of [true, false]) {
        const point = atStart ? line.points[0] : line.points.at(-1)!;
        const distance = Math.hypot(point.x - x, point.y - y);
        if (distance <= bestDistance) {
          best = { line, atStart, point };
          bestDistance = distance;
        }
      }
    }
    return best;
  }

  private createChain(points: Point[]): Body {
    const body = this.world.createBody({ type: "static" });
    const vertices = points.map((p) => ({
      x: p.x / PX_PER_M,
      y: p.y / PX_PER_M,
    }));
    body.createFixture({
      shape: new ChainShape(vertices, false),
      friction: 0.6,
    });
    this.lineBodies.add(body);
    for (const p of points) {
      this.lowestLineY = Math.max(this.lowestLineY, p.y);
      this.highestLineY = Math.min(this.highestLineY, p.y);
    }
    return body;
  }

  addBall(x: number, y: number): Ball {
    const body = this.world.createBody({
      type: "dynamic",
      position: { x: x / PX_PER_M, y: y / PX_PER_M },
      bullet: true, // continuous collision, so fast balls can't skip through thin lines
    });
    body.createFixture({
      shape: new CircleShape(BALL_RADIUS_M),
      density: 1,
      friction: 0.4,
      restitution: 0.3,
    });
    const color = COLORS[Math.floor(Math.random() * COLORS.length)];
    const ball = { body, radius: BALL_RADIUS_M * PX_PER_M, color };
    this.balls.push(ball);

    if (this.balls.length > MAX_BALLS) this.removeBall(0);
    return ball;
  }

  addBubble(x: number, y: number): Bubble {
    const radiusM =
      BUBBLE_MIN_RADIUS_M +
      Math.random() * (BUBBLE_MAX_RADIUS_M - BUBBLE_MIN_RADIUS_M);
    const body = this.world.createBody({
      type: "dynamic",
      position: { x: x / PX_PER_M, y: y / PX_PER_M },
      gravityScale: BUBBLE_GRAVITY_SCALE,
      linearDamping: BUBBLE_DAMPING,
      angularDamping: 1,
    });
    body.createFixture({
      shape: new CircleShape(radiusM),
      density: 0.05, // light, so balls shove bubbles aside
      friction: 0.05,
      restitution: 0.9,
    });
    const bubble = {
      body,
      radius: radiusM * PX_PER_M,
      phase: Math.random() * Math.PI * 2,
      hits: 0,
      lastHitAt: -Infinity,
      touching: new Map<Body, number>(),
      lastTouched: new Map<Body, number>(),
    };
    this.bubbles.push(bubble);
    this.bubbleByBody.set(body, bubble);

    if (this.bubbles.length > MAX_BUBBLES) this.removeBubble(0);
    return bubble;
  }

  // The topmost ball or bubble under a world point (with a little slack for fingers).
  thingAt(x: number, y: number): Thing | null {
    // Bubbles are drawn on top of balls, so check them first.
    return findAt(this.bubbles, x, y, 10) ?? findAt(this.balls, x, y, 10);
  }

  // The topmost bubble under a world point. Less slack than thingAt, so
  // starting a line right next to a bubble doesn't pop it.
  bubbleAt(x: number, y: number): Bubble | null {
    return findAt(this.bubbles, x, y, 6);
  }

  popBubble(bubble: Bubble): void {
    const index = this.bubbles.indexOf(bubble);
    if (index === -1) return;
    const pos = bubble.body.getPosition();
    this.removeBubble(index);
    this.onPop(pos.x * PX_PER_M, pos.y * PX_PER_M, bubble.radius);
  }

  contains(thing: Thing): boolean {
    return (
      this.balls.includes(thing as Ball) ||
      this.bubbles.includes(thing as Bubble)
    );
  }

  step(dt: number): void {
    this.time += dt;
    for (const bubble of this.bubbles) {
      const weight = bubble.body.getMass() * 10;
      const push =
        Math.sin(this.time * 1.7 + bubble.phase) * weight * BUBBLE_WOBBLE;
      bubble.body.applyForceToCenter({ x: push, y: 0 }, true);
    }

    this.world.step(dt, 8, 3);

    for (const bubble of this.bubbles) this.countBumps(bubble);
    // Bodies can't be removed mid-step, so bubbles that took their last bump
    // pop now.
    for (const bubble of this.worn) this.popBubble(bubble);
    this.worn.clear();

    // Kick bubbles that touched a ceiling back down. Done after the step,
    // because velocities set mid-step get overwritten by the solver.
    for (const bubble of this.ceilingHits) {
      if (!this.bubbleByBody.has(bubble.body)) continue;
      const v = bubble.body.getLinearVelocity();
      bubble.body.setLinearVelocity({
        x: v.x,
        y: Math.max(v.y, CEILING_BOUNCE_SPEED),
      });
    }
    this.ceilingHits.clear();
  }

  private onBeginContact = (contact: Contact) => {
    const bodyA = contact.getFixtureA().getBody();
    const bodyB = contact.getFixtureB().getBody();
    // Both sides count when two bubbles bump.
    for (const [self, other] of [[bodyA, bodyB], [bodyB, bodyA]]) {
      const touching = this.bubbleByBody.get(self)?.touching;
      if (touching) touching.set(other, (touching.get(other) ?? 0) + 1);
    }

    const bubble = this.bubbleByBody.get(bodyA) ?? this.bubbleByBody.get(bodyB);
    const other = this.bubbleByBody.has(bodyA) ? bodyB : bodyA;
    if (!bubble || !this.lineBodies.has(other)) return;

    const manifold = contact.getWorldManifold(null);
    if (!manifold || manifold.pointCount === 0) return;
    // The normal points from A to B; flip it so it points from bubble to line.
    const towardsLineY =
      bubble.body === bodyA ? manifold.normal.y : -manifold.normal.y;
    // y grows downwards, so a negative y means the line is above the bubble.
    if (towardsLineY < -0.5) this.ceilingHits.add(bubble);
  };

  private onEndContact = (contact: Contact) => {
    const bodyA = contact.getFixtureA().getBody();
    const bodyB = contact.getFixtureB().getBody();
    for (const [self, other] of [[bodyA, bodyB], [bodyB, bodyA]]) {
      const touching = this.bubbleByBody.get(self)?.touching;
      if (!touching) continue;
      const count = (touching.get(other) ?? 1) - 1;
      if (count > 0) touching.set(other, count);
      else touching.delete(other);
    }
  };

  // Checked after each step rather than on each contact event: contacts
  // with neighbouring segments of a line can end and begin in either order
  // within one step, which would look like a fresh bump. A bump counts when
  // the bubble touches something it hasn't touched recently, and not within
  // a moment of its last bump.
  private countBumps(bubble: Bubble): void {
    let bumped = false;
    for (const body of bubble.touching.keys()) {
      const seen = bubble.lastTouched.get(body);
      if (seen === undefined || this.time - seen > BUBBLE_TOUCH_GRACE) bumped = true;
      bubble.lastTouched.set(body, this.time);
    }
    for (const [body, seen] of bubble.lastTouched) {
      if (this.time - seen > BUBBLE_TOUCH_GRACE) bubble.lastTouched.delete(body);
    }
    if (!bumped || this.time - bubble.lastHitAt < BUBBLE_HIT_COOLDOWN) return;
    bubble.hits++;
    bubble.lastHitAt = this.time;
    if (bubble.hits >= BUBBLE_HITS_TO_POP) this.worn.add(bubble);
  }

  // Remove balls that have fallen well below the lowest line, and bubbles
  // that have floated well above the highest one, so they can never land on
  // anything again. Not tied to the view: a followed ball would otherwise
  // drag the view (and the limit) down with it forever.
  cull(minFloorPx: number, maxCeilingPx: number): void {
    const floor = Math.max(this.lowestLineY, minFloorPx) / PX_PER_M + 25;
    for (let i = this.balls.length - 1; i >= 0; i--) {
      if (this.balls[i].body.getPosition().y > floor) this.removeBall(i);
    }
    const ceiling = Math.min(this.highestLineY, maxCeilingPx) / PX_PER_M - 25;
    for (let i = this.bubbles.length - 1; i >= 0; i--) {
      if (this.bubbles[i].body.getPosition().y < ceiling) this.removeBubble(i);
    }
  }

  clear(): void {
    for (const line of this.lines) this.world.destroyBody(line.body);
    for (const ball of this.balls) this.world.destroyBody(ball.body);
    for (const bubble of this.bubbles) this.world.destroyBody(bubble.body);
    this.lines.length = 0;
    this.balls.length = 0;
    this.bubbles.length = 0;
    this.bubbleByBody.clear();
    this.lineBodies.clear();
    this.lowestLineY = -Infinity;
    this.highestLineY = Infinity;
  }

  private removeBall(index: number): void {
    this.world.destroyBody(this.balls[index].body);
    this.balls.splice(index, 1);
  }

  private removeBubble(index: number): void {
    const bubble = this.bubbles[index];
    this.world.destroyBody(bubble.body);
    this.bubbleByBody.delete(bubble.body);
    this.bubbles.splice(index, 1);
  }
}
