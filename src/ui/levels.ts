// The menus (the front screen, the level map with its Levels and My levels
// tabs, and the win panel), the Go and Back buttons, and switching between
// free play, levels and the level editor.
import type { App } from "../app";
import { fitsLimits, type Level } from "../levels/level";
import { LEVELS } from "../levels/levels";
import type { MyLevel } from "../saves";
import { emptyLayout } from "../world/layout";
import { labelled } from "./toolbar";

// How long after winning (ms) before the win panel comes up, so the
// confetti can be seen first.
const WIN_PANEL_DELAY_MS = 1200;
// How long a delete button stays armed (red) waiting for its second tap.
const DELETE_ARMED_MS = 3000;

export type Mode = "free" | "level" | "editor";
export type Tab = "levels" | "mine";

// The editor trying out the level it's making.
export interface Trial {
  // It was won, with this many hearts. (The player's pieces are still in
  // the playground.)
  won(hearts: number): void;
  // Back to editing.
  back(): void;
}

// What the level map needs from the editor (ui/editor.ts).
export interface Editor {
  // Edit one of My levels (a copy, if it was shared with you), or make a
  // new one.
  edit(mine: MyLevel | null): void;
}

// What the editor uses.
export interface LevelScreens {
  readonly mode: Mode;
  setEditor(editor: Editor): void;
  // Leave free play or a level (keeping free play saved) for the editor.
  enterEditor(): void;
  tryLevel(level: Level, trial: Trial): void;
  // What the toolbar's Back button says (and its tooltip) and does.
  setBack(label: string, title: string, action: () => void): void;
  showFront(): void;
  showMap(tab: Tab): void;
  // Show one of the menu screens (including ones the editor adds), or none.
  show(screen: HTMLElement | null): void;
  addScreen(screen: HTMLElement): void;
  addFrontButton(button: HTMLButtonElement): void;
}

// The level being played: one of LEVELS (by index), one of My levels, or
// the editor's.
type Playing = { index: number } | { mine: MyLevel } | { trial: Trial };

export function setupLevels({
  levels: play,
  playground,
  camera,
  toolbar,
  saves,
  history,
  autosave,
  guides,
  input,
  effects,
}: App): LevelScreens {
  const $ = <T extends HTMLElement>(selector: string) =>
    document.querySelector<T>(selector)!;
  const front = $("#front");
  const map = $("#level-map");
  const win = $("#win");
  const screens = [front, map, win];
  const backButton = $<HTMLButtonElement>("#back");
  const go = $<HTMLButtonElement>("#go");
  const next = win.querySelector<HTMLButtonElement>(".next")!;
  const winBack = win.querySelector<HTMLButtonElement>(".levels-button")!;
  let mode: Mode = "free";
  let playing: Playing | null = null;
  let tab: Tab = "levels";
  let editor: Editor | null = null;
  let backAction = () => showFront();
  let winTimer = 0;

  function show(screen: HTMLElement | null): void {
    for (const s of screens) s.hidden = s !== screen;
  }

  function setBack(label: string, title: string, action: () => void): void {
    backButton.replaceChildren("⬅️", labelled(label));
    backButton.title = title;
    backAction = action;
    toolbar.update();
  }

  function setMode(to: Mode): void {
    window.clearTimeout(winTimer);
    // Free play's playground is saved as it was, and kept out of the way.
    if (mode === "free" && to !== "free") autosave.pause();
    mode = to;
    const page = document.documentElement.classList;
    page.toggle("level-mode", to === "level");
    page.toggle("editor-mode", to === "editor");
    // The path guide would give a level's answer away.
    guides.showPath = to !== "level";
    input.cancel();
    effects.clear();
    toolbar.setEditing(to === "editor");
  }

  // The front screen: Levels (with the hearts won so far) or Free play.
  function showFront(): void {
    const progress = saves.loadProgress();
    const won = LEVELS.reduce((n, level) => n + (progress[level.id] ?? 0), 0);
    const total = LEVELS.reduce((n, level) => n + level.hearts.length, 0);
    $("#hearts-total").textContent = won > 0 ? `♥ ${won} / ${total}` : "";
    show(front);
  }

  // The level map, on one of its tabs.
  function showMap(which: Tab = tab): void {
    tab = which;
    for (const button of map.querySelectorAll<HTMLElement>(".tabs button")) {
      button.classList.toggle("active", button.dataset.tab === tab);
    }
    const tiles = tab === "levels" ? levelTiles() : myLevelTiles();
    map.querySelector(".levels")!.replaceChildren(...tiles);
    map.querySelector(".note")!.textContent =
      tab === "mine" && tiles.length === 1
        ? "Levels you make, and ones friends share with you, go here"
        : "";
    show(map);
  }

  // A tile per level, with the hearts won in it. Each unlocks when the one
  // before is finished.
  function levelTiles(): HTMLElement[] {
    const progress = saves.loadProgress();
    const index = playing && "index" in playing ? playing.index : -1;
    return LEVELS.map((level, i) => {
      const unlocked = i === 0 || LEVELS[i - 1].id in progress;
      const button = levelTile(
        unlocked ? String(i + 1) : "🔒",
        level.name,
        heartRow(progress[level.id] ?? 0, level.hearts.length),
      );
      button.disabled = !unlocked;
      button.classList.toggle("current", i === index);
      button.addEventListener("click", () => startLevel(i));
      return button;
    });
  }

  // Make a level, then a tile for each of My levels, with buttons to edit
  // or delete it.
  function myLevelTiles(): HTMLElement[] {
    const progress = saves.loadProgress();
    const make = levelTile("➕", "Make a level", labelled(""));
    make.addEventListener("click", () => editor?.edit(null));
    const tiles = saves.myLevels().map((mine) => {
      const { level } = mine;
      const button = levelTile(
        level.rider === "sledge" ? "🛷" : "⚽",
        level.name,
        heartRow(progress[level.id] ?? 0, level.hearts.length),
      );
      button.addEventListener("click", () => startMyLevel(mine));
      const edit = smallButton("✏️", "Edit", () => editor?.edit(mine));
      const remove = deleteButton(() => {
        saves.removeLevel(level.id);
        showMap("mine");
      });
      const actions = document.createElement("div");
      actions.className = "actions";
      actions.append(edit, remove);
      const tile = document.createElement("div");
      tile.className = "tile";
      tile.append(button, actions);
      return tile;
    });
    return [make, ...tiles];
  }

  function startLevel(i: number): void {
    const level = LEVELS[i];
    playLevel(
      level,
      { index: i },
      joined(`${i + 1}. ${level.name}`, level.tip),
    );
    setBack("Levels", "Back to the levels", () => showMap("levels"));
  }

  function startMyLevel(mine: MyLevel): void {
    const { level } = mine;
    playLevel(level, { mine }, joined(level.name, level.tip));
    setBack("Levels", "Back to my levels", () => showMap("mine"));
  }

  function playLevel(level: Level, from: Playing, note: string): void {
    setMode("level");
    playing = from;
    play.start(level);
    history.reset();
    toolbar.update();
    toolbar.setNote(note);
    // Home shows the whole level, clear of the toolbar and the hint.
    const toolbarBottom = $("#toolbar").getBoundingClientRect().bottom;
    camera.homeView = {
      box: play.view,
      margins: { top: toolbarBottom + 12, bottom: 70, left: 16, right: 16 },
    };
    camera.home();
    show(null);
  }

  // Back to free play, as it was before.
  function freePlay(): void {
    if (mode !== "free") {
      setMode("free");
      playing = null;
      play.leave();
      playground.loadLayout(saves.loadAutosave() ?? emptyLayout());
      history.reset();
      autosave.resume();
      setBack("Menu", "Back to the menu", showFront);
      toolbar.update();
      toolbar.setNote("");
      camera.homeView = null;
      camera.home();
    }
    show(null);
  }

  function showWin(hearts: number): void {
    const total = play.level?.hearts.length ?? 0;
    win.querySelector("h2")!.textContent =
      hearts === total ? "Every heart!" : "You did it!";
    win.querySelector(".hearts")!.replaceChildren(
      ...Array.from({ length: total }, (_, i) => {
        const heart = document.createElement("span");
        heart.textContent = "♥";
        heart.classList.toggle("won", i < hearts);
        heart.style.animationDelay = `${0.15 + i * 0.25}s`;
        return heart;
      }),
    );
    next.hidden =
      !playing || !("index" in playing) || playing.index === LEVELS.length - 1;
    const trial = playing && "trial" in playing;
    const mine = playing && "mine" in playing;
    winBack.replaceChildren(
      trial ? "🛠️" : "🗺️",
      labelled(trial ? "Edit" : mine ? "My levels" : "Levels"),
    );
    show(win);
  }

  play.onWin = (hearts) => {
    if (!playing) return;
    if ("trial" in playing) {
      playing.trial.won(hearts);
    } else if ("mine" in playing) {
      saves.recordWin(playing.mine.level.id, hearts);
      keepSolution(playing.mine, hearts);
    } else {
      saves.recordWin(LEVELS[playing.index].id, hearts);
    }
    winTimer = window.setTimeout(() => showWin(hearts), WIN_PANEL_DELAY_MS);
  };

  // A level shared with you comes without its solution. Once you've won it
  // with every heart, your winning pieces are kept as its solution, so you
  // can share it on.
  function keepSolution({ level, made }: MyLevel, hearts: number): void {
    const solution = playground.layout();
    if (level.solution || hearts < level.hearts.length) return;
    if (!fitsLimits(solution, level.limits)) return;
    saves.keepLevel({ level: { ...level, solution }, made });
  }

  // Go lets the rider go; once it's going, it takes it back to the start.
  function updateGo(): void {
    go.hidden = play.level === null;
    const going = play.stage !== "building";
    go.replaceChildren(
      going ? "🔄" : "▶️",
      labelled(going ? "Try again" : "Go"),
    );
    go.title = going ? "Back to the start" : "Let the rider go";
    // Its label changes width.
    toolbar.update();
  }
  go.addEventListener("click", () => {
    window.clearTimeout(winTimer);
    if (play.stage === "building") play.go();
    else play.reset();
  });
  play.changed.listen(updateGo);

  backButton.addEventListener("click", () => backAction());
  $("#play-levels").addEventListener("click", () => showMap());
  $("#free-play").addEventListener("click", freePlay);
  map.querySelector(".back")!.addEventListener("click", showFront);
  for (const button of map.querySelectorAll<HTMLElement>(".tabs button")) {
    button.addEventListener("click", () => showMap(button.dataset.tab as Tab));
  }
  win.querySelector(".again")!.addEventListener("click", () => {
    play.reset();
    show(null);
  });
  winBack.addEventListener("click", () => {
    if (playing && "trial" in playing) playing.trial.back();
    else showMap();
  });
  next.addEventListener("click", () => {
    if (playing && "index" in playing) startLevel(playing.index + 1);
  });

  updateGo();
  showFront();

  return {
    get mode() {
      return mode;
    },
    setEditor(e) {
      editor = e;
    },
    enterEditor() {
      setMode("editor");
      playing = null;
      play.leave();
      camera.homeView = null;
    },
    tryLevel(level, trial) {
      playLevel(level, { trial }, joined(`Trying “${level.name}”`, level.tip));
      setBack("Edit", "Back to editing", () => trial.back());
    },
    setBack,
    showFront,
    showMap,
    show,
    addScreen(screen) {
      screens.push(screen);
    },
    addFrontButton(button) {
      front.querySelector(".choices")!.append(button);
    },
  };
}

// Bits of a hint, with a dot between those there are.
function joined(...parts: string[]): string {
  return parts.filter((part) => part).join(" · ");
}

// A tile for a level: its number (or a lock), its name and a row below.
export function levelTile(
  top: string,
  name: string,
  below: HTMLElement,
): HTMLButtonElement {
  const button = document.createElement("button");
  const number = document.createElement("span");
  number.className = "number";
  number.textContent = top;
  const label = labelled(name);
  label.className = "name";
  button.append(number, label, below);
  return button;
}

function smallButton(
  icon: string,
  title: string,
  action: () => void,
): HTMLButtonElement {
  const button = document.createElement("button");
  button.title = title;
  button.textContent = icon;
  button.addEventListener("click", action);
  return button;
}

// Delete takes two taps: the first turns it red.
function deleteButton(remove: () => void): HTMLButtonElement {
  let timer = 0;
  const button = smallButton("🗑️", "Delete (tap twice)", () => {
    if (button.classList.contains("armed")) {
      window.clearTimeout(timer);
      remove();
      return;
    }
    button.classList.add("armed");
    timer = window.setTimeout(
      () => button.classList.remove("armed"),
      DELETE_ARMED_MS,
    );
  });
  return button;
}

// Hearts won out of the level's hearts, like ♥♥♡.
function heartRow(won: number, total: number): HTMLElement {
  const row = document.createElement("span");
  row.className = "heart-row";
  for (let i = 0; i < total; i++) {
    if (i < won) {
      const heart = document.createElement("b");
      heart.textContent = "♥";
      row.append(heart);
    } else {
      row.append("♥");
    }
  }
  return row;
}
