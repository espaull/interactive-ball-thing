import { describe, expect, it } from "vitest";
import {
  distanceToOutline,
  isInside,
  outlineShape,
  outsideOutlines,
  roundShape,
  tidyOutline,
} from "./outline";
import type { Point } from "./point";

const square: Point[] = [
  { x: 0, y: 0 },
  { x: 100, y: 0 },
  { x: 100, y: 100 },
  { x: 0, y: 100 },
];

// A circle drawn round by hand, a point every 4px or so.
function circleStroke(radius: number): Point[] {
  const points: Point[] = [];
  const steps = Math.ceil((2 * Math.PI * radius) / 4);
  for (let i = 0; i <= steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    points.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius });
  }
  return points;
}

describe("outlines", () => {
  it("tell inside from outside", () => {
    expect(isInside({ x: 50, y: 50 }, square)).toBe(true);
    expect(isInside({ x: 150, y: 50 }, square)).toBe(false);
    expect(isInside({ x: 50, y: -1 }, square)).toBe(false);
  });

  it("measure the distance to their edge, the closing side too", () => {
    expect(distanceToOutline({ x: 50, y: 40 }, square)).toBeCloseTo(40);
    expect(distanceToOutline({ x: -10, y: 50 }, square)).toBeCloseTo(10);
  });

  it("drop points on top of each other, and need three", () => {
    expect(
      tidyOutline([...square, { x: 0, y: 100.1 }, { x: 0, y: 0.2 }]),
    ).toEqual(square);
    expect(tidyOutline(square.slice(0, 2))).toBeNull();
  });

  it("are made from a stroke drawn round", () => {
    const outline = outlineShape(circleStroke(60), 2)!;
    expect(outline.length).toBeGreaterThan(8);
    expect(isInside({ x: 0, y: 0 }, outline)).toBe(true);
    expect(isInside({ x: 70, y: 0 }, outline)).toBe(false);
  });

  it("aren't made from a scribble too small to be a shape", () => {
    expect(outlineShape(circleStroke(5), 2)).toBeNull();
    const line = [0, 10, 20, 30, 40].map((x) => ({ x, y: 0 }));
    expect(outlineShape(line, 2)).toBeNull();
  });

  it("can be made round a point", () => {
    const shape = roundShape({ x: 100, y: 100 }, 50, [1, 0.5, 1, 0.5]);
    expect(shape[0].x).toBeCloseTo(150);
    expect(shape[1].y).toBeCloseTo(125);
    expect(isInside({ x: 100, y: 100 }, shape)).toBe(true);
  });
});

describe("lines across outlines", () => {
  const across = [
    { x: -50, y: 50 },
    { x: 50, y: 50 },
    { x: 150, y: 50 },
  ];

  it("are cut at the edges, keeping what's outside", () => {
    const pieces = outsideOutlines(across, [square]);
    expect(pieces).toHaveLength(2);
    expect(pieces[0][0]).toEqual({ x: -50, y: 50 });
    expect(pieces[0].at(-1)!.x).toBeCloseTo(0);
    expect(pieces[1][0].x).toBeCloseTo(100);
    expect(pieces[1].at(-1)).toEqual({ x: 150, y: 50 });
  });

  it("are kept as they are when they miss", () => {
    const line = [
      { x: -50, y: 150 },
      { x: 150, y: 150 },
    ];
    expect(outsideOutlines(line, [square])[0]).toBe(line);
    expect(outsideOutlines(line, [])[0]).toBe(line);
  });

  it("go altogether when they're all inside", () => {
    const inside = [
      { x: 10, y: 10 },
      { x: 90, y: 90 },
    ];
    expect(outsideOutlines(inside, [square])).toEqual([]);
  });

  it("are cut by every outline they cross", () => {
    const further = square.map(({ x, y }) => ({ x: x + 200, y }));
    const long = [
      { x: -50, y: 50 },
      { x: 400, y: 50 },
    ];
    expect(outsideOutlines(long, [square, further])).toHaveLength(3);
  });
});
