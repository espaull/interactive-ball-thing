// The toolbar: a button per group of tools, their menus, and the hint.
import type { Tool } from "../tools";
import type { Input } from "../tools/input";
import { isMeasured, type Budget } from "../world/budget";

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
    "#toolbar, #tool-menu, #bg-button, #bg-picker, #saves-button, #saves-panel, .screen",
  )) {
    el.addEventListener("mousedown", (e) => e.preventDefault());
  }
}

// The toolbar's tool buttons and the hint, kept up to date.
export interface Toolbar {
  // Show just the tools the budget allows (after its limits change, for a
  // level).
  update(): void;
  // Show how much of each supply is left (after the design changes).
  showSupplies(): void;
  // A line shown above the tool's hint (a level's tip), or "" for none.
  setNote(note: string): void;
  // Offer the level editor's tools too (or not).
  setEditing(editing: boolean): void;
}

// One toolbar button per group of tools (before the divider), and the hint
// at the bottom of the screen for whichever tool is selected. A group button
// shows the tool last picked from it: tapping it picks that tool, and tapping
// it again (while it's selected) opens a menu of the group's other tools.
// Only the tools a level allows are offered, each showing how much of its
// supply is left.
export function setupToolbar(
  groups: Tool[][],
  input: Input,
  budget: Budget,
): Toolbar {
  const toolbar = document.querySelector<HTMLElement>("#toolbar")!;
  const hint = document.querySelector<HTMLElement>("#hint")!;
  // The divider between the tools and the actions (not the one after Back).
  const divider = document.querySelector("#toolbar .divider:not(.minor)")!;
  const menu = document.querySelector<HTMLElement>("#tool-menu")!;
  // The tool each group button currently stands for.
  const chosen = groups.map((group) => group[0]);
  let note = "";
  let editing = false;

  const offered = (tool: Tool) =>
    (!tool.editorOnly || editing) &&
    (!tool.supply || budget.allows(tool.supply));

  const buttons = groups.map((group, g) => {
    const button = document.createElement("button");
    button.addEventListener("click", () => {
      const tool = chosen[g];
      if (
        group.filter(offered).length > 1 &&
        input.tool === tool &&
        menu.hidden
      ) {
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
    render();
    showHint();
    menu.hidden = true;
    // A group button's label may have changed width.
    fitToolbar(toolbar);
  }

  function render(): void {
    buttons.forEach((button, i) => {
      const options = groups[i].filter(offered);
      button.hidden = options.length === 0;
      if (!options.includes(chosen[i]) && options.length > 0) {
        chosen[i] = options[0];
      }
      const shown = chosen[i];
      // "▾" marks the buttons that open a menu.
      const more = options.length > 1 ? " ▾" : "";
      button.replaceChildren(
        shown.icon,
        labelled(shown.label + more),
        ...supplyBadge(shown),
      );
      button.title =
        options.length > 1
          ? `${shown.title} (tap again for more)`
          : shown.title;
      button.classList.toggle("active", shown === input.tool);
    });
  }

  function showHint(): void {
    const tool = input.tool;
    const toolHint = TOUCH ? tool.hints.touch : tool.hints.mouse;
    hint.textContent = note ? `${note}\n${toolHint}` : toolHint;
  }

  // How much of the tool's supply is left, if it's limited: a meter for
  // ink and boost, dots for things counted.
  function supplyBadge(tool: Tool): HTMLElement[] {
    const { supply } = tool;
    if (!supply || !budget.isLimited(supply)) return [];
    const total = budget.limits[supply];
    const inUse = input.tool.supply === supply ? (input.tool.using ?? 0) : 0;
    const left = Math.max(0, budget.left(supply) - inUse);
    const badge = document.createElement("i");
    badge.className = "supply";
    if (isMeasured(supply)) {
      const fill = document.createElement("b");
      fill.style.width = `${(left / total) * 100}%`;
      badge.append(fill);
      badge.classList.toggle("empty", left < 1);
    } else {
      const count = Math.round(left);
      badge.classList.add("count");
      badge.textContent = "●".repeat(count) + "○".repeat(total - count);
      badge.classList.toggle("empty", count === 0);
    }
    return [badge];
  }

  function openMenu(g: number): void {
    menu.replaceChildren(
      ...groups[g].filter(offered).map((tool) => {
        const item = document.createElement("button");
        item.title = tool.title;
        item.append(tool.icon, labelled(tool.label), ...supplyBadge(tool));
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

  return {
    update() {
      menu.hidden = true;
      if (offered(input.tool)) {
        render();
        fitToolbar(toolbar);
      } else {
        // The selected tool isn't allowed here: pick the first that is,
        // preferring one that places something the level gives you.
        const tools = groups.flat().filter(offered);
        select(tools.find((tool) => tool.supply) ?? tools[0] ?? groups[0][0]);
      }
    },
    showSupplies: render,
    setEditing(on) {
      editing = on;
      this.update();
    },
    setNote(text) {
      note = text;
      showHint();
    },
  };
}

export function labelled(text: string): HTMLSpanElement {
  const span = document.createElement("span");
  span.textContent = text;
  return span;
}
