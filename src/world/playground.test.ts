import { describe, expect, it } from "vitest";
import { Playground, Sledge } from "./playground";

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

function line(y: number) {
  return [
    { x: 0, y },
    { x: 400, y },
  ];
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
    pg.lines.add([
      { x: 0, y: 100 },
      { x: 300, y: 100 },
    ]);
    pg.eraseAt(150, 100, 20);
    expect(pg.lines.all).toHaveLength(2);
    // The old physics body is gone; one body per piece.
    expect(staticBodyCount(pg)).toBe(2);
  });

  it("replacing a line's shape keeps one physics body", () => {
    const pg = new Playground();
    pg.lines.add([
      { x: 0, y: 100 },
      { x: 300, y: 100 },
    ]);
    pg.lines.replace(pg.lines.all[0], [
      { x: 0, y: 100 },
      { x: 300, y: 150 },
    ]);
    expect(pg.lines.all).toHaveLength(1);
    expect(staticBodyCount(pg)).toBe(1);
  });

  it("finds the nearest line end, skipping an excluded line", () => {
    const pg = new Playground();
    pg.lines.add([
      { x: 0, y: 0 },
      { x: 100, y: 0 },
    ]);
    pg.lines.add([
      { x: 110, y: 0 },
      { x: 200, y: 0 },
    ]);
    const [first, second] = pg.lines.all;
    expect(pg.lines.endAt(104, 0, 20)?.line).toBe(first);
    expect(pg.lines.endAt(104, 0, 20, first)?.line).toBe(second);
    expect(pg.lines.endAt(150, 50, 20)).toBeNull();
  });
});

describe("balls", () => {
  it("fall and land on a line", () => {
    const pg = new Playground();
    pg.lines.add([
      { x: 0, y: 400 },
      { x: 800, y: 400 },
    ]);
    const ball = pg.addBall(400, 100);
    run(pg, 3);
    const bottom = ball.position.y + ball.radius;
    expect(bottom).toBeCloseTo(400, 0);
  });
});

describe("sledges", () => {
  // A 30° slope down to a long flat.
  function hill(pg: Playground): void {
    pg.lines.add([
      { x: 0, y: 0 },
      { x: 600, y: 346 },
      { x: 5000, y: 346 },
    ]);
  }

  it("slide down a slope without rolling, faster than a ball", () => {
    // Side by side, each on its own hill.
    const pg = new Playground();
    hill(pg);
    const sledge = pg.addSledge(40, 0);
    run(pg, 1.5);
    const other = new Playground();
    hill(other);
    const ball = other.addBall(40, 0);
    run(other, 1.5);
    // Lying along the slope, not turning over and over like the ball.
    expect(sledge.angle).toBeCloseTo(Math.PI / 6, 1);
    expect(sledge.position.x).toBeGreaterThan(ball.position.x + 20);
  });

  it("slow down on the flat, where a ball would roll on for ever", () => {
    const pg = new Playground();
    hill(pg);
    const sledge = pg.addSledge(40, 0);
    run(pg, 4);
    const speed = sledge.speed;
    run(pg, 2);
    expect(sledge.speed).toBeLessThan(speed * 0.95);
    expect(sledge.speed).toBeGreaterThan(speed * 0.5);
  });

  it("turn their rider round when sliding back the other way", () => {
    const pg = new Playground();
    // A valley: the sledge slides down one side, up the other, and back.
    const valley = [];
    for (let x = 0; x <= 800; x += 8) {
      valley.push({ x, y: 550 - ((x - 400) / 400) ** 2 * 250 });
    }
    pg.lines.add(valley);
    const sledge = pg.addSledge(100, 250);
    expect(sledge.facing).toBe(1);
    let turned = false;
    run(pg, 5, () => {
      if (sledge.facing === -1) turned = true;
    });
    expect(turned).toBe(true);
  });

  it("are kept with the balls, so everything that works on balls works on them", () => {
    const pg = new Playground();
    const sledge = pg.addSledge(100, 100);
    expect(sledge).toBeInstanceOf(Sledge);
    expect(pg.balls).toEqual([sledge]);
    expect(pg.thingAt(120, 100)).toBe(sledge);
    pg.eraseAt(100, 120, 10);
    expect(pg.contains(sledge)).toBe(false);
  });
});

describe("pausing", () => {
  it("stops everything moving, and carries on where it left off", () => {
    const pg = new Playground();
    let changes = 0;
    pg.pausedChanged.listen(() => changes++);
    const ball = pg.addBall(100, 100);
    ball.body.setLinearVelocity({ x: 3, y: 0 });
    run(pg, 0.5);
    pg.setPaused(true);
    pg.setPaused(true); // already paused: not a change
    const at = ball.position;
    const bubble = pg.addBubble(300, 300); // dropped while paused, it waits
    run(pg, 2);
    expect(ball.position).toEqual(at);
    expect(bubble.position).toEqual({ x: 300, y: 300 });

    pg.setPaused(false);
    run(pg, 0.5);
    expect(ball.position.x).toBeGreaterThan(at.x);
    expect(bubble.position.y).toBeLessThan(300);
    expect(changes).toBe(2);
  });

  it("holds cannons' fire, as their timers run on the playground's time", () => {
    const pg = new Playground();
    let shots = 0;
    pg.onFire = () => shots++;
    pg.cannons.add(400, 400, 0, 0.5); // first shot due at 0.5s
    pg.setPaused(true);
    run(pg, 5);
    expect(shots).toBe(0);
    pg.setPaused(false);
    run(pg, 0.6);
    expect(shots).toBe(1);
  });
});

describe("the design's revision", () => {
  it("goes up with every change to the design, and not otherwise", () => {
    const pg = new Playground();
    let changes = 0;
    pg.designChanged.listen(() => changes++);
    const changed = (change: () => void) => {
      const before = pg.revision;
      change();
      return pg.revision > before;
    };
    expect(changed(() => pg.lines.add(line(300)))).toBe(true);
    expect(changed(() => pg.boosts.add(line(290)))).toBe(true);
    const pair = pg.portals.add({ x: 0, y: 0 }, { x: 500, y: 0 }, "purple");
    expect(changed(() => pg.portals.aim(pair.a, 1))).toBe(true);
    const cannon = pg.cannons.add(100, 100, 0, 0.5);
    expect(changed(() => pg.cannons.aim(cannon, 1, 1))).toBe(true);
    expect(changed(() => pg.cannons.setActive(cannon, false))).toBe(true);
    pg.cups.add(700, 700);
    expect(changed(() => pg.grabAt(700, 700)!.moveTo(800, 700))).toBe(true);
    expect(changed(() => pg.eraseAt(800, 700, 10))).toBe(true);
    expect(changed(() => pg.clear())).toBe(true);
    expect(changes).toBeGreaterThan(0);

    // Balls, bubbles and holding a cannon's fire aren't the design.
    const held = pg.cannons.add(100, 100, 0, 0.5);
    expect(
      changed(() => {
        pg.addBall(10, 10);
        pg.addBubble(20, 20);
        pg.cannons.hold(held);
        pg.cannons.release(held, 0.3);
        pg.step(1 / 60);
      }),
    ).toBe(false);
  });
});

describe("culling", () => {
  it("measures from the lines still there, not ones rubbed out", () => {
    const pg = new Playground();
    pg.world.setGravity({ x: 0, y: 0 });
    pg.lines.add([
      { x: 0, y: 300 },
      { x: 400, y: 300 },
    ]);
    pg.lines.add([
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
    pg.lines.add([
      { x: 0, y: -2000 },
      { x: 400, y: -2000 },
    ]);
    pg.lines.add([
      { x: 0, y: 300 },
      { x: 400, y: 300 },
    ]);
    const bubble = pg.addBubble(200, -1500);
    pg.cull(0, 0);
    expect(pg.bubbles).toContain(bubble);
    pg.lines.remove(pg.lines.all[0]);
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
    pg.lines.add([
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
    pg.lines.add(points);
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
    pg.lines.add([
      { x: 0, y: 400 },
      { x: 2000, y: 400 },
    ]);
    pg.boosts.add([
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
    pg.boosts.add([
      { x: 400, y: 600 },
      { x: 400, y: 100 },
    ]);
    const ball = pg.addBall(400, 580);
    run(pg, 0.5);
    expect(ball.position.y).toBeLessThan(560);
  });

  it("stop pushing at top speed", () => {
    const pg = new Playground();
    pg.lines.add([
      { x: 0, y: 400 },
      { x: 40000, y: 400 },
    ]);
    pg.boosts.add([
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
    pg.lines.add([
      { x: 0, y: 400 },
      { x: 4000, y: 400 },
    ]);
    // Pointing left, while the ball heads right.
    pg.boosts.add([
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
    pg.boosts.add([
      { x: 0, y: 100 },
      { x: 300, y: 100 },
    ]);
    pg.eraseAt(150, 100, 20);
    expect(pg.boosts.all).toHaveLength(2);
    for (const boost of pg.boosts.all) {
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
      pg.lines.add(points);
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
      pg.boosts.add([
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
