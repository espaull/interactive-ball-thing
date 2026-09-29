import type { Body, Contact, World } from "planck";
import type { Point } from "../geometry/point";
import { PX_PER_M, toPixels } from "./units";

// Where a line crosses itself, a ball keeps following the part of the line
// it's already rolling on, and passes straight through the other part. This
// is what makes loop-the-loops work in 2D: a loop has to cross its own track
// (on the way in, and again on the way out), and without this the ball would
// crash into the crossing.
//
// Only a line's crossings with itself count. Separate lines still block
// each other, so a wall drawn across a track keeps working. (Joined lines are
// one line, so a loop drawn in several joined strokes works too.)
// Segments this close along a line (about 50px) count as the same stretch
// of track rather than another strand crossing it.
const SAME_STRETCH_SEGMENTS = 8;
// A ball that has just hopped off its track (a bump or corner at speed)
// still counts as following it for this long (seconds).
const RIDE_MEMORY = 0.3;

// The stretch of track a ball was last rolling on.
interface Ride {
  line: Body;
  segment: number;
  time: number;
}

export class Crossings {
  // Contacts being ignored until they end. Planck reuses contact objects, so
  // entries must be removed as soon as their contact ends (see onEndContact).
  private ignored = new Set<Contact>();
  // Where each ball was last rolling, so a ball that's briefly airborne as it
  // reaches a crossing still passes through.
  private lastRide = new WeakMap<Body, Ride>();
  private time = 0;

  constructor(
    private world: World,
    // A line's points (in pixels), or undefined if the body isn't a line.
    private linePoints: (body: Body) => Point[] | undefined,
  ) {
    world.on("pre-solve", this.onPreSolve);
    world.on("end-contact", this.onEndContact);
  }

  clear(): void {
    this.ignored.clear();
  }

  // After each physics step: remember where each ball is rolling.
  afterStep(time: number): void {
    this.time = time;
    for (let c = this.world.getContactList(); c; c = c.getNext()) {
      if (!c.isTouching() || !c.isEnabled() || this.ignored.has(c)) continue;
      const hit = this.lineContact(c);
      if (hit) {
        this.lastRide.set(hit.other, {
          line: hit.line,
          segment: hit.segment,
          time,
        });
      }
    }
  }

  // Called for each touching contact, just before the solver uses it.
  private onPreSolve = (contact: Contact) => {
    if (this.ignored.has(contact)) {
      // Disabling only lasts one step, so it's repeated until the contact ends.
      contact.setEnabled(false);
      return;
    }
    const hit = this.lineContact(contact);
    if (!hit) return;
    const { line, points, segment, other } = hit;

    // Only near a place where this line crosses itself.
    const crossings = selfCrossings(points);
    if (!crossings.some((crossing) => isNear(other, crossing))) return;

    // Is the ball already rolling on a different stretch of the same line?
    // (The ball is wide enough to touch a few neighbouring segments, and
    // meets the other strand a little before the exact crossing point, so
    // "different stretch" means well along the line from this segment.)
    for (let edge = other.getContactList(); edge; edge = edge.next) {
      const riding = edge.contact;
      if (riding === contact || edge.other !== line) continue;
      if (!riding.isTouching() || this.ignored.has(riding)) continue;
      const ridingSegment = this.lineContact(riding)?.segment;
      if (ridingSegment === undefined) continue;
      if (Math.abs(ridingSegment - segment) > SAME_STRETCH_SEGMENTS) {
        this.ignore(contact);
        return;
      }
    }

    // Not touching its track right now, but it was a moment ago: at speed a
    // ball can hop off at a bump or corner just before a crossing.
    const ride = this.lastRide.get(other);
    if (
      ride &&
      ride.line === line &&
      this.time - ride.time < RIDE_MEMORY &&
      Math.abs(ride.segment - segment) > SAME_STRETCH_SEGMENTS
    ) {
      this.ignore(contact);
    }
  };

  private ignore(contact: Contact): void {
    this.ignored.add(contact);
    contact.setEnabled(false);
  }

  private onEndContact = (contact: Contact) => {
    this.ignored.delete(contact);
  };

  // For a contact between a line and something else: the line, its points,
  // which of its segments is touched, and the other body.
  private lineContact(contact: Contact) {
    const bodyA = contact.getFixtureA().getBody();
    const bodyB = contact.getFixtureB().getBody();
    const pointsA = this.linePoints(bodyA);
    const pointsB = this.linePoints(bodyB);
    if (pointsA && !pointsB) {
      return {
        line: bodyA,
        points: pointsA,
        segment: contact.getChildIndexA(),
        other: bodyB,
      };
    }
    if (pointsB && !pointsA) {
      return {
        line: bodyB,
        points: pointsB,
        segment: contact.getChildIndexB(),
        other: bodyA,
      };
    }
    return null;
  }
}

// Every place a line crosses itself. Cached per points array: a line's
// points are replaced (not changed in place) whenever its shape changes.
const crossingCache = new WeakMap<Point[], Point[]>();

export function selfCrossings(points: Point[]): Point[] {
  let crossings = crossingCache.get(points);
  if (!crossings) {
    crossings = [];
    for (let i = 0; i < points.length - 1; i++) {
      for (let j = i + 2; j < points.length - 1; j++) {
        const crossing = segmentsCross(
          points[i],
          points[i + 1],
          points[j],
          points[j + 1],
        );
        if (crossing) crossings.push(crossing);
      }
    }
    crossingCache.set(points, crossings);
  }
  return crossings;
}

// Where segments a–b and c–d cross, or null if they don't. Touching only at
// an end doesn't count.
export function segmentsCross(
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): Point | null {
  const rx = b.x - a.x;
  const ry = b.y - a.y;
  const sx = d.x - c.x;
  const sy = d.y - c.y;
  const denominator = rx * sy - ry * sx;
  if (denominator === 0) return null; // parallel
  const t = ((c.x - a.x) * sy - (c.y - a.y) * sx) / denominator;
  const u = ((c.x - a.x) * ry - (c.y - a.y) * rx) / denominator;
  const inside = (v: number) => v > 1e-6 && v < 1 - 1e-6;
  return inside(t) && inside(u) ? { x: a.x + rx * t, y: a.y + ry * t } : null;
}

// Is the crossing within reach of the body (a ball or bubble)?
function isNear(body: Body, crossing: Point): boolean {
  const radius = body.getFixtureList()!.getShape().getRadius() * PX_PER_M;
  const { x, y } = toPixels(body.getPosition());
  return Math.hypot(x - crossing.x, y - crossing.y) < radius * 3;
}
