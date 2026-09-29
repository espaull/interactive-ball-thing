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

describe("culling", () => {
  it("measures from the lines still there, not ones rubbed out", () => {
    const pg = new Playground();
    pg.world.setGravity({ x: 0, y: 0 });
    pg.addLine([
      { x: 0, y: 300 },
      { x: 400, y: 300 },
    ]);
    pg.addLine([
      { x: 0, y: 2000 },
      { x: 400, y: 2000 },
    ]);
    // A ball well below the top line, but above the bottom one.
    const ball = pg.addBall(200, 1500);
    pg.cull(0, 0);
    expect(pg.balls).toContain(ball);
    // With the bottom line gone, nothing is below the ball to land on.
    pg.eraseAt(200, 2000, 400);
    pg.cull(0, 0);
    expect(pg.balls).not.toContain(ball);
  });

  it("measures bubbles from the highest line still there", () => {
    const pg = new Playground();
    pg.world.setGravity({ x: 0, y: 0 });
    pg.addLine([
      { x: 0, y: -2000 },
      { x: 400, y: -2000 },
    ]);
    pg.addLine([
      { x: 0, y: 300 },
      { x: 400, y: 300 },
    ]);
    const bubble = pg.addBubble(200, -1500);
    pg.cull(0, 0);
    expect(pg.bubbles).toContain(bubble);
    pg.removeLine(pg.lines[0]);
    pg.cull(0, 0);
    expect(pg.bubbles).not.toContain(bubble);
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

describe("boost strips", () => {
  const speed = (pg: Playground) => {
    const v = pg.balls[0].body.getLinearVelocity();
    return Math.hypot(v.x, v.y);
  };

  it("push a resting ball along the way they were painted", () => {
    const pg = new Playground();
    pg.addLine([
      { x: 0, y: 400 },
      { x: 2000, y: 400 },
    ]);
    pg.addBoost([
      { x: 100, y: 390 },
      { x: 600, y: 390 },
    ]);
    const ball = pg.addBall(150, 380);
    run(pg, 1);
    expect(ball.body.getLinearVelocity().x).toBeGreaterThan(5);
  });

  it("can lift a ball straight up against gravity", () => {
    const pg = new Playground();
    // Painted bottom to top.
    pg.addBoost([
      { x: 400, y: 600 },
      { x: 400, y: 100 },
    ]);
    const ball = pg.addBall(400, 580);
    run(pg, 0.5);
    expect(ball.position.y).toBeLessThan(560);
  });

  it("stop pushing at top speed", () => {
    const pg = new Playground();
    pg.addLine([
      { x: 0, y: 400 },
      { x: 40000, y: 400 },
    ]);
    pg.addBoost([
      { x: 0, y: 390 },
      { x: 40000, y: 390 },
    ]);
    pg.addBall(100, 380);
    run(pg, 5);
    expect(speed(pg)).toBeGreaterThan(18);
    expect(speed(pg)).toBeLessThan(21);
  });

  it("slow a ball down when painted against it", () => {
    const pg = new Playground();
    pg.addLine([
      { x: 0, y: 400 },
      { x: 4000, y: 400 },
    ]);
    // Pointing left, while the ball heads right.
    pg.addBoost([
      { x: 900, y: 390 },
      { x: 300, y: 390 },
    ]);
    const ball = pg.addBall(100, 384);
    ball.body.setLinearVelocity({ x: 10, y: 0 });
    run(pg, 0.8);
    expect(ball.body.getLinearVelocity().x).toBeLessThan(6);
  });

  it("are rubbed out by the eraser, keeping their direction", () => {
    const pg = new Playground();
    pg.addBoost([
      { x: 0, y: 100 },
      { x: 300, y: 100 },
    ]);
    pg.eraseAt(150, 100, 20);
    expect(pg.boosts).toHaveLength(2);
    for (const boost of pg.boosts) {
      expect(boost.points.at(-1)!.x).toBeGreaterThan(boost.points[0].x);
    }
  });

  // What they're for: getting a ball round a loop-the-loop.
  describe("on a loop-the-loop", () => {
    // A flat run-up into a loop of radius 120px (3m). With y pointing down,
    // the ball goes up the right side, over the top, and down the left. In
    // 2D a closed loop would cross its own run-up (the ball crashes into the
    // back of it), so the loop stops at the left side, above the run-up:
    // the ball flies off there and drops back onto the run-up.
    const centre = { x: 600, y: 480 };
    const R = 120;
    function loopTrack(pg: Playground): void {
      const points = [{ x: 0, y: 600 }];
      for (let deg = 0; deg <= 270; deg += 3) {
        const a = (deg * Math.PI) / 180;
        points.push({
          x: centre.x + R * Math.sin(a),
          y: centre.y + R * Math.cos(a),
        });
      }
      pg.addLine(points);
    }
    // Did the ball make it over the top and into the upper-left of the loop?
    function wentOverTheTop(pg: Playground, seconds: number): boolean {
      let over = false;
      run(pg, seconds, () => {
        const p = pg.balls[0]?.position;
        if (p && p.x < centre.x - R * 0.4 && p.y < centre.y) over = true;
      });
      return over;
    }

    it("a boosted ball goes all the way round", () => {
      const pg = new Playground();
      loopTrack(pg);
      pg.addBoost([
        { x: 50, y: 590 },
        { x: 580, y: 590 },
      ]);
      pg.addBall(80, 584);
      expect(wentOverTheTop(pg, 4)).toBe(true);
    });

    it("an unboosted ball, even with a push, doesn't", () => {
      const pg = new Playground();
      loopTrack(pg);
      const ball = pg.addBall(80, 584);
      ball.body.setLinearVelocity({ x: 8, y: 0 });
      expect(wentOverTheTop(pg, 4)).toBe(false);
    });
  });
});

describe("erasing balls", () => {
  it("removes a ball the eraser touches, and only that one", () => {
    const pg = new Playground();
    const stuck = pg.addBall(200, 200);
    const other = pg.addBall(400, 200);
    // The eraser's edge overlaps the first ball's edge.
    pg.eraseAt(200 + stuck.radius + 10, 200, 18);
    expect(pg.contains(stuck)).toBe(false);
    expect(pg.contains(other)).toBe(true);
    expect(pg.world.getBodyCount()).toBe(1);
  });
});
