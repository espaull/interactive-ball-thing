// The menus (the front screen, the level map and the win panel), the Go
// and Back buttons, and switching between free play, levels and the level
// editor.
import type { App } from "../app";
import type { Level } from "../levels/level";
import { LEVELS } from "../levels/levels";
import { emptyLayout } from "../world/layout";
import { labelled } from "./toolbar";

// How long after winning (ms) before the win panel comes up, so the
// confetti can be seen first.
const WIN_PANEL_DELAY_MS = 1200;

export type Mode = "free" | "level" | "editor";

// The editor trying out the level it's making.
export interface Trial {
  // It was won, with this many hearts. (The player's pieces are still in
  // the playground.)
  won(hearts: number): void;
  // Back to editing.
  back(): void;
}

// What the editor (ui/editor.ts) uses.
export interface LevelScreens {
  readonly mode: Mode;
  // Leave free play or a level (keeping free play saved) for the editor.
  enterEditor(): void;
  tryLevel(level: Level, trial: Trial): void;
  // What the toolbar's Back button says (and its tooltip) and does.
  setBack(label: string, title: string, action: () => void): void;
  showFront(): void;
  // Show one of the menu screens (including ones the editor adds), or none.
  show(screen: HTMLElement | null): void;
  addScreen(screen: HTMLElement): void;
  addFrontButton(button: HTMLButtonElement): void;
}

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
  // The level being played: one of LEVELS (by index), or the editor's.
  let playing: { index: number } | { trial: Trial } | null = null;
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

  // A tile per level, with the hearts won in it. Each unlocks when the one
  // before is finished.
  function showMap(): void {
    const progress = saves.loadProgress();
    const index = playing && "index" in playing ? playing.index : -1;
    const tiles = LEVELS.map((level, i) => {
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
    map.querySelector(".levels")!.replaceChildren(...tiles);
    show(map);
  }

  function startLevel(i: number): void {
    const level = LEVELS[i];
    playLevel(
      level,
      { index: i },
      joined(`${i + 1}. ${level.name}`, level.tip),
    );
    setBack("Levels", "Back to the levels", showMap);
  }

  function playLevel(
    level: Level,
    from: { index: number } | { trial: Trial },
    note: string,
  ): void {
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
    const trial = playing && "trial" in playing;
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
      !playing || "trial" in playing || playing.index === LEVELS.length - 1;
    winBack.replaceChildren(
      trial ? "🛠️" : "🗺️",
      labelled(trial ? "Edit" : "Levels"),
    );
    show(win);
  }

  play.onWin = (hearts) => {
    if (!playing) return;
    if ("trial" in playing) playing.trial.won(hearts);
    else saves.recordWin(LEVELS[playing.index].id, hearts);
    winTimer = window.setTimeout(() => showWin(hearts), WIN_PANEL_DELAY_MS);
  };

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
  $("#play-levels").addEventListener("click", showMap);
  $("#free-play").addEventListener("click", freePlay);
  map.querySelector(".back")!.addEventListener("click", showFront);
  win.querySelector(".again")!.addEventListener("click", () => {
    play.reset();
    show(null);
  });
  winBack.addEventListener("click", () =>
    playing && "trial" in playing ? playing.trial.back() : showMap(),
  );
  next.addEventListener("click", () => {
    if (playing && "index" in playing) startLevel(playing.index + 1);
  });

  updateGo();
  showFront();

  return {
    get mode() {
      return mode;
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
