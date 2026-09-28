import { describe, expect, it } from "vitest";
import type { Point } from "./simplify";
import { curveShape, freehandShape, joinShape, smoothStroke, splitTail } from "./stroke";

// Small repeatable random numbers, so tests don't change between runs.
function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32 - 0.5;
  };
}

// The sharpest turn between neighbouring segments, in degrees.
function sharpestBend(points: Point[]): number {
  let max = 0;
  for (let i = 1; i < points.length - 1; i++) {
    const a = Math.atan2(points[i].y - points[i - 1].y, points[i].x - points[i - 1].x);
    const b = Math.atan2(points[i + 1].y - points[i].y, points[i + 1].x - points[i].x);
    let d = Math.abs(b - a);
    if (d > Math.PI) d = 2 * Math.PI - d;
    max = Math.max(max, (d * 180) / Math.PI);
  }
  return max;
}

// A gentle arc with hand-style jitter of ±4px.
function wobblyArc(): Point[] {
  const rand = seeded(3);
  return Array.from({ length: 121 }, (_, i) => {
    const t = i / 120;
    return { x: 80 + t * 480, y: 200 + t * 250 - Math.sin(t * Math.PI) * 60 + rand() * 8 };
  });
}

describe("smoothStroke", () => {
  it("keeps the stroke's ends exactly where they were", () => {
    const raw = wobblyArc();
    const smooth = smoothStroke(raw);
    expect(smooth[0]).toEqual(raw[0]);
    expect(smooth.at(-1)!.x).toBeCloseTo(raw.at(-1)!.x);
    expect(smooth.at(-1)!.y).toBeCloseTo(raw.at(-1)!.y);
  });

  it("takes out hand wobble", () => {
    const raw = wobblyArc();
    expect(sharpestBend(raw)).toBeGreaterThan(60);
    expect(sharpestBend(smoothStroke(raw))).toBeLessThan(15);
  });

  it("stays close to the intended path", () => {
    const ideal = (x: number) => {
      const t = (x - 80) / 480;
      return 200 + t * 250 - Math.sin(t * Math.PI) * 60;
    };
    for (const p of smoothStroke(wobblyArc())) expect(Math.abs(p.y - ideal(p.x))).toBeLessThan(4);
  });
});

describe("splitTail", () => {
  const line = Array.from({ length: 51 }, (_, i) => ({ x: i * 6, y: 0 }));

  it("splits off about the last 40px, ending at the line's end", () => {
    const { head, tail } = splitTail(line);
    expect(tail.at(-1)).toEqual(line.at(-1));
    const tailLength = tail.at(-1)!.x - tail[0].x;
    expect(tailLength).toBeGreaterThanOrEqual(40);
    expect(tailLength).toBeLessThan(40 + 6);
    expect([...head, ...tail]).toEqual(line);
  });

  it("uses the whole line when it's shorter than the blend", () => {
    const short = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    expect(splitTail(short)).toEqual({ head: [], tail: short });
  });
});

describe("joinShape", () => {
  // Two lines along y=0 with a 60px gap between x=200 and x=260.
  const left = Array.from({ length: 34 }, (_, i) => ({ x: i * 6, y: 0 })).filter((p) => p.x <= 200);
  const right = Array.from({ length: 34 }, (_, i) => ({ x: 260 + i * 6, y: 0 }));
  // Both passed "ending at the joined end": left ends at x=200 already,
  // right is reversed so it ends at x=260.
  const leftEnd = left.at(-1)!;
  const rightEnd = right[0];
  const rightEndingAtJoin = [...right].reverse();

  it("bridges two lines into one running from end to end", () => {
    const stroke = [leftEnd, { x: 220, y: 3 }, { x: 240, y: -3 }, rightEnd];
    const shape = joinShape(stroke, left, rightEndingAtJoin, freehandShape);
    expect(shape[0]).toEqual(left[0]);
    expect(shape.at(-1)).toEqual(right.at(-1));
    // Nothing strays far from the straight line it's bridging.
    for (const p of shape) expect(Math.abs(p.y)).toBeLessThan(3);
  });

  it("smooths the corner where a new line turns away", () => {
    // Carry on from the left line's end, heading 45° down.
    const stroke = Array.from({ length: 20 }, (_, i) => ({ x: 200 + i * 5, y: i * 5 }));
    const shape = joinShape(stroke, left, null, freehandShape);
    expect(shape[0]).toEqual(left[0]);
    expect(sharpestBend(shape)).toBeLessThan(20);
  });

  it("joins a curve through the joined end, and spreads the turn out", () => {
    // A hairpin: the curve heads back up from the left line's end.
    const clicks = [leftEnd, { x: 220, y: -60 }, { x: 150, y: -90 }];
    const shape = joinShape(clicks, left, null, curveShape);
    const throughJoin = Math.min(...shape.map((p) => Math.hypot(p.x - leftEnd.x, p.y - leftEnd.y)));
    expect(throughJoin).toBeLessThan(0.01);
    expect(sharpestBend(shape)).toBeLessThan(25);
  });

  it("is just the built shape when there's nothing to join", () => {
    const stroke = [{ x: 0, y: 0 }, { x: 30, y: 10 }, { x: 60, y: 0 }];
    expect(joinShape(stroke, null, null, freehandShape)).toEqual(freehandShape(stroke, [], []));
  });
});
