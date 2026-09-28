import { describe, expect, it } from "vitest";
import { Playground } from "./playground";

const STEP = 1 / 60;

function run(
  playground: Playground,
  seconds: number,
  eachStep?: () => void,
): void {
  for (let t = 0; t < seconds; t += STEP) {
    eachStep?.();
    playground.step(STEP);
  }
}

function staticBodyCount(playground: Playground): number {
  let count = 0;
  for (let b = playground.world.getBodyList(); b; b = b.getNext())
    if (b.isStatic()) count++;
  return count;
}

describe("lines", () => {
  it("erasing through the middle splits a line into two", () => {
    const pg = new Playground();
    pg.addLine([
      { x: 0, y: 100 },
      { x: 300, y: 100 },
    ]);
    pg.eraseAt(150, 100, 20);
    expect(pg.lines).toHaveLength(2);
    // The old physics body is gone; one body per piece.
    expect(staticBodyCount(pg)).toBe(2);
  });

  it("replacing a line's shape keeps one physics body", () => {
    const pg = new Playground();
    pg.addLine([
      { x: 0, y: 100 },
      { x: 300, y: 100 },
    ]);
    pg.replaceLine(pg.lines[0], [
      { x: 0, y: 100 },
      { x: 300, y: 150 },
    ]);
    expect(pg.lines).toHaveLength(1);
    expect(staticBodyCount(pg)).toBe(1);
  });

  it("finds the nearest line end, skipping an excluded line", () => {
    const pg = new Playground();
    pg.addLine([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    pg.addLine([
      { x: 110, y: 0 },
      { x: 200, y: 0 },
    ]);
    const [first, second] = pg.lines;
    expect(pg.lineEndAt(104, 0, 20)?.line).toBe(first);
    expect(pg.lineEndAt(104, 0, 20, first)?.line).toBe(second);
    expect(pg.lineEndAt(150, 50, 20)).toBeNull();
  });
});

describe("balls", () => {
  it("fall and land on a line", () => {
    const pg = new Playground();
    pg.addLine([
      { x: 0, y: 400 },
      { x: 800, y: 400 },
    ]);
    const ball = pg.addBall(400, 100);
    run(pg, 3);
    const bottom = ball.position.y + ball.radius;
    expect(bottom).toBeCloseTo(400, 0);
  });
});

describe("bubbles", () => {
  it("float upwards", () => {
    const pg = new Playground();
    const bubble = pg.addBubble(400, 400);
    run(pg, 2);
    expect(bubble.position.y).toBeLessThan(350);
  });

  it("pop on their third bump", () => {
    const pg = new Playground();
    let pops = 0;
    pg.onPop = () => pops++;
    pg.addLine([
      { x: 0, y: 200 },
      { x: 800, y: 200 },
    ]);
    const bubble = pg.addBubble(400, 280);
    const hitsSeen: number[] = [];
    run(pg, 20, () => {
      if (pops === 0 && hitsSeen.at(-1) !== bubble.hits)
        hitsSeen.push(bubble.hits);
    });
    expect(hitsSeen).toEqual([0, 1, 2]);
    expect(pops).toBe(1);
    expect(pg.bubbles).toHaveLength(0);
  });

  it("clicking pops straight away", () => {
    const pg = new Playground();
    const popped: number[] = [];
    pg.onPop = (_x, _y, radius) => popped.push(radius);
    const bubble = pg.addBubble(400, 400);
    pg.popBubble(bubble);
    expect(popped).toEqual([bubble.radius]);
    expect(pg.contains(bubble)).toBe(false);
  });

  // Regression: a line is many short segments, and sliding from one to the
  // next used to count as a fresh bump each time.
  it("count sliding along a line as one bump", () => {
    const pg = new Playground();
    // A steep overhang (70°) as 100 short segments.
    const a = { x: 100, y: 600 };
    const c = { x: 350, y: 600 - 250 * Math.tan((70 * Math.PI) / 180) };
    const points = Array.from({ length: 101 }, (_, i) => ({
      x: a.x + ((c.x - a.x) * i) / 100,
      y: a.y + ((c.y - a.y) * i) / 100,
    }));
    pg.addLine(points);
    const bubble = pg.addBubble(a.x + 40, a.y - 30);
    // No bouncing, and a steady push into the slope, so it slides.
    bubble.body.getFixtureList()!.setRestitution(0);
    const len = Math.hypot(c.x - a.x, c.y - a.y);
    const towardsSlope = { x: (c.y - a.y) / len, y: -(c.x - a.x) / len };

    const start = bubble.position;
    run(pg, 4, () => {
      const push = bubble.body.getMass() * 10 * 0.6;
      bubble.body.applyForceToCenter(
        { x: towardsSlope.x * push, y: towardsSlope.y * push },
        true,
      );
    });
    const slidPx = start.y - bubble.position.y;

    // Slid past many segments (each about 7px long)...
    expect(slidPx).toBeGreaterThan(100);
    // ...but it was all one bump.
    expect(bubble.hits).toBe(1);
  });

  it("each count a bump when two collide", () => {
    const pg = new Playground();
    // Close enough that air drag can't stop them before they meet, whatever
    // size they come out.
    const left = pg.addBubble(300, 400);
    const right = pg.addBubble(500, 400);
    left.body.setLinearVelocity({ x: 4, y: 0 });
    right.body.setLinearVelocity({ x: -4, y: 0 });
    run(pg, 1.5);
    expect([left.hits, right.hits]).toEqual([1, 1]);
  });
});
