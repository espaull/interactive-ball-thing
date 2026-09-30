import { describe, expect, it } from "vitest";
import type { Point } from "../geometry/point";
import { Playground } from "./playground";
import { predictPath } from "./prediction";

const STEP = 1 / 60;

// Where the ball really goes, step by step, in the same stretches.
function realPath(pg: Playground, seconds: number): Point[][] {
  const ball = pg.balls[0];
  const path: Point[][] = [[ball.position]];
  pg.onTeleport = () => path.push([]);
  for (let t = 0; t < seconds; t += STEP) {
    pg.step(STEP);
    if (!pg.contains(ball)) break;
    path.at(-1)!.push(ball.position);
  }
  return path.filter((stretch) => stretch.length > 0);
}

function worstGap(a: Point[][], b: Point[][]): number {
  let worst = 0;
  a.forEach((stretch, i) =>
    stretch.forEach((p, j) => {
      const q = b[i][j];
      worst = Math.max(worst, Math.hypot(p.x - q.x, p.y - q.y));
    }),
  );
  return worst;
}

describe("predicting a ball's path", () => {
  it("follows it down a track and off the end", () => {
    const pg = new Playground();
    pg.lines.add([
      { x: 0, y: 200 },
      { x: 300, y: 400 },
      { x: 500, y: 380 },
    ]);
    const ball = pg.addBall(40, 180);
    ball.body.setLinearVelocity({ x: 2, y: 0 });
    ball.body.setAngularVelocity(5);
    const predicted = predictPath(pg, ball);
    const real = realPath(pg, 1.5);
    expect(predicted.map((s) => s.length)).toEqual(real.map((s) => s.length));
    // Within a few pixels all the way.
    expect(worstGap(predicted, real)).toBeLessThan(3);
    // It really did roll down the track, well past where it started.
    expect(predicted[0].at(-1)!.x).toBeGreaterThan(200);
  });

  it("starts a new stretch after each trip through a portal", () => {
    const pg = new Playground();
    pg.world.setGravity({ x: 0, y: 0 });
    pg.portals.add({ x: 300, y: 100 }, { x: 300, y: 500 }, "purple");
    pg.addBall(100, 100).body.setLinearVelocity({ x: 5, y: 0 });
    const predicted = predictPath(pg, pg.balls[0]);
    expect(predicted).toHaveLength(2);
    expect(predicted[1][0].y).toBeCloseTo(500, 0);
  });

  it("stops where a cup catches it", () => {
    const pg = new Playground();
    pg.cups.add(200, 400);
    const ball = pg.addBall(200, 200);
    const predicted = predictPath(pg, ball);
    const end = predicted.at(-1)!.at(-1)!;
    expect(Math.abs(end.x - 200)).toBeLessThan(1);
    expect(end.y).toBeLessThan(400);
    expect(predicted.flat().length).toBeLessThan(60);
  });

  it("leaves the real playground alone, and ignores its cannons", () => {
    const pg = new Playground();
    pg.lines.add([
      { x: 0, y: 400 },
      { x: 400, y: 400 },
    ]);
    // A cannon aimed right at the ball; its shots aren't predicted.
    pg.cannons.add(100, 300, 0, 1);
    const ball = pg.addBall(300, 300);
    const revision = pg.revision;
    const predicted = predictPath(pg, ball);
    expect(pg.balls).toEqual([ball]);
    expect(ball.position).toEqual({ x: 300, y: 300 });
    expect(pg.revision).toBe(revision);
    // It just falls onto the line.
    expect(Math.abs(predicted[0].at(-1)!.x - 300)).toBeLessThan(1);
  });
});
