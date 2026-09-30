// Sharing a level as a link. The level (less its solution, so the answer
// isn't in the link, and with points rounded to whole pixels) goes after
// #level= in the address, which browsers never send to a server: levels go
// straight from one person to another. Links come from anyone, so reading
// one checks it every step of the way.
import type { Point } from "../geometry/point";
import type { Layout } from "../world/layout";
import { parseLevel, type Level } from "./level";

const HASH = "#level=";
// Codes start with how they're packed: 1 is compressed (deflate), 0 is
// plain, for browsers without CompressionStream.
const COMPRESSED = "1";
const PLAIN = "0";
// Links longer than this, and levels that unpack to more than this, are
// turned down, so a link can't swamp the page.
const MAX_CODE_LENGTH = 50_000;
const MAX_JSON_BYTES = 500_000;
// The most points a shared level's pieces can have in all.
const MAX_POINTS = 20_000;

// The part of a link that holds the level.
export async function encodeLevel(level: Level): Promise<string> {
  const shared = { ...level, solution: null, pieces: rounded(level.pieces) };
  const json = new TextEncoder().encode(JSON.stringify(shared));
  if (typeof CompressionStream === "undefined") return PLAIN + base64(json);
  return (
    // (Compressing has no limit, so it always gives bytes back.)
    COMPRESSED +
    base64((await pipe(json, new CompressionStream("deflate-raw")))!)
  );
}

// The level in a code, or null if it isn't a good one.
export async function decodeLevel(code: string): Promise<Level | null> {
  if (code.length > MAX_CODE_LENGTH) return null;
  try {
    const bytes = unbase64(code.slice(1));
    let json: Bytes | null;
    if (code.startsWith(PLAIN)) json = bytes;
    else if (code.startsWith(COMPRESSED)) {
      json = await pipe(
        bytes,
        new DecompressionStream("deflate-raw"),
        MAX_JSON_BYTES,
      );
    } else return null;
    if (!json || json.length > MAX_JSON_BYTES) return null;
    const level = parseLevel(JSON.parse(new TextDecoder().decode(json)));
    if (!level || pointCount(level.pieces) > MAX_POINTS) return null;
    return { ...level, solution: null };
  } catch {
    return null;
  }
}

// A link to the game (at `page`, the address without its #) with a level
// in it.
export function shareLink(page: string, code: string): string {
  return page + HASH + code;
}

// The level code in an address's # part, if there is one.
export function codeInHash(hash: string): string | null {
  return hash.startsWith(HASH) ? hash.slice(HASH.length) : null;
}

// Points rounded to whole pixels, leaving out any that land on the one
// before.
function rounded(layout: Layout): Layout {
  const round = (points: Point[]) =>
    points
      .map(({ x, y }) => ({ x: Math.round(x), y: Math.round(y) }))
      .filter(
        (p, i, all) => i === 0 || p.x !== all[i - 1].x || p.y !== all[i - 1].y,
      );
  return {
    ...layout,
    lines: layout.lines.map(round),
    boosts: layout.boosts.map(round),
  };
}

function pointCount(layout: Layout): number {
  const { version: _, ...parts } = layout;
  return Object.values(parts).reduce(
    (n, things) =>
      n +
      things.reduce(
        (m: number, thing: unknown) =>
          m + (Array.isArray(thing) ? thing.length : 1),
        0,
      ),
    0,
  );
}

type Bytes = Uint8Array<ArrayBuffer>;

// Bytes through a (de)compression stream, or null if more than `limit`
// come out.
async function pipe(
  bytes: Bytes,
  transform: CompressionStream | DecompressionStream,
  limit = Infinity,
): Promise<Bytes | null> {
  const reader = new Blob([bytes]).stream().pipeThrough(transform).getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > limit) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let at = 0;
  for (const chunk of chunks) {
    out.set(chunk, at);
    at += chunk.length;
  }
  return out;
}

// Base64 that's safe in a URL (- and _ for + and /, no = padding).
function base64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function unbase64(text: string): Bytes {
  const binary = atob(text.replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from(binary, (c) => c.charCodeAt(0));
}
