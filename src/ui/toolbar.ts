// The toolbar: a button per group of tools, their menus, and the hint.
import type { Tool } from "../tools";
import type { Input } from "../tools/input";

// Touchscreens have no Space key or Enter, so they get simpler hints.
const TOUCH = window.matchMedia("(hover: none)").matches;
// Smaller and smaller toolbars (see style.css), tried in turn until one fits.
const SIZES = ["toolbar-compact", "toolbar-tight", "toolbar-rows"];
// Space kept either side of the toolbar (CSS pixels).
const SIDE_GAP_PX = 16;

// Make the toolbar as big as fits across the screen. Measured rather than
// set by screen width, as its width depends on its buttons (and their
// labels change as tools are picked from the menus).
function fitToolbar(toolbar: HTMLElement): void {
  const page = document.documentElement.classList;
  page.remove(...SIZES);
  for (const size of SIZES) {
    if (toolbar.offsetWidth <= window.innerWidth - SIDE_GAP_PX * 2) return;
    page.add(size);
  }
}

// Keep focus off the buttons, so Space and Enter never "press" one.
export function keepFocusOffButtons(): void {
  for (const el of document.querySelectorAll(
    "#toolbar, #tool-menu, #bg-button, #bg-picker, #saves-button, #saves-panel",
  )) {
    el.addEventListener("mousedown", (e) => e.preventDefault());
  }
}

// One toolbar button per group of tools (before the divider), and the hint
// at the bottom of the screen for whichever tool is selected. A group button
// shows the tool last picked from it: tapping it picks that tool, and tapping
// it again (while it's selected) opens a menu of the group's other tools.
export function setupToolbar(groups: Tool[][], input: Input): void {
  const toolbar = document.querySelector<HTMLElement>("#toolbar")!;
  const hint = document.querySelector<HTMLElement>("#hint")!;
  const divider = document.querySelector("#toolbar .divider")!;
  const menu = document.querySelector<HTMLElement>("#tool-menu")!;
  // The tool each group button currently stands for.
  const chosen = groups.map((group) => group[0]);

  const buttons = groups.map((group, g) => {
    const button = document.createElement("button");
    button.addEventListener("click", () => {
      const tool = chosen[g];
      if (group.length > 1 && input.tool === tool && menu.hidden) {
        openMenu(g);
      } else {
        select(tool);
      }
    });
    divider.before(button);
    return button;
  });

  function select(tool: Tool): void {
    input.setTool(tool);
    const g = groups.findIndex((group) => group.includes(tool));
    chosen[g] = tool;
    buttons.forEach((button, i) => {
      const group = groups[i];
      const shown = chosen[i];
      // "▾" marks the buttons that open a menu.
      const more = group.length > 1 ? " ▾" : "";
      button.replaceChildren(shown.icon, labelled(shown.label + more));
      button.title =
        group.length > 1 ? `${shown.title} (tap again for more)` : shown.title;
      button.classList.toggle("active", i === g);
    });
    hint.textContent = TOUCH ? tool.hints.touch : tool.hints.mouse;
    menu.hidden = true;
    // A group button's label may have changed width.
    fitToolbar(toolbar);
  }

  function openMenu(g: number): void {
    menu.replaceChildren(
      ...groups[g].map((tool) => {
        const item = document.createElement("button");
        item.title = tool.title;
        item.append(tool.icon, labelled(tool.label));
        item.classList.toggle("active", tool === input.tool);
        item.addEventListener("click", () => select(tool));
        return item;
      }),
    );
    menu.hidden = false;
    // Just below its button, kept on screen.
    const anchor = buttons[g].getBoundingClientRect();
    const width = menu.offsetWidth;
    const left = anchor.left + anchor.width / 2 - width / 2;
    menu.style.left = `${Math.max(16, Math.min(left, innerWidth - 16 - width))}px`;
    menu.style.top = `${anchor.bottom + 8}px`;
  }

  // A tap on the canvas while the menu is open just closes it, without also
  // using the tool. (Capturing, so this runs before the tool's own handler.)
  document.querySelector("#stage")!.addEventListener(
    "pointerdown",
    (e) => {
      if (menu.hidden) return;
      menu.hidden = true;
      e.stopImmediatePropagation();
    },
    { capture: true },
  );

  select(chosen[0]);
  window.addEventListener("resize", () => fitToolbar(toolbar));
  // The emoji font can arrive after the first fit, changing the widths.
  void document.fonts?.ready.then(() => fitToolbar(toolbar));
}

export function labelled(text: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}
