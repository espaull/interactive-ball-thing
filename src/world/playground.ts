import { World, BoxShape, CircleShape, type Body } from "planck";
import type { Box, Point } from "../geometry/point";
import { BALL_COLORS } from "../palette";
import { Boosts } from "./boosts";
import { Bubble, BubbleBehaviour, createBubble } from "./bubbles";
import { Cannons, launchVelocity, muzzle, type Cannon } from "./cannons";
import { Crossings } from "./crossings";
import { Cups, type Cup } from "./cups";
import type { Layout } from "./layout";
import { Lines } from "./lines";
import { NoDrawZones } from "./no-draw";
import type { Grabbed, Part } from "./part";
import { Portals, type Teleport } from "./portals";
import { Rocks } from "./rocks";
import { Spikes } from "./spikes";
import { Signal } from "../signal";
import { PX_PER_M, toMetres, toPixels } from "./units";

export { BoostZone } from "./boosts";
export { Bubble } from "./bubbles";
export type { Cannon } from "./cannons";
export { Cup } from "./cups";
export type { Line, LineEnd } from "./lines";
export type { NoDrawZone } from "./no-draw";
export type { Grabbed } from "./part";
export type { PortalEnd, PortalPair, Teleport } from "./portals";
export type { Rock } from "./rocks";
export type { SpikeStrip } from "./spikes";

const BALL_RADIUS_M = 0.4;
// A sledge is a flat block 48px long and 12px tall (the runners and the
// seat); the rider is only drawn.
const SLEDGE_HALF_LENGTH_M = 0.6;
const SLEDGE_HALF_HEIGHT_M = 0.15;
// The line's friction is 0.6, and Planck mixes the two as the square root
// of their product, so this gives about 0.05: slippery, like snow.
const SLEDGE_FRICTION = 0.004;
// A sledge sliding backwards faster than this (m/s) turns its rider round.
const SLEDGE_TURN_SPEED = 0.5;
const MAX_BALLS = 200;
const MAX_BUBBLES = 100;

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

  // Pixels per second.
  get speed(): number {
    const v = this.body.getLinearVelocity();
    return Math.hypot(v.x, v.y) * PX_PER_M;
  }
}

// A sledge with a rider, in homage to Line Rider. It slides rather than
// rolls, but otherwise goes everywhere a ball does: it's kept with the
// balls, so boosts, portals, cups, the eraser and the guides treat it as one.
export class Sledge extends Ball {
  // Which way the rider faces along the sledge: 1 is towards its front
  // (+x when level), -1 when it's turned round to slide the other way.
  facing: 1 | -1 = 1;

  // After each physics step: turn the rider round if the sledge is sliding
  // backwards (like back down a hill it didn't make it up).
  updateFacing(): void {
    const v = this.body.getLinearVelocity();
    const angle = this.body.getAngle();
    const along = v.x * Math.cos(angle) + v.y * Math.sin(angle);
    if (along * this.facing < -SLEDGE_TURN_SPEED) this.facing *= -1;
  }
}

// Anything the camera can follow.
export type Thing = Ball | Bubble;

export function randomBallColor(): string {
  return BALL_COLORS[Math.floor(Math.random() * BALL_COLORS.length)];
}

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

// Everything in the world: the physics simulation, the design (lines, boost
// strips, portals, cups and cannons, and the terrain: rocks, spikes and
// no-drawing areas, each kept by its own part), and the balls and bubbles.
// Positions in and out are in pixels.
export class Playground {
  // y grows downwards, matching screen coordinates.
  readonly world = new World({ gravity: { x: 0, y: 10 } });
  // Sledges too: everything that rides the tracks.
  readonly balls: Ball[] = [];
  readonly bubbles: Bubble[] = [];
  private time = 0;
  private isPaused = false;
  // Whenever it's paused or carries on.
  readonly pausedChanged = new Signal();

  // Goes up by one whenever the design changes, so Undo can tell cheaply
  // whether anything did.
  revision = 0;
  // Whenever the design changes (for the autosave).
  readonly designChanged = new Signal();
  private changed = () => {
    this.revision++;
    this.designChanged.emit();
  };

  // The design's parts. To add a kind of thing, write a Part for it, add it
  // here and to `parts`, `Layout` (with its parser) and `drawDesign`.
  readonly lines = new Lines(this.world, this.changed);
  readonly boosts = new Boosts(this.changed);
  readonly portals = new Portals(this.changed);
  readonly cups = new Cups(this.world, this.changed);
  readonly cannons = new Cannons(() => this.time, this.changed);
  readonly rocks = new Rocks(this.world, this.changed);
  readonly spikes = new Spikes(this.world, this.changed);
  readonly noDraw = new NoDrawZones(this.changed);
  // From the top down, as they're drawn, so what's picked up is what's on
  // top.
  private readonly parts: Part<unknown>[] = [
    this.cannons,
    this.portals,
    this.cups,
    this.spikes,
    this.boosts,
    this.lines,
    this.rocks,
    this.noDraw,
  ];

  // Lets balls pass through the places where a line crosses itself.
  private crossings = new Crossings(this.world, (body) =>
    this.lines.pointsOf(body),
  );
  private bubbleBehaviour = new BubbleBehaviour(this.world, (body) =>
    this.lines.has(body),
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
  // Called whenever a ball (or sledge) pops on spikes, where it was.
  onSpiked: (ball: Ball, at: Point) => void = () => {};

  // Seconds of simulation so far.
  get now(): number {
    return this.time;
  }

  // While paused, nothing moves and cannons wait (their timers run on the
  // playground's time). The design can still be changed, and balls dropped
  // then wait where they're put.
  get paused(): boolean {
    return this.isPaused;
  }

  setPaused(paused: boolean): void {
    if (paused === this.isPaused) return;
    this.isPaused = paused;
    this.pausedChanged.emit();
  }

  step(dt: number): void {
    if (this.isPaused) return;
    this.time += dt;
    this.fireCannons();
    this.boosts.push(this.balls.map((ball) => ball.body));
    this.bubbleBehaviour.beforeStep(this.time);
    this.world.step(dt, 8, 3);
    for (const ball of this.balls) {
      if (ball instanceof Sledge) ball.updateFacing();
    }
    this.crossings.afterStep(this.time);
    for (const bubble of this.bubbleBehaviour.afterStep(this.time))
      this.popBubble(bubble);
    this.popOnSpikes();
    const things = [...this.balls, ...this.bubbles].map((thing) => thing.body);
    for (const teleport of this.portals.teleport(things)) {
      this.onTeleport(teleport);
    }
    this.catchBalls();
  }

  // --- The design ---

  // Rub out every part of the design inside a circle (splitting lines and
  // boost strips where the eraser cuts through), and any ball it touches.
  eraseAt(x: number, y: number, radius: number): void {
    for (const part of this.parts) part.eraseAt(x, y, radius);
    // Balls it touches go too (handy for one stuck on a track).
    for (const ball of [...this.balls]) {
      const { x: bx, y: by } = ball.position;
      if (Math.hypot(bx - x, by - y) < radius + ball.radius)
        this.removeBall(ball);
    }
  }

  // Pick up whatever's on top at a point to move it (a cannon, portal or
  // cup), if anything. A cannon holds its fire until it's put down.
  // Nothing can be moved into a no-drawing area: it waits outside.
  grabAt(x: number, y: number): Grabbed | null {
    for (const part of this.parts) {
      const grabbed = part.grabAt?.(x, y);
      if (!grabbed) continue;
      const { noDraw } = this;
      return {
        get x() {
          return grabbed.x;
        },
        get y() {
          return grabbed.y;
        },
        moveTo(x, y) {
          if (!noDraw.covers({ x, y })) grabbed.moveTo(x, y);
        },
        drop: () => grabbed.drop(),
      };
    }
    return null;
  }

  get hasDesign(): boolean {
    return this.parts.some((part) => !part.isEmpty);
  }

  // The area the design covers, or null if there's nothing.
  designBounds(): Box | null {
    let box: Box | null = null;
    const add = ({ x, y }: Point, reach: number) => {
      box ??= { left: x, top: y, right: x, bottom: y };
      box.left = Math.min(box.left, x - reach);
      box.top = Math.min(box.top, y - reach);
      box.right = Math.max(box.right, x + reach);
      box.bottom = Math.max(box.bottom, y + reach);
    };
    for (const part of this.parts) part.extent(add);
    return box;
  }

  // The design, as plain data to save: the player's things, not the fixed
  // ones (see part.ts).
  layout(): Layout {
    return {
      version: 1,
      lines: this.lines.save(),
      boosts: this.boosts.save(),
      portals: this.portals.save(),
      cups: this.cups.save(),
      cannons: this.cannons.save(),
      rocks: this.rocks.save(),
      spikes: this.spikes.save(),
      noDraw: this.noDraw.save(),
    };
  }

  // The fixed things: a level's own pieces.
  fixedLayout(): Layout {
    return {
      version: 1,
      lines: this.lines.save(true),
      boosts: this.boosts.save(true),
      portals: this.portals.save(true),
      cups: this.cups.save(true),
      cannons: this.cannons.save(true),
      rocks: this.rocks.save(true),
      spikes: this.spikes.save(true),
      noDraw: this.noDraw.save(true),
    };
  }

  // Replace the player's design with a saved one (and no balls or bubbles).
  // Fixed things stay.
  loadLayout(layout: Layout): void {
    this.clear();
    this.restoreLayout(layout);
  }

  // Put the player's design back to an earlier one (for Undo), leaving the
  // balls and bubbles where they are.
  restoreLayout(layout: Layout): void {
    this.lines.load(layout.lines);
    this.boosts.load(layout.boosts);
    this.portals.load(layout.portals);
    this.cups.load(layout.cups);
    this.cannons.load(layout.cannons);
    this.rocks.load(layout.rocks);
    this.spikes.load(layout.spikes);
    this.noDraw.load(layout.noDraw);
  }

  // Replace the fixed things (a level's pieces) with these. An empty layout
  // takes them all away.
  fix(layout: Layout): void {
    this.lines.load(layout.lines, true);
    this.boosts.load(layout.boosts, true);
    this.portals.load(layout.portals, true);
    this.cups.load(layout.cups, true);
    this.cannons.load(layout.cannons, true);
    this.rocks.load(layout.rocks, true);
    this.spikes.load(layout.spikes, true);
    this.noDraw.load(layout.noDraw, true);
  }

  // Fire every cannon whose next shot is due.
  private fireCannons(): void {
    for (const cannon of this.cannons.due()) {
      const { x, y } = muzzle(cannon);
      const ball = this.addBall(x, y);
      ball.body.setLinearVelocity(toMetres(launchVelocity(cannon)));
      this.onFire(cannon);
    }
  }

  // Balls and bubbles touching spikes pop.
  private popOnSpikes(): void {
    if (this.spikes.isEmpty) return;
    const touching = this.spikes.touching();
    if (touching.size === 0) return;
    for (const ball of [...this.balls]) {
      if (!touching.has(ball.body)) continue;
      const at = ball.position;
      this.removeBall(ball);
      this.onSpiked(ball, at);
    }
    for (const bubble of [...this.bubbles]) {
      if (touching.has(bubble.body)) this.popBubble(bubble);
    }
  }

  // Balls that have dropped into a cup are caught: removed and counted.
  private catchBalls(): void {
    if (this.cups.isEmpty) return;
    for (const ball of [...this.balls]) {
      const cup = this.cups.catching(ball.position);
      if (!cup) continue;
      this.removeBall(ball);
      cup.caught++;
      this.onCatch(cup);
    }
  }

  // --- Balls and bubbles ---

  // A ball, in a random colour unless it's given one.
  addBall(x: number, y: number, color = randomBallColor()): Ball {
    const body = this.createRiderBody(x, y);
    body.createFixture({
      shape: new CircleShape(BALL_RADIUS_M),
      density: 1,
      friction: 0.4,
      restitution: 0.3,
    });
    return this.keep(new Ball(body, BALL_RADIUS_M * PX_PER_M, color));
  }

  // A sledge, level and facing right, like Line Rider's.
  addSledge(x: number, y: number, color = randomBallColor()): Sledge {
    const body = this.createRiderBody(x, y);
    body.createFixture({
      shape: new BoxShape(SLEDGE_HALF_LENGTH_M, SLEDGE_HALF_HEIGHT_M),
      density: 1.4, // about as heavy as a ball
      friction: SLEDGE_FRICTION,
      restitution: 0.05, // lands with a thud, not a bounce
    });
    return this.keep(new Sledge(body, SLEDGE_HALF_LENGTH_M * PX_PER_M, color));
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
    const floor = Math.max(this.lines.bottom, minFloorPx) + margin;
    for (const ball of [...this.balls]) {
      if (ball.position.y > floor) this.removeBall(ball);
    }
    const ceiling = Math.min(this.lines.top, maxCeilingPx) - margin;
    for (const bubble of [...this.bubbles]) {
      if (bubble.position.y < ceiling) this.removeBubble(bubble);
    }
  }

  // Remove the player's design, and every ball and bubble. Fixed things
  // stay.
  clear(): void {
    for (const part of this.parts) part.clear();
    for (const ball of this.balls) this.world.destroyBody(ball.body);
    for (const bubble of this.bubbles) this.world.destroyBody(bubble.body);
    this.balls.length = 0;
    this.bubbles.length = 0;
    this.bubbleBehaviour.clear();
    this.crossings.clear();
  }

  // A body for a ball or sledge, which gets its shape added after.
  private createRiderBody(x: number, y: number): Body {
    return this.world.createBody({
      type: "dynamic",
      position: toMetres({ x, y }),
      bullet: true, // continuous collision, so fast balls can't skip through thin lines
    });
  }

  // Add a new ball or sledge, making room if there are too many.
  private keep<T extends Ball>(ball: T): T {
    this.balls.push(ball);
    if (this.balls.length > MAX_BALLS) this.removeBall(this.balls[0]);
    return ball;
  }

  removeBall(ball: Ball): void {
    if (!this.balls.includes(ball)) return;
    this.world.destroyBody(ball.body);
    this.balls.splice(this.balls.indexOf(ball), 1);
  }

  private removeBubble(bubble: Bubble): void {
    this.world.destroyBody(bubble.body);
    this.bubbleBehaviour.remove(bubble);
    this.bubbles.splice(this.bubbles.indexOf(bubble), 1);
  }
}
