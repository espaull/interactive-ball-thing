import { describe, expect, it } from "vitest";
import { emptyLayout } from "../world/layout";
import type { Level } from "./level";
import { LEVELS } from "./levels";
import { codeInHash, decodeLevel, encodeLevel, shareLink } from "./share";

// Pack bytes the way a code does: compressed, or not.
async function pack(json: string, compressed: boolean): Promise<string> {
  let bytes = new TextEncoder().encode(json);
  if (compressed) {
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new CompressionStream("deflate-raw"));
    bytes = new Uint8Array(await new Response(stream).arrayBuffer());
  }
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  const text = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_");
  return (compressed ? "1" : "0") + text.replace(/=+$/, "");
}

function level(): Level {
  return {
    id: "c-abc-123",
    name: "Mine",
    tip: "Go!",
    rider: "sledge",
    start: { x: 10, y: 20 },
    goal: { x: 300, y: 200 },
    hearts: [{ x: 100, y: 100 }],
    limits: { ink: 300, portals: 1 },
    pieces: {
      ...emptyLayout(),
      lines: [
        [
          { x: 0.4, y: 100.2 },
          { x: 0.3, y: 100.4 },
          { x: 200.6, y: 99.5 },
        ],
      ],
    },
    solution: { ...emptyLayout(), cups: [{ x: 1, y: 1 }] },
  };
}

describe("sharing a level", () => {
  it("round-trips it, without its solution, points rounded", async () => {
    const back = await decodeLevel(await encodeLevel(level()));
    expect(back).toEqual({
      ...level(),
      solution: null,
      pieces: {
        ...emptyLayout(),
        // (The second point rounds onto the first, so it goes.)
        lines: [
          [
            { x: 0, y: 100 },
            { x: 201, y: 100 },
          ],
        ],
      },
    });
  });

  it("keeps a rock whole when its points are rounded", async () => {
    const rocky = level();
    rocky.pieces.rocks = [
      [
        { x: 0.2, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 80 },
        { x: 0.4, y: 0.3 },
      ],
      // Rounds down to a line, which isn't a rock.
      [
        { x: 0, y: 0 },
        { x: 0.1, y: 0.1 },
        { x: 9, y: 0 },
      ],
    ];
    const back = await decodeLevel(await encodeLevel(rocky));
    expect(back?.pieces.rocks).toEqual([
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 50, y: 80 },
      ],
    ]);
  });

  it("makes links short enough to send, for every built-in level", async () => {
    for (const l of LEVELS) {
      const code = await encodeLevel(l);
      expect(code.length).toBeLessThan(4000);
      const back = await decodeLevel(code);
      expect(back?.name).toBe(l.name);
    }
  });

  it("reads plain codes too (from browsers that can't compress)", async () => {
    const code = await pack(JSON.stringify(level()), false);
    expect((await decodeLevel(code))?.name).toBe("Mine");
  });

  it("turns down codes that aren't a good level", async () => {
    for (const code of ["", "1", "1!!!", "2abc", await pack("{}", true)]) {
      expect(await decodeLevel(code)).toBeNull();
    }
    expect(await decodeLevel(await pack("not json", false))).toBeNull();
  });

  it("turns down levels that are far too big", async () => {
    const huge = level();
    huge.pieces.lines = [
      Array.from({ length: 25_000 }, (_, i) => ({ x: i, y: i % 7 })),
    ];
    expect(await decodeLevel(await encodeLevel(huge))).toBeNull();
    // A small code that unpacks to something enormous.
    const bomb = await pack(" ".repeat(2_000_000) + "{}", true);
    expect(bomb.length).toBeLessThan(10_000);
    expect(await decodeLevel(bomb)).toBeNull();
  });

  it("cuts long names and tips short", async () => {
    const long = { ...level(), name: "x".repeat(500), tip: "y".repeat(500) };
    const back = await decodeLevel(await encodeLevel(long));
    expect(back?.name).toHaveLength(40);
    expect(back?.tip).toHaveLength(120);
  });

  it("puts the code after #level= in the link", () => {
    const link = shareLink("https://example.com/game/", "1abc");
    expect(link).toBe("https://example.com/game/#level=1abc");
    expect(codeInHash(new URL(link).hash)).toBe("1abc");
    expect(codeInHash("#other")).toBeNull();
  });
});
