// The 🖼️ button and the gallery of saved playgrounds.
import type { App } from "../app";
import { drawThumbnail } from "../render/thumbnail";
import type { Save } from "../saves";
import { labelled } from "./toolbar";

// Space kept between the gallery and the toolbar and 🖼️ button (CSS pixels).
const GAP_PX = 12;
// How long a remove button stays armed (red) waiting for its second tap.
const REMOVE_ARMED_MS = 3000;

// The 🖼️ button and its gallery: a Save tile that keeps a picture of the
// playground, then one tile per saved playground, newest first. Tapping one
// loads it. Whatever was there is kept in the gallery first (unless it's
// already saved or empty), so loading never loses anything.
export function setupGallery({
  saves: store,
  canvas,
  camera,
  playground,
  input,
  effects,
  background,
  history,
}: App): void {
  const button = document.querySelector<HTMLButtonElement>("#saves-button")!;
  const panel = document.querySelector<HTMLElement>("#saves-panel")!;
  const bgPicker = document.querySelector<HTMLElement>("#bg-picker")!;
  const toolbar = document.querySelector<HTMLElement>("#toolbar")!;
  // The tile to bounce, after saving.
  let justSaved: string | null = null;
  let note = "";

  const keep = (): Save | null =>
    store.add(
      playground.layout(),
      drawThumbnail(playground, background.current.base),
    );

  function save(): void {
    const saved = keep();
    note = saved ? "" : "No room for more · remove a picture to make some";
    justSaved = saved?.id ?? null;
    show();
  }

  function load(save: Save): void {
    const unsaved = playground.hasDesign && !store.find(playground.layout());
    if (unsaved && !keep()) {
      note = "No room to keep what's here · remove a picture first";
      show();
      return;
    }
    input.cancel();
    playground.loadLayout(save.layout);
    effects.clear();
    camera.home();
    history.checkpoint();
    panel.hidden = true;
  }

  function show(): void {
    const noteEl = document.createElement("p");
    noteEl.className = "note";
    noteEl.textContent = note;
    const tiles = document.createElement("div");
    tiles.className = "tiles";

    const saveButton = document.createElement("button");
    saveButton.title = "Save this playground";
    saveButton.append("💾", labelled("Save"));
    saveButton.disabled = !playground.hasDesign;
    saveButton.addEventListener("click", save);
    tiles.append(tile(saveButton));

    for (const s of store.list()) {
      const picture = document.createElement("button");
      picture.title = "Load this playground";
      picture.style.backgroundImage = `url(${s.picture})`;
      picture.addEventListener("click", () => load(s));
      const t = tile(picture, removeButton(s));
      t.classList.toggle("just-saved", s.id === justSaved);
      tiles.append(t);
    }
    tiles.dataset.columns = String(Math.min(3, tiles.children.length));
    panel.replaceChildren(noteEl, tiles);
    justSaved = null;
    fit();
  }

  // Fill the space between the toolbar and the 🖼️ button, and no more, so a
  // big gallery scrolls instead of going under the toolbar.
  function fit(): void {
    const top = toolbar.getBoundingClientRect().bottom + GAP_PX;
    const bottom = button.getBoundingClientRect().top - GAP_PX;
    panel.style.maxHeight = `${Math.max(0, bottom - top)}px`;
  }
  window.addEventListener("resize", () => {
    if (!panel.hidden) fit();
  });

  function removeButton(s: Save): HTMLButtonElement {
    const remove = document.createElement("button");
    remove.className = "remove";
    remove.title = "Remove (tap twice)";
    remove.textContent = "✕";
    let timer = 0;
    remove.addEventListener("click", () => {
      if (!remove.classList.contains("armed")) {
        remove.classList.add("armed");
        remove.textContent = "🗑️";
        timer = window.setTimeout(() => {
          remove.classList.remove("armed");
          remove.textContent = "✕";
        }, REMOVE_ARMED_MS);
        return;
      }
      window.clearTimeout(timer);
      store.remove(s.id);
      note = "";
      show();
    });
    return remove;
  }

  button.addEventListener("click", () => {
    panel.hidden = !panel.hidden;
    if (panel.hidden) return;
    note = "";
    show();
    bgPicker.hidden = true;
  });
  // Opening the background picker, or starting to play again, closes it.
  document
    .querySelector("#bg-button")!
    .addEventListener("click", () => (panel.hidden = true));
  canvas.addEventListener("pointerdown", () => (panel.hidden = true));
}

function tile(...children: HTMLElement[]): HTMLDivElement {
  const div = document.createElement("div");
  div.className = "save-tile";
  div.append(...children);
  return div;
}
