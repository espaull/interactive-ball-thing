import { describe, expect, it } from "vitest";
import { Playground } from "./playground";

const STEP = 1 / 60;

function run(pg: Playground, seconds: number): void {
  for (let t = 0; t < seconds; t += STEP) pg.step(STEP);
}

describe("goal cups", () => {
  it("catch a ball dropped in: it's removed and counted", () => {
    const pg = new Playground();
    const cup = pg.cups.add(400, 400);
    const caught: number[] = [];
    pg.onCatch = (c) => caught.push(c.caught);
    const ball = pg.addBall(400, 200);
    run(pg, 2);
    expect(pg.contains(ball)).toBe(false);
    expect(cup.caught).toBe(1);
    expect(caught).toEqual([1]);
  });

  it("keep count across several balls", () => {
    const pg = new Playground();
    const cup = pg.cups.add(400, 400);
    for (let i = 0; i < 3; i++) {
      pg.addBall(400, 100);
      run(pg, 2);
    }
    expect(cup.caught).toBe(3);
    expect(pg.balls).toHaveLength(0);
  });

  it("don't catch a ball that misses", () => {
    const pg = new Playground();
    const cup = pg.cups.add(400, 400);
    const ball = pg.addBall(600, 200);
    run(pg, 1);
    expect(pg.contains(ball)).toBe(true);
    expect(cup.caught).toBe(0);
  });

  it("have solid walls: a ball rolling into the side is stopped", () => {
    const pg = new Playground();
    pg.lines.add([
      { x: 0, y: 430 },
      { x: 1000, y: 430 },
    ]);
    // The cup sits on the floor; the ball rolls at its left wall.
    pg.cups.add(500, 405);
    const ball = pg.addBall(100, 414);
    ball.body.setLinearVelocity({ x: 6, y: 0 });
    run(pg, 2);
    expect(pg.contains(ball)).toBe(true);
    expect(ball.position.x).toBeLessThan(470);
  });

  it("are removed by the eraser and by Clear", () => {
    const pg = new Playground();
    pg.cups.add(200, 200);
    pg.cups.add(600, 200);
    pg.eraseAt(200, 200, 18);
    expect(pg.cups.all.map((c) => c.x)).toEqual([600]);
    pg.clear();
    expect(pg.cups.all).toHaveLength(0);
    expect(pg.world.getBodyCount()).toBe(0);
  });
});
