import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { format } from "prettier";
import { describe, expect, it } from "vitest";
import { saveLevel } from "./level-files";

function setUp() {
  const dir = mkdtempSync(join(tmpdir(), "levels-"));
  writeFileSync(join(dir, "order.json"), '["one"]\n');
  return dir;
}

const read = (dir: string, file: string) =>
  readFileSync(join(dir, file), "utf8");

describe("saving a level file", () => {
  it("writes it formatted, and adds a new one to the order", async () => {
    const dir = setUp();
    const level = { id: "two", name: "Two", hearts: [{ x: 1, y: 2 }] };
    expect(await saveLevel(dir, level)).toBeNull();
    const file = read(dir, "two.json");
    expect(JSON.parse(file)).toEqual(level);
    expect(file).toBe(await format(file, { parser: "json" }));
    expect(JSON.parse(read(dir, "order.json"))).toEqual(["one", "two"]);
  });

  it("saves over one already there, keeping its place", async () => {
    const dir = setUp();
    await saveLevel(dir, { id: "one", name: "First" });
    await saveLevel(dir, { id: "one", name: "Changed" });
    expect(JSON.parse(read(dir, "one.json")).name).toBe("Changed");
    expect(JSON.parse(read(dir, "order.json"))).toEqual(["one"]);
  });

  it("won't write anywhere but a level file", async () => {
    const dir = setUp();
    expect(await saveLevel(dir, { id: "../escape" })).not.toBeNull();
    expect(await saveLevel(dir, { id: "Bad Name" })).not.toBeNull();
    expect(await saveLevel(dir, "level")).not.toBeNull();
    expect(JSON.parse(read(dir, "order.json"))).toEqual(["one"]);
  });
});
