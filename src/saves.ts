// Playgrounds kept in this browser: the autosave (whatever was there last
// time) and the gallery of saved playgrounds, each with a picture.
import { parseLayout, type Layout } from "./world/layout";
import type { Playground } from "./world/playground";

const AUTOSAVE_KEY = "autosave";
const GALLERY_KEY = "saves";

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

// How often to check for changes to autosave, in milliseconds.
const AUTOSAVE_INTERVAL_MS = 30000;

// Bring back the playground from last time, then keep saving it whenever it
// changes (checked every thirty seconds, and when the page is hidden or closed).
export function startAutosave(store: SaveStore, playground: Playground): void {
  const saved = store.loadAutosave();
  if (saved) playground.loadLayout(saved);

  let last = JSON.stringify(playground.layout());
  const check = () => {
    const layout = playground.layout();
    const json = JSON.stringify(layout);
    if (json !== last && store.autosave(layout)) last = json;
  };
  window.setInterval(check, AUTOSAVE_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) check();
  });
  window.addEventListener("pagehide", check);
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
