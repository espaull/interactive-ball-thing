import type { Point } from "../geometry/point";

// Everything that makes up a playground's design, as plain data that can be
// saved and loaded: the lines, boost strips, portals, cups and cannons.
// Balls and bubbles aren't included, so a loaded playground starts clean.
// Positions in pixels.
export interface Layout {
  version: 1;
  lines: Point[][];
  boosts: Point[][];
  portals: {
    a: SavedPortalEnd;
    b: SavedPortalEnd;
    color: string;
  }[];
  cups: Point[];
  cannons: {
    x: number;
    y: number;
    angle: number;
    power: number;
    active: boolean;
  }[];
}

export interface SavedPortalEnd extends Point {
  aim: number | null;
}

export function emptyLayout(): Layout {
  return {
    version: 1,
    lines: [],
    boosts: [],
    portals: [],
    cups: [],
    cannons: [],
  };
}

export function isEmpty(layout: Layout): boolean {
  return (
    layout.lines.length === 0 &&
    layout.boosts.length === 0 &&
    layout.portals.length === 0 &&
    layout.cups.length === 0 &&
    layout.cannons.length === 0
  );
}

// Tenths of a pixel are plenty, and keep saves small.
export function round(n: number): number {
  return Math.round(n * 10) / 10;
}

export function roundPoint({ x, y }: Point): Point {
  return { x: round(x), y: round(y) };
}

// A layout read back from storage, or null if it isn't one (from a newer
// version, say, or damaged). Anything malformed inside it is skipped rather
// than losing the whole thing.
export function parseLayout(data: unknown): Layout | null {
  if (!isRecord(data) || data.version !== 1) return null;
  const layout = emptyLayout();
  for (const line of list(data.lines)) {
    const points = list(line).filter(isPoint);
    if (points.length >= 2) layout.lines.push(points.map(roundPoint));
  }
  for (const boost of list(data.boosts)) {
    const points = list(boost).filter(isPoint);
    if (points.length >= 2) layout.boosts.push(points.map(roundPoint));
  }
  for (const pair of list(data.portals)) {
    if (!isRecord(pair) || typeof pair.color !== "string") continue;
    const a = portalEnd(pair.a);
    const b = portalEnd(pair.b);
    if (a && b) layout.portals.push({ a, b, color: pair.color });
  }
  layout.cups = list(data.cups).filter(isPoint).map(roundPoint);
  for (const c of list(data.cannons)) {
    if (!isPoint(c) || !isNumber(c.angle) || !isNumber(c.power)) continue;
    layout.cannons.push({
      x: c.x,
      y: c.y,
      angle: c.angle,
      power: Math.max(0, Math.min(1, c.power)),
      active: c.active !== false,
    });
  }
  return layout;
}

function portalEnd(data: unknown): SavedPortalEnd | null {
  if (!isPoint(data)) return null;
  const aim = isNumber(data.aim) ? data.aim : null;
  return { x: data.x, y: data.y, aim };
}

function isRecord(data: unknown): data is Record<string, unknown> {
  return typeof data === "object" && data !== null;
}

function isNumber(n: unknown): n is number {
  return typeof n === "number" && Number.isFinite(n);
}

function isPoint(data: unknown): data is Point & Record<string, unknown> {
  return isRecord(data) && isNumber(data.x) && isNumber(data.y);
}

function list(data: unknown): unknown[] {
  return Array.isArray(data) ? data : [];
}
