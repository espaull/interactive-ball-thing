import { describe, expect, it } from "vitest";
import type { Point } from "./simplify";
import { smoothStroke, splitTail } from "./stroke";

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
