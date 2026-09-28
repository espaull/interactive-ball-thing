import { describe, expect, it } from "vitest";
import { simplify } from "./simplify";

describe("simplify", () => {
  it("keeps both end points", () => {
    const points = [
      { x: 0, y: 0 },
      { x: 5, y: 1 },
      { x: 10, y: 0 },
    ];
    const result = simplify(points, 5);
    expect(result[0]).toEqual(points[0]);
    expect(result.at(-1)).toEqual(points.at(-1));
  });

  it("reduces a straight run to its two ends", () => {
    const points = Array.from({ length: 20 }, (_, i) => ({
      x: i * 5,
      y: i * 2,
    }));
    expect(simplify(points, 0.5)).toEqual([points[0], points[19]]);
  });

  it("keeps corners bigger than the tolerance", () => {
    const corner = { x: 50, y: 50 };
    const points = [
      { x: 0, y: 0 },
      { x: 25, y: 25 },
      corner,
      { x: 75, y: 25 },
      { x: 100, y: 0 },
    ];
    expect(simplify(points, 1)).toContainEqual(corner);
  });
});
