import { World, ChainShape, CircleShape, type Body } from "planck";
import { erasePolyline } from "../geometry/erase";
import type { Point } from "../geometry/point";
import { BALL_COLORS } from "../palette";
import { BOOST_ACCELERATION, BOOST_MAX_SPEED, BoostZone } from "./boosts";
import { Crossings } from "./crossings";
import { Bubble, BubbleBehaviour, createBubble } from "./bubbles";
import { PX_PER_M, toMetres, toPixels } from "./units";

export { BoostZone } from "./boosts";
export { Bubble } from "./bubbles";

const BALL_RADIUS_M = 0.4;
const MAX_BALLS = 200;
const MAX_BUBBLES = 100;

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

export class Ball {
  constructor(
    readonly body: Body,
    readonly radius: number, // pixels
    readonly color: string,
  ) {}

  // Centre, in pixels.
  get position(): Point {
    return toPixels(this.body.getPosition());
  }

  // How far it has rolled round, in radians.
  get angle(): number {
    return this.body.getAngle();
  }
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
    const pos = list[i].position;
    if (Math.hypot(pos.x - x, pos.y - y) <= list[i].radius + slack)
      return list[i];
  }
  return null;
}

// Everything in the world: the physics simulation plus the lines, balls and
// bubbles in it. Positions in and out are in pixels.
export class Playground {
  // y grows downwards, matching screen coordinates.
  readonly world = new World({ gravity: { x: 0, y: 10 } });
  readonly lines: Line[] = [];
  readonly balls: Ball[] = [];
  readonly bubbles: Bubble[] = [];
  readonly boosts: BoostZone[] = [];
  // Highest and lowest points of any drawn line, in pixels.
  private highestLineY = Infinity;
  private lowestLineY = -Infinity;
  private time = 0;
  private lineBodies = new Set<Body>();
  // Lets balls pass through the places where a line crosses itself.
  private crossings = new Crossings(
    this.world,
    (body) => this.lines.find((line) => line.body === body)?.points,
  );
  private bubbleBehaviour = new BubbleBehaviour(this.world, (body) =>
    this.lineBodies.has(body),
  );

  // Called whenever a bubble pops (clicked or bumped too often), for the
  // splash and sound.
  onPop: (x: number, y: number, radius: number) => void = () => {};

  // Seconds of simulation so far.
  get now(): number {
    return this.time;
  }

  step(dt: number): void {
    this.time += dt;
    this.applyBoosts();
    this.bubbleBehaviour.beforeStep(this.time);
    this.world.step(dt, 8, 3);
    for (const bubble of this.bubbleBehaviour.afterStep(this.time))
      this.popBubble(bubble);
  }

  // --- Lines ---

  addLine(points: Point[]): void {
    if (points.length < 2) return;
    this.lines.push({ body: this.createChain(points), points });
  }

  // Give an existing line a new shape (used when a line is continued), so it
  // stays one smooth chain with no bump at the join.
  replaceLine(line: Line, points: Point[]): void {
    if (points.length < 2) return;
    this.destroyChain(line.body);
    line.body = this.createChain(points);
    line.points = points;
  }

  removeLine(line: Line): void {
    const index = this.lines.indexOf(line);
    if (index === -1) return;
    this.destroyChain(line.body);
    this.lines.splice(index, 1);
  }

  // Rub out every part of every line and boost strip inside a circle,
  // splitting them where the eraser cuts through.
  eraseAt(x: number, y: number, radius: number): void {
    for (const line of [...this.lines]) {
      const pieces = erasePolyline(line.points, { x, y }, radius);
      if (!pieces) continue;
      this.removeLine(line);
      for (const piece of pieces) this.addLine(piece);
    }
    for (const boost of [...this.boosts]) {
      const pieces = erasePolyline(boost.points, { x, y }, radius);
      if (!pieces) continue;
      this.boosts.splice(this.boosts.indexOf(boost), 1);
      // Pieces keep the order of the points, so they still point the same way.
      for (const piece of pieces) this.addBoost(piece);
    }
  }

  // The line end closest to a point, within `radius` pixels, ignoring the
  // ends of `except`.
  lineEndAt(
    x: number,
    y: number,
    radius: number,
    except?: Line,
  ): LineEnd | null {
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
    body.createFixture({
      shape: new ChainShape(points.map(toMetres), false),
      friction: 0.6,
    });
    this.lineBodies.add(body);
    for (const p of points) {
      this.lowestLineY = Math.max(this.lowestLineY, p.y);
      this.highestLineY = Math.min(this.highestLineY, p.y);
    }
    return body;
  }

  private destroyChain(body: Body): void {
    this.lineBodies.delete(body);
    this.world.destroyBody(body);
  }

  // --- Boost strips ---

  // A strip along `points`, pushing balls in the direction they run.
  addBoost(points: Point[]): void {
    if (points.length < 2) return;
    this.boosts.push(new BoostZone(points));
  }

  // Push each ball that's on a strip along it, until it reaches top speed.
  // Only one strip pushes a ball at a time, so overlapping strips don't add up.
  private applyBoosts(): void {
    if (this.boosts.length === 0) return;
    for (const ball of this.balls) {
      const position = ball.position;
      for (const boost of this.boosts) {
        const dir = boost.directionAt(position);
        if (!dir) continue;
        const v = ball.body.getLinearVelocity();
        if (v.x * dir.x + v.y * dir.y < BOOST_MAX_SPEED) {
          const push = ball.body.getMass() * BOOST_ACCELERATION;
          ball.body.applyForceToCenter(
            { x: dir.x * push, y: dir.y * push },
            true,
          );
        }
        break;
      }
    }
  }

  // --- Balls and bubbles ---

  addBall(x: number, y: number): Ball {
    const body = this.world.createBody({
      type: "dynamic",
      position: toMetres({ x, y }),
      bullet: true, // continuous collision, so fast balls can't skip through thin lines
    });
    body.createFixture({
      shape: new CircleShape(BALL_RADIUS_M),
      density: 1,
      friction: 0.4,
      restitution: 0.3,
    });
    const color = BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)];
    const ball = new Ball(body, BALL_RADIUS_M * PX_PER_M, color);
    this.balls.push(ball);

    if (this.balls.length > MAX_BALLS) this.removeBall(this.balls[0]);
    return ball;
  }

  addBubble(x: number, y: number): Bubble {
    const bubble = createBubble(this.world, x, y);
    this.bubbles.push(bubble);
    this.bubbleBehaviour.add(bubble);

    if (this.bubbles.length > MAX_BUBBLES) this.removeBubble(this.bubbles[0]);
    return bubble;
  }

  // The topmost ball or bubble under a point (with a little slack for fingers).
  thingAt(x: number, y: number): Thing | null {
    // Bubbles are drawn on top of balls, so check them first.
    return findAt(this.bubbles, x, y, 10) ?? findAt(this.balls, x, y, 10);
  }

  // The topmost bubble under a point. Less slack than thingAt, so starting a
  // line right next to a bubble doesn't pop it.
  bubbleAt(x: number, y: number): Bubble | null {
    return findAt(this.bubbles, x, y, 6);
  }

  popBubble(bubble: Bubble): void {
    if (!this.bubbles.includes(bubble)) return;
    const { x, y } = bubble.position;
    this.removeBubble(bubble);
    this.onPop(x, y, bubble.radius);
  }

  contains(thing: Thing): boolean {
    return thing instanceof Ball
      ? this.balls.includes(thing)
      : this.bubbles.includes(thing);
  }

  // Remove balls that have fallen well below the lowest line, and bubbles
  // that have floated well above the highest one, so they can never land on
  // anything again. `minFloorPx` and `maxCeilingPx` keep things around when
  // there are no lines yet. Not tied to the view: a followed ball would
  // otherwise drag the view (and the limit) down with it forever.
  cull(minFloorPx: number, maxCeilingPx: number): void {
    const margin = 1000;
    const floor = Math.max(this.lowestLineY, minFloorPx) + margin;
    for (const ball of [...this.balls]) {
      if (ball.position.y > floor) this.removeBall(ball);
    }
    const ceiling = Math.min(this.highestLineY, maxCeilingPx) - margin;
    for (const bubble of [...this.bubbles]) {
      if (bubble.position.y < ceiling) this.removeBubble(bubble);
    }
  }

  clear(): void {
    for (const line of this.lines) this.world.destroyBody(line.body);
    for (const ball of this.balls) this.world.destroyBody(ball.body);
    for (const bubble of this.bubbles) this.world.destroyBody(bubble.body);
    this.lines.length = 0;
    this.balls.length = 0;
    this.bubbles.length = 0;
    this.boosts.length = 0;
    this.bubbleBehaviour.clear();
    this.crossings.clear();
    this.lineBodies.clear();
    this.lowestLineY = -Infinity;
    this.highestLineY = Infinity;
  }

  private removeBall(ball: Ball): void {
    this.world.destroyBody(ball.body);
    this.balls.splice(this.balls.indexOf(ball), 1);
  }

  private removeBubble(bubble: Bubble): void {
    this.world.destroyBody(bubble.body);
    this.bubbleBehaviour.remove(bubble);
    this.bubbles.splice(this.bubbles.indexOf(bubble), 1);
  }
}
