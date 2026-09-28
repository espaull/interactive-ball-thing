import {
  distance,
  distanceToSegment,
  polylineLength,
  type Point,
} from "./point";

// Leftover scraps shorter than this are thrown away.
const MIN_PIECE_PX = 4;
// Points closer together than this are merged (Box2D rejects chain vertices
// that are nearly on top of each other).
const MIN_GAP_PX = 0.5;

// Where segment p→q crosses the circle, as fractions (0..1) along it.
function circleCrossings(p: Point, q: Point, c: Point, r: number): number[] {
  const dx = q.x - p.x;
  const dy = q.y - p.y;
  const fx = p.x - c.x;
  const fy = p.y - c.y;
  const a = dx * dx + dy * dy;
  const b = 2 * (fx * dx + fy * dy);
  const k = fx * fx + fy * fy - r * r;
  const disc = b * b - 4 * a * k;
  if (a === 0 || disc <= 0) return [];
  const root = Math.sqrt(disc);
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)].filter(
    (t) => t > 0 && t < 1,
  );
}

function tidy(points: Point[]): Point[] {
  const out: Point[] = [];
  for (const p of points) {
    const last = out.at(-1);
    if (!last || distance(p, last) >= MIN_GAP_PX) out.push(p);
  }
  return out;
}

// Rub out the parts of a line inside a circle. Returns the pieces left over
// (cut exactly at the circle's edge), or null if the circle misses the line.
export function erasePolyline(
  points: Point[],
  c: Point,
  r: number,
): Point[][] | null {
  let hit = false;
  for (let i = 0; i < points.length - 1 && !hit; i++) {
    hit = distanceToSegment(c, points[i], points[i + 1]) < r;
  }
  if (!hit) return null;

  const pieces: Point[][] = [];
  let current: Point[] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    const at = (t: number) => ({
      x: p.x + (q.x - p.x) * t,
      y: p.y + (q.y - p.y) * t,
    });
    // Split the segment where it crosses the circle, then keep each part
    // whose middle is outside. (Testing each part, rather than flipping
    // in/out at each crossing, copes with the edge landing exactly on a point.)
    const cuts = [0, ...circleCrossings(p, q, c, r), 1];
    for (let k = 0; k < cuts.length - 1; k++) {
      const mid = at((cuts[k] + cuts[k + 1]) / 2);
      if (distance(mid, c) >= r) {
        if (current.length === 0) current.push(at(cuts[k]));
        current.push(at(cuts[k + 1]));
      } else if (current.length > 0) {
        pieces.push(current);
        current = [];
      }
    }
  }
  if (current.length > 0) pieces.push(current);

  return pieces
    .map(tidy)
    .filter(
      (piece) => piece.length >= 2 && polylineLength(piece) >= MIN_PIECE_PX,
    );
}
