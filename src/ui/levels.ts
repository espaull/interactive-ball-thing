// The menus (the front screen, the level map and the win panel), the Go
// and Back buttons, and switching between free play and a level.
import type { App } from "../app";
import { LEVELS } from "../levels/levels";
import { emptyLayout } from "../world/layout";
import { labelled } from "./toolbar";

// How long after winning (ms) before the win panel comes up, so the
// confetti can be seen first.
const WIN_PANEL_DELAY_MS = 1200;

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
}: App): void {
  const $ = <T extends HTMLElement>(selector: string) =>
    document.querySelector<T>(selector)!;
  const front = $("#front");
  const map = $("#level-map");
  const win = $("#win");
  const back = $<HTMLButtonElement>("#back");
  const go = $<HTMLButtonElement>("#go");
  const next = win.querySelector<HTMLButtonElement>(".next")!;
  // The level being played, or -1 in free play.
  let index = -1;
  let winTimer = 0;

  function showOnly(screen: HTMLElement | null): void {
    for (const s of [front, map, win]) s.hidden = s !== screen;
  }

  // The front screen: Levels (with the hearts won so far) or Free play.
  function showFront(): void {
    const progress = saves.loadProgress();
    const won = LEVELS.reduce((n, level) => n + (progress[level.id] ?? 0), 0);
    const total = LEVELS.reduce((n, level) => n + level.hearts.length, 0);
    $("#hearts-total").textContent = won > 0 ? `♥ ${won} / ${total}` : "";
    showOnly(front);
  }

  // A tile per level, with the hearts won in it. Each unlocks when the one
  // before is finished.
  function showMap(): void {
    const progress = saves.loadProgress();
    const tiles = LEVELS.map((level, i) => {
      const unlocked = i === 0 || LEVELS[i - 1].id in progress;
      const button = document.createElement("button");
      const number = document.createElement("span");
      number.className = "number";
      number.textContent = unlocked ? String(i + 1) : "🔒";
      const name = labelled(level.name);
      name.className = "name";
      button.append(
        number,
        name,
        heartRow(progress[level.id] ?? 0, level.hearts.length),
      );
      button.disabled = !unlocked;
      button.classList.toggle("current", i === index);
      button.addEventListener("click", () => startLevel(i));
      return button;
    });
    map.querySelector(".levels")!.replaceChildren(...tiles);
    showOnly(map);
  }

  function startLevel(i: number): void {
    window.clearTimeout(winTimer);
    if (index === -1) {
      // Free play's playground is saved as it was, and kept out of the way.
      autosave.pause();
      document.documentElement.classList.add("level-mode");
      guides.showPath = false;
      back.replaceChildren("⬅️", labelled("Levels"));
      back.title = "Back to the levels";
    }
    index = i;
    const level = LEVELS[i];
    input.cancel();
    effects.clear();
    play.start(level);
    history.reset();
    toolbar.update();
    toolbar.setNote(`${i + 1}. ${level.name} · ${level.tip}`);
    // Home shows the whole level, clear of the toolbar and the hint.
    const toolbarBottom = $("#toolbar").getBoundingClientRect().bottom;
    camera.homeView = {
      box: play.view,
      margins: { top: toolbarBottom + 12, bottom: 70, sides: 16 },
    };
    camera.home();
    showOnly(null);
  }

  // Back to free play, as it was before the levels.
  function freePlay(): void {
    if (index !== -1) {
      window.clearTimeout(winTimer);
      index = -1;
      input.cancel();
      effects.clear();
      play.leave();
      playground.loadLayout(saves.loadAutosave() ?? emptyLayout());
      history.reset();
      autosave.resume();
      document.documentElement.classList.remove("level-mode");
      guides.showPath = true;
      back.replaceChildren("⬅️", labelled("Menu"));
      back.title = "Back to the menu";
      toolbar.update();
      toolbar.setNote("");
      camera.homeView = null;
      camera.home();
    }
    showOnly(null);
  }

  function showWin(hearts: number): void {
    const total = LEVELS[index].hearts.length;
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
    next.hidden = index === LEVELS.length - 1;
    showOnly(win);
  }

  play.onWin = (hearts) => {
    saves.recordWin(LEVELS[index].id, hearts);
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

  back.addEventListener("click", () =>
    index === -1 ? showFront() : showMap(),
  );
  $("#play-levels").addEventListener("click", showMap);
  $("#free-play").addEventListener("click", freePlay);
  map.querySelector(".back")!.addEventListener("click", showFront);
  win.querySelector(".again")!.addEventListener("click", () => {
    play.reset();
    showOnly(null);
  });
  win.querySelector(".levels-button")!.addEventListener("click", showMap);
  next.addEventListener("click", () => startLevel(index + 1));

  updateGo();
  showFront();
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
