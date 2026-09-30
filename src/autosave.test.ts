// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SaveStore, startAutosave } from "./saves";
import { Playground } from "./world/playground";

function line(y: number) {
  return [
    { x: 0, y },
    { x: 400, y },
  ];
}

describe("the autosave", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("saves free play before a level, and nothing of the level", () => {
    const store = new SaveStore(window.localStorage);
    window.localStorage.clear();
    const pg = new Playground();
    const autosave = startAutosave(store, pg);

    pg.lines.add(line(100));
    // Pausing (to play a level) saves the change waiting, straight away.
    autosave.pause();
    expect(store.loadAutosave()?.lines).toEqual([line(100)]);

    // The level's changes aren't saved over it.
    pg.clear();
    pg.lines.add(line(200));
    vi.advanceTimersByTime(5000);
    window.dispatchEvent(new Event("pagehide"));
    expect(store.loadAutosave()?.lines).toEqual([line(100)]);

    // Back in free play, changes are saved again.
    autosave.resume();
    pg.lines.add(line(300));
    vi.advanceTimersByTime(5000);
    expect(store.loadAutosave()?.lines).toHaveLength(2);
  });
});
