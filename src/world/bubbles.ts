import { CircleShape, type Body, type Contact, type World } from "planck";
import type { Point } from "../simplify";
import { PX_PER_M, toMetres, toPixels } from "./units";

const MIN_RADIUS_M = 0.35;
const MAX_RADIUS_M = 0.65;
// Negative gravity makes bubbles rise; -0.15 of normal gravity is a gentle float.
const GRAVITY_SCALE = -0.15;
// Air drag, so bubbles drift rather than accelerate forever.
const DAMPING = 0.4;
// Sideways wobble force, as a fraction of the bubble's weight.
const WOBBLE = 0.08;
// Bumps a bubble survives before popping, and the minimum time between two
// bumps counting separately (seconds).
const HITS_TO_POP = 3;
const HIT_COOLDOWN = 0.25;
// Something the bubble stopped touching less than this long ago (seconds)
// doesn't count as a new bump when it touches again. Covers sliding from one
// segment of a line to the next, and tiny lift-offs while scraping along.
const TOUCH_GRACE = 0.15;
// Minimum downward speed after bumping into a line above (m/s). Bubbles only
// drift up slowly, so a normal bounce off a ceiling would barely register.
const CEILING_BOUNCE_SPEED = 2.5;

export class Bubble {
  // Random offset so bubbles wobble and shimmer out of step with each other.
  readonly phase = Math.random() * Math.PI * 2;
  // Bumps so far; the bubble pops when this reaches HITS_TO_POP.
  hits = 0;
  // Playground time of the last counted bump (drives the wobble drawing too).
  lastHitAt = -Infinity;
  // How many contacts the bubble has with each body it's touching (a line is
  // many segments, so it can have several with one line).
  readonly touching = new Map<Body, number>();
  // When the bubble was last seen touching each body, checked after each step.
  readonly lastTouched = new Map<Body, number>();

  constructor(
    readonly body: Body,
    readonly radius: number, // pixels
  ) {}

  // Centre, in pixels.
  get position(): Point {
    return toPixels(this.body.getPosition());
  }
}

export function createBubble(world: World, x: number, y: number): Bubble {
  const radiusM = MIN_RADIUS_M + Math.random() * (MAX_RADIUS_M - MIN_RADIUS_M);
  const body = world.createBody({
    type: "dynamic",
    position: toMetres({ x, y }),
    gravityScale: GRAVITY_SCALE,
    linearDamping: DAMPING,
    angularDamping: 1,
  });
  body.createFixture({
    shape: new CircleShape(radiusM),
    density: 0.05, // light, so balls shove bubbles aside
    friction: 0.05,
    restitution: 0.9,
  });
  return new Bubble(body, radiusM * PX_PER_M);
}

// How bubbles behave beyond plain physics: the floaty wobble, counting bumps
// (so they pop on the third), and bouncing firmly off ceilings.
export class BubbleBehaviour {
  private byBody = new Map<Body, Bubble>();
  // Bubbles that bumped a line above them during this step.
  private ceilingHits = new Set<Bubble>();

  constructor(
    world: World,
    // Tells lines apart from everything else, for the ceiling bounce.
    private isLine: (body: Body) => boolean,
  ) {
    world.on("begin-contact", this.onBeginContact);
    world.on("end-contact", this.onEndContact);
  }

  add(bubble: Bubble): void {
    this.byBody.set(bubble.body, bubble);
  }

  remove(bubble: Bubble): void {
    this.byBody.delete(bubble.body);
    this.ceilingHits.delete(bubble);
  }

  clear(): void {
    this.byBody.clear();
    this.ceilingHits.clear();
  }

  // Before each physics step: the gentle side-to-side sway.
  beforeStep(time: number): void {
    for (const bubble of this.byBody.values()) {
      const weight = bubble.body.getMass() * 10;
      const push = Math.sin(time * 1.7 + bubble.phase) * weight * WOBBLE;
      bubble.body.applyForceToCenter({ x: push, y: 0 }, true);
    }
  }

  // After each physics step: count bumps and bounce bubbles off ceilings.
  // Returns the bubbles that took their last bump, to be popped. (Bodies
  // can't be removed mid-step, and velocities set mid-step get overwritten
  // by the solver, which is why this all happens afterwards.)
  afterStep(time: number): Bubble[] {
    const worn: Bubble[] = [];
    for (const bubble of this.byBody.values()) {
      if (this.countBumps(bubble, time)) worn.push(bubble);
    }
    for (const bubble of this.ceilingHits) {
      if (worn.includes(bubble)) continue;
      const v = bubble.body.getLinearVelocity();
      bubble.body.setLinearVelocity({ x: v.x, y: Math.max(v.y, CEILING_BOUNCE_SPEED) });
    }
    this.ceilingHits.clear();
    return worn;
  }

  // Checked after each step rather than on each contact event: contacts
  // with neighbouring segments of a line can end and begin in either order
  // within one step, which would look like a fresh bump. A bump counts when
  // the bubble touches something it hasn't touched recently, and not within
  // a moment of its last bump. Returns true when that was its last bump.
  private countBumps(bubble: Bubble, time: number): boolean {
    let bumped = false;
    for (const body of bubble.touching.keys()) {
      const seen = bubble.lastTouched.get(body);
      if (seen === undefined || time - seen > TOUCH_GRACE) bumped = true;
      bubble.lastTouched.set(body, time);
    }
    for (const [body, seen] of bubble.lastTouched) {
      if (time - seen > TOUCH_GRACE) bubble.lastTouched.delete(body);
    }
    if (!bumped || time - bubble.lastHitAt < HIT_COOLDOWN) return false;
    bubble.hits++;
    bubble.lastHitAt = time;
    return bubble.hits >= HITS_TO_POP;
  }

  private onBeginContact = (contact: Contact) => {
    const bodyA = contact.getFixtureA().getBody();
    const bodyB = contact.getFixtureB().getBody();
    // Both sides count when two bubbles bump.
    for (const [self, other] of [
      [bodyA, bodyB],
      [bodyB, bodyA],
    ]) {
      const touching = this.byBody.get(self)?.touching;
      if (touching) touching.set(other, (touching.get(other) ?? 0) + 1);
    }

    const bubble = this.byBody.get(bodyA) ?? this.byBody.get(bodyB);
    const other = this.byBody.has(bodyA) ? bodyB : bodyA;
    if (!bubble || !this.isLine(other)) return;

    const manifold = contact.getWorldManifold(null);
    if (!manifold || manifold.pointCount === 0) return;
    // The normal points from A to B; flip it so it points from bubble to line.
    const towardsLineY = bubble.body === bodyA ? manifold.normal.y : -manifold.normal.y;
    // y grows downwards, so a negative y means the line is above the bubble.
    if (towardsLineY < -0.5) this.ceilingHits.add(bubble);
  };

  private onEndContact = (contact: Contact) => {
    const bodyA = contact.getFixtureA().getBody();
    const bodyB = contact.getFixtureB().getBody();
    for (const [self, other] of [
      [bodyA, bodyB],
      [bodyB, bodyA],
    ]) {
      const touching = this.byBody.get(self)?.touching;
      if (!touching) continue;
      const count = (touching.get(other) ?? 1) - 1;
      if (count > 0) touching.set(other, count);
      else touching.delete(other);
    }
  };
}
