// Playgrounds kept in this browser: the autosave (whatever was there last
// time) and the gallery of saved playgrounds, each with a picture.
import { parseLevel, type Level } from "./levels/level";
import { parseLayout, type Layout } from "./world/layout";
import type { Playground } from "./world/playground";

const AUTOSAVE_KEY = "autosave";
const GALLERY_KEY = "saves";
const PROGRESS_KEY = "levels";
const MY_LEVELS_KEY = "my-levels";

// A level in My levels: one made here, or one shared with you (editing
// that makes your own copy, so theirs stays as they made it).
export interface MyLevel {
  level: Level;
  made: boolean;
}

// How the levels have gone: the most hearts collected in each level
// finished, by its id. A level that's in here has been finished.
export type Progress = Record<string, number>;

export interface Save {
  id: string;
  // A small picture of the playground, as a data URL.
  picture: string;
  layout: Layout;
}

// Storage can be missing or refuse to store (private windows, or full), so
// every call copes with that: reads come back empty and failed writes say so.
export class SaveStore {
  constructor(private storage: Storage | null) {}

  loadAutosave(): Layout | null {
    return parseLayout(this.read(AUTOSAVE_KEY));
  }

  autosave(layout: Layout): boolean {
    return this.write(AUTOSAVE_KEY, layout);
  }

  // Newest first.
  list(): Save[] {
    const saves: Save[] = [];
    const data = this.read(GALLERY_KEY);
    const items = (Array.isArray(data) ? data : []) as Partial<Save>[];
    for (const item of items) {
      const layout = parseLayout(item?.layout);
      if (layout && typeof item.id === "string") {
        const picture = typeof item.picture === "string" ? item.picture : "";
        saves.push({ id: item.id, picture, layout });
      }
    }
    return saves;
  }

  // The save with exactly this layout, if there is one.
  find(layout: Layout): Save | null {
    const json = JSON.stringify(layout);
    return this.list().find((s) => JSON.stringify(s.layout) === json) ?? null;
  }

  // Add a playground to the front of the gallery, unless it's already there.
  // Returns the save, or null if there was no room for it.
  add(layout: Layout, picture: string): Save | null {
    const existing = this.find(layout);
    if (existing) return existing;
    const save = { id: newId(), picture, layout };
    return this.write(GALLERY_KEY, [save, ...this.list()]) ? save : null;
  }

  loadProgress(): Progress {
    const data = this.read(PROGRESS_KEY);
    const progress: Progress = {};
    if (typeof data !== "object" || data === null) return progress;
    for (const [id, hearts] of Object.entries(data)) {
      if (typeof hearts === "number" && hearts >= 0) progress[id] = hearts;
    }
    return progress;
  }

  // A level finished with this many hearts: kept if it's the most yet.
  recordWin(id: string, hearts: number): Progress {
    const progress = this.loadProgress();
    progress[id] = Math.max(progress[id] ?? 0, hearts);
    this.write(PROGRESS_KEY, progress);
    return progress;
  }

  // My levels, newest first.
  myLevels(): MyLevel[] {
    const data = this.read(MY_LEVELS_KEY);
    const levels: MyLevel[] = [];
    for (const item of Array.isArray(data) ? data : []) {
      const level = parseLevel(item?.level);
      if (level) levels.push({ level, made: item.made === true });
    }
    return levels;
  }

  // Keep a level in My levels: in place of the one with its id, or else at
  // the front. Returns false if there's no room.
  keepLevel(entry: MyLevel): boolean {
    const levels = this.myLevels();
    const at = levels.findIndex((l) => l.level.id === entry.level.id);
    if (at === -1) levels.unshift(entry);
    else levels[at] = entry;
    return this.write(MY_LEVELS_KEY, levels);
  }

  removeLevel(id: string): void {
    this.write(
      MY_LEVELS_KEY,
      this.myLevels().filter((l) => l.level.id !== id),
    );
  }

  remove(id: string): void {
    this.write(
      GALLERY_KEY,
      this.list().filter((s) => s.id !== id),
    );
  }

  private read(key: string): unknown {
    try {
      const json = this.storage?.getItem(key);
      return json ? JSON.parse(json) : null;
    } catch {
      return null;
    }
  }

  private write(key: string, value: unknown): boolean {
    try {
      if (!this.storage) return false;
      this.storage.setItem(key, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  }
}

// How long after a change to autosave, in milliseconds. Changes in the
// meantime are saved along with it, so while playing it writes at most this
// often, and not at all while nothing changes.
const AUTOSAVE_DELAY_MS = 2000;

// The autosave, which can be paused while a level's played (a level isn't
// the free play playground, so mustn't be saved over it).
export interface Autosave {
  // Save any change waiting, then stop saving.
  pause(): void;
  resume(): void;
}

// Bring back the playground from last time, then save it shortly after
// each change (and straight away when the page is hidden or closed).
export function startAutosave(
  store: SaveStore,
  playground: Playground,
): Autosave {
  const saved = store.loadAutosave();
  if (saved) playground.loadLayout(saved);

  let paused = false;
  let pending: number | undefined;
  const save = () => {
    window.clearTimeout(pending);
    pending = undefined;
    store.autosave(playground.layout());
  };
  playground.designChanged.listen(() => {
    if (!paused) pending ??= window.setTimeout(save, AUTOSAVE_DELAY_MS);
  });
  const saveNow = () => {
    if (pending !== undefined) save();
  };
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) saveNow();
  });
  window.addEventListener("pagehide", saveNow);
  return {
    pause() {
      saveNow();
      paused = true;
    },
    resume() {
      paused = false;
    },
  };
}

// The browser's storage, or null where it's unavailable.
export function browserStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
