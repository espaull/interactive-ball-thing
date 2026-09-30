import { describe, expect, it } from "vitest";
import { SaveStore } from "./saves";
import { emptyLayout, type Layout } from "./world/layout";

// A stand-in for localStorage, which can be made to fill up.
class FakeStorage {
  items = new Map<string, string>();
  full = false;
  getItem(key: string): string | null {
    return this.items.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    if (this.full) throw new DOMException("full", "QuotaExceededError");
    this.items.set(key, value);
  }
}

function setUp() {
  const storage = new FakeStorage();
  return { storage, store: new SaveStore(storage as unknown as Storage) };
}

function withCup(x: number): Layout {
  return { ...emptyLayout(), cups: [{ x, y: 0 }] };
}

describe("saves", () => {
  it("keep the autosave", () => {
    const { store } = setUp();
    expect(store.loadAutosave()).toBeNull();
    store.autosave(withCup(1));
    expect(store.loadAutosave()).toEqual(withCup(1));
  });

  it("list the gallery newest first, without duplicates", () => {
    const { store } = setUp();
    const first = store.add(withCup(1), "pic1")!;
    store.add(withCup(2), "pic2");
    // The same playground again is the save already there.
    expect(store.add(withCup(1), "pic3")).toEqual(first);
    expect(store.list().map((s) => s.picture)).toEqual(["pic2", "pic1"]);
    expect(store.find(withCup(2))?.picture).toBe("pic2");
    expect(store.find(withCup(3))).toBeNull();
  });

  it("remove saves", () => {
    const { store } = setUp();
    const save = store.add(withCup(1), "pic1")!;
    store.add(withCup(2), "pic2");
    store.remove(save.id);
    expect(store.list().map((s) => s.picture)).toEqual(["pic2"]);
  });

  it("say when there's no room, and keep what was there", () => {
    const { storage, store } = setUp();
    store.add(withCup(1), "pic1");
    storage.full = true;
    expect(store.add(withCup(2), "pic2")).toBeNull();
    expect(store.autosave(withCup(2))).toBe(false);
    expect(store.list()).toHaveLength(1);
  });

  it("cope with damaged or missing storage", () => {
    const { storage, store } = setUp();
    storage.items.set("saves", "{not json");
    storage.items.set("autosave", '{"version": 99}');
    expect(store.list()).toEqual([]);
    expect(store.loadAutosave()).toBeNull();

    const none = new SaveStore(null);
    expect(none.list()).toEqual([]);
    expect(none.add(withCup(1), "pic")).toBeNull();
  });

  it("keep the most hearts won in each level", () => {
    const { store } = setUp();
    expect(store.loadProgress()).toEqual({});
    store.recordWin("a", 2);
    store.recordWin("a", 1);
    store.recordWin("b", 0);
    expect(store.loadProgress()).toEqual({ a: 2, b: 0 });
  });

  it("skip anything odd in the saved progress", () => {
    const { storage, store } = setUp();
    storage.setItem("levels", JSON.stringify({ a: 3, b: "lots", c: -1 }));
    expect(store.loadProgress()).toEqual({ a: 3 });
    storage.setItem("levels", "not json");
    expect(store.loadProgress()).toEqual({});
  });
});
