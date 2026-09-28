import { describe, expect, it } from "vitest";
import type { Point } from "../geometry/point";
import { segmentsCross } from "./crossings";
import { Playground } from "./playground";

const STEP = 1 / 60;

describe("segmentsCross", () => {
  it("finds where two segments cross", () => {
    expect(
      segmentsCross(
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 0, y: 10 },
        { x: 10, y: 0 },
      ),
    ).toEqual({ x: 5, y: 5 });
  });

  it("ignores segments that only meet at an end", () => {
    expect(
      segmentsCross(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 0 },
        { x: 10, y: 10 },
      ),
    ).toBeNull();
  });

  it("ignores parallel and separate segments", () => {
    expect(
      segmentsCross(
        { x: 0, y: 0 },
        { x: 10, y: 0 },
        { x: 0, y: 5 },
        { x: 10, y: 5 },
      ),
    ).toBeNull();
    expect(
      segmentsCross(
        { x: 0, y: 0 },
        { x: 10, y: 10 },
        { x: 20, y: 0 },
        { x: 30, y: 10 },
      ),
    ).toBeNull();
  });
});

describe("a line crossing itself", () => {
  // A pigtail loop drawn in one stroke: a flat run-up, then up, over the
  // top and down (crossing its own track on the way up and again on the way
  // down), then out along a flat exit on the far side. It's the curve traced
  // by x = X0 + r·t + d·sin(t), y = Y0 + d·cos(t) for t from 0 to 2π.
  const X0 = 400;
  const Y0 = 400;
  const d = 120;
  const r = 40;
  const loopEndX = X0 + 2 * Math.PI * r;
  const floorY = Y0 + d;

  function pigtail(): Point[] {
    const points: Point[] = [{ x: X0 - 500, y: floorY }];
    for (let i = 0; i <= 200; i++) {
      const t = (i / 200) * 2 * Math.PI;
      points.push({ x: X0 + r * t + d * Math.sin(t), y: Y0 + d * Math.cos(t) });
    }
    points.push({ x: loopEndX + 800, y: floorY });
    return points;
  }

  it("really does cross itself", () => {
    const points = pigtail();
    let crossings = 0;
    for (let i = 0; i < points.length - 1; i++) {
      for (let j = i + 2; j < points.length - 1; j++) {
        if (segmentsCross(points[i], points[i + 1], points[j], points[j + 1]))
          crossings++;
      }
    }
    expect(crossings).toBe(1);
  });

  it("lets a ball go in, round the loop, and out the other side", () => {
    const pg = new Playground();
    pg.addLine(pigtail());
    pg.addBoost([
      { x: X0 - 480, y: floorY - 10 },
      { x: X0 - 20, y: floorY - 10 },
    ]);
    const ball = pg.addBall(X0 - 450, floorY - 20);

    let wentOverTheTop = false;
    for (let t = 0; t < 5; t += STEP) {
      pg.step(STEP);
      if (ball.position.y < Y0 - d * 0.5) wentOverTheTop = true;
    }
    expect(wentOverTheTop).toBe(true);
    // Out on the exit, well past the loop.
    expect(ball.position.x).toBeGreaterThan(loopEndX + 150);
    expect(ball.position.y).toBeGreaterThan(floorY - 40);
  });

  it("still lets separate lines block each other", () => {
    const pg = new Playground();
    // A floor, and a separate line crossing it like an X (a wall).
    pg.addLine([
      { x: 0, y: 400 },
      { x: 1000, y: 400 },
    ]);
    pg.addLine([
      { x: 450, y: 450 },
      { x: 550, y: 250 },
    ]);
    const ball = pg.addBall(100, 384);
    ball.body.setLinearVelocity({ x: 8, y: 0 });
    for (let t = 0; t < 2; t += STEP) pg.step(STEP);
    // The wall crosses the floor at x = 475; the ball never gets past it.
    expect(ball.position.x).toBeLessThan(475);
  });
});
