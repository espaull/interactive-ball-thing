import { World, ChainShape, CircleShape, type Body } from "planck";
import { erasePolyline } from "../geometry/erase";
import type { Point } from "../geometry/point";
import { BALL_COLORS } from "../palette";
import { BOOST_ACCELERATION, BOOST_MAX_SPEED, BoostZone } from "./boosts";
import { Crossings } from "./crossings";
import {
  CANNON_INTERVAL,
  CANNON_RADIUS_PX,
  launchVelocity,
  muzzle,
  type Cannon,
} from "./cannons";
import { CUP_RADIUS_PX, Cup, createCup } from "./cups";
import {
  Portals,
  type PortalEnd,
  type PortalPair,
  type Teleport,
} from "./portals";
import { Bubble, BubbleBehaviour, createBubble } from "./bubbles";
import { PX_PER_M, toMetres, toPixels } from "./units";

export { BoostZone } from "./boosts";
export type { Cannon } from "./cannons";
export { Cup } from "./cups";
export type { PortalEnd, PortalPair, Teleport } from "./portals";
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
  readonly cups: Cup[] = [];
  readonly cannons: Cannon[] = [];
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
  // Called whenever something goes through a portal, for the effects.
  onTeleport: (teleport: Teleport) => void = () => {};
  // Called whenever a cup catches a ball, for the celebration.
  onCatch: (cup: Cup) => void = () => {};
  // Called whenever a cannon fires, for the puff and thump.
  onFire: (cannon: Cannon) => void = () => {};

  private portals = new Portals();

  // Every pair of portals.
  get portalPairs(): readonly PortalPair[] {
    return this.portals.pairs;
  }

  // Seconds of simulation so far.
  get now(): number {
    return this.time;
  }

  step(dt: number): void {
    this.time += dt;
    this.fireCannons();
    this.applyBoosts();
    this.bubbleBehaviour.beforeStep(this.time);
    this.world.step(dt, 8, 3);
    this.crossings.afterStep(this.time);
    for (const bubble of this.bubbleBehaviour.afterStep(this.time))
      this.popBubble(bubble);
    const things = [...this.balls, ...this.bubbles].map((thing) => thing.body);
    for (const teleport of this.portals.teleport(things)) {
      this.onTeleport(teleport);
    }
    this.catchBalls();
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
  // splitting them where the eraser cuts through, and any ball it touches.
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
    // A portal it touches goes, along with its partner.
    this.portals.removeNear(x, y, radius);
    // And any cannon.
    for (const cannon of [...this.cannons]) {
      if (Math.hypot(cannon.x - x, cannon.y - y) < radius + CANNON_RADIUS_PX) {
        this.cannons.splice(this.cannons.indexOf(cannon), 1);
      }
    }
    // So does any cup it touches.
    for (const cup of [...this.cups]) {
      if (Math.hypot(cup.x - x, cup.y - y) < radius + CUP_RADIUS_PX) {
        this.world.destroyBody(cup.body);
        this.cups.splice(this.cups.indexOf(cup), 1);
      }
    }
    // Balls it touches go too (handy for one stuck on a track).
    for (const ball of [...this.balls]) {
      const { x: bx, y: by } = ball.position;
      if (Math.hypot(bx - x, by - y) < radius + ball.radius)
        this.removeBall(ball);
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

  // --- Portals ---

  // A linked pair of portals at `a` and `b`. Each end's `aim` is which way
  // things come out of it (radians), or null to carry straight on.
  addPortalPair(
    a: Point,
    b: Point,
    color: string,
    aimA: number | null = null,
    aimB: number | null = null,
  ): PortalPair {
    const pair = {
      a: { x: a.x, y: a.y, aim: aimA },
      b: { x: b.x, y: b.y, aim: aimB },
      color,
    };
    this.portals.add(pair);
    return pair;
  }

  // The portal end at a point (with a little slack for fingers), if any.
  portalAt(x: number, y: number): PortalEnd | null {
    return this.portals.endAt(x, y, 6);
  }

  // --- Cannons ---

  // A cannon at (x, y) firing along `angle` with `power` (0 to 1). Its first
  // shot comes shortly after it's placed.
  addCannon(x: number, y: number, angle: number, power: number): Cannon {
    const cannon = {
      x,
      y,
      angle,
      power,
      active: true,
      aiming: false,
      nextShotAt: this.time + 0.5,
    };
    this.cannons.push(cannon);
    return cannon;
  }

  // The cannon at a point (with a little slack for fingers), if any.
  cannonAt(x: number, y: number): Cannon | null {
    // The most recently placed one wins, as it's drawn on top.
    for (let i = this.cannons.length - 1; i >= 0; i--) {
      const c = this.cannons[i];
      if (Math.hypot(c.x - x, c.y - y) < CANNON_RADIUS_PX + 6) return c;
    }
    return null;
  }

  // Fire every cannon whose next shot is due.
  private fireCannons(): void {
    for (const cannon of this.cannons) {
      if (!cannon.active || cannon.aiming) continue;
      if (this.time < cannon.nextShotAt) continue;
      const { x, y } = muzzle(cannon);
      const ball = this.addBall(x, y);
      ball.body.setLinearVelocity(toMetres(launchVelocity(cannon)));
      cannon.nextShotAt = this.time + CANNON_INTERVAL;
      this.onFire(cannon);
    }
  }

  // --- Goal cups ---

  addCup(x: number, y: number): Cup {
    const cup = createCup(this.world, x, y);
    this.cups.push(cup);
    return cup;
  }

  // Balls that have dropped into a cup are caught: removed and counted.
  private catchBalls(): void {
    if (this.cups.length === 0) return;
    for (const ball of [...this.balls]) {
      const cup = this.cups.find((c) => c.catches(ball.position));
      if (!cup) continue;
      this.removeBall(ball);
      cup.caught++;
      this.onCatch(cup);
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
    for (const cup of this.cups) this.world.destroyBody(cup.body);
    this.cups.length = 0;
    this.cannons.length = 0;
    this.lines.length = 0;
    this.balls.length = 0;
    this.bubbles.length = 0;
    this.boosts.length = 0;
    this.portals.clear();
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
