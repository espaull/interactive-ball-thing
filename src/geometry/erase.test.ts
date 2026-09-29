import { describe, expect, it } from "vitest";
import { erasePolyline } from "./erase";

// A straight line along y=100, with a point every 6px from x=0 to x=300.
const line = Array.from({ length: 51 }, (_, i) => ({ x: i * 6, y: 100 }));

// [start x, end x] of each piece, rounded.
const spans = (pieces: { x: number }[][] | null) =>
  pieces?.map((p) => [
    Math.round(p[0].x * 10) / 10,
    Math.round(p.at(-1)!.x * 10) / 10,
  ]);

function seeded(seed: number): () => number {
  return () => {
    seed = (seed * 1664525 + 1013904223) >>> 0;
    return seed / 2 ** 32;
  };
}

describe("erasePolyline", () => {
  it("cuts a gap exactly at the eraser's edge", () => {
    expect(spans(erasePolyline(line, { x: 150, y: 100 }, 20))).toEqual([
      [0, 130],
      [170, 300],
    ]);
  });

  it("cuts a narrower gap when the eraser is off to one side", () => {
    // 12px off the line with radius 20 crosses it 16px either side.
    expect(spans(erasePolyline(line, { x: 150, y: 112 }, 20))).toEqual([
      [0, 134],
      [166, 300],
    ]);
  });

  it("trims an end", () => {
    expect(spans(erasePolyline(line, { x: 300, y: 100 }, 20))).toEqual([
      [0, 280],
    ]);
  });

  it("returns null when it misses", () => {
    expect(erasePolyline(line, { x: 150, y: 150 }, 20)).toBeNull();
  });

  it("removes a line entirely inside the eraser", () => {
    expect(
      erasePolyline(
        [
          { x: 0, y: 0 },
          { x: 10, y: 0 },
        ],
        { x: 5, y: 0 },
        20,
      ),
    ).toEqual([]);
  });

  // Regression: when the eraser's edge crossed the line exactly on one of its
  // points, the rest of the line was lost too.
  it("keeps the rest of the line when the edge lands exactly on a point", () => {
    // Circle at x=22, radius 20: its edge is at x=42, which is a point.
    // The 2px scrap before x=2 is too small to keep.
    expect(spans(erasePolyline(line, { x: 22, y: 100 }, 20))).toEqual([
      [42, 300],
    ]);
  });

  it("never keeps anything inside the eraser, or loses anything outside it", () => {
    const rand = seeded(42);
    // Checked by hand and gathered up, as calling expect millions of times
    // is slow enough to time out.
    const problems: string[] = [];
    for (let n = 0; n < 2000; n++) {
      const c = { x: rand() * 320 - 10, y: 100 + (rand() - 0.5) * 50 };
      const r = 5 + rand() * 40;
      const kept = (erasePolyline(line, c, r) ?? [line]).flat();

      for (const p of kept) {
        if (Math.hypot(p.x - c.x, p.y - c.y) <= r - 1e-6) {
          problems.push(`kept ${p.x},${p.y} inside ${c.x},${c.y} r${r}`);
        }
      }

      const keptKeys = new Set(kept.map((p) => `${p.x},${p.y}`));
      for (const p of line) {
        const outsideBy = Math.hypot(p.x - c.x, p.y - c.y) - r;
        // Points within 0.5px of a cut merge into the cut point, and scraps
        // under 4px at the very ends are dropped.
        if (outsideBy < 0.5 || p.x < 4 || p.x > 296) continue;
        if (!keptKeys.has(`${p.x},${p.y}`)) {
          problems.push(`lost ${p.x},${p.y} outside ${c.x},${c.y} r${r}`);
        }
      }
    }
    expect(problems).toEqual([]);
  });
});
