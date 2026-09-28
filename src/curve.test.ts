import { describe, expect, it } from "vitest";
import { catmullRom } from "./curve";
import type { Point } from "./simplify";

const nearest = (curve: Point[], p: Point) =>
  Math.min(...curve.map((c) => Math.hypot(c.x - p.x, c.y - p.y)));

describe("catmullRom", () => {
  const controls = [
    { x: 0, y: 0 },
    { x: 100, y: 80 },
    { x: 180, y: 90 },
    { x: 260, y: 20 },
  ];

  it("starts and ends exactly on the first and last points", () => {
    const curve = catmullRom(controls, 6);
    expect(curve[0]).toEqual(controls[0]);
    expect(curve.at(-1)!.x).toBeCloseTo(260);
    expect(curve.at(-1)!.y).toBeCloseTo(20);
  });

  it("passes through every control point", () => {
    const curve = catmullRom(controls, 6);
    for (const p of controls) expect(nearest(curve, p)).toBeLessThan(0.01);
  });

  it("never puts two points nearly on top of each other", () => {
    // Box2D rejects chain vertices that are too close together.
    const curve = catmullRom([...controls, controls[3]], 6);
    for (let i = 1; i < curve.length; i++) {
      const gap = Math.hypot(curve[i].x - curve[i - 1].x, curve[i].y - curve[i - 1].y);
      expect(gap).toBeGreaterThanOrEqual(2);
    }
  });

  it("makes a straight line from two points", () => {
    const curve = catmullRom([{ x: 0, y: 0 }, { x: 60, y: 0 }], 6);
    for (const p of curve) expect(p.y).toBeCloseTo(0);
  });
});
