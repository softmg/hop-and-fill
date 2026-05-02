import type { Dir } from "./iso";

type Handler = (dir: Dir) => void;

type BoardDir = Extract<Dir, "N" | "E" | "S" | "W">;

const ARROW_KEY_TO_DIR: Record<string, Extract<Dir, "NE" | "NW" | "SE" | "SW">> = {
  ArrowUp: "NW",
  ArrowDown: "SE",
  ArrowLeft: "SW",
  ArrowRight: "NE",
};

const BOARD_KEY_TO_DIR: Record<string, BoardDir> = {
  w: "N",
  W: "N",
  ц: "N",
  Ц: "N",
  d: "E",
  D: "E",
  в: "E",
  В: "E",
  s: "S",
  S: "S",
  ы: "S",
  Ы: "S",
  a: "W",
  A: "W",
  ф: "W",
  Ф: "W",
};

export function keyToDir(key: string): Dir | null {
  return ARROW_KEY_TO_DIR[key] ?? BOARD_KEY_TO_DIR[key] ?? null;
}

export function resolveBoardKeyDir(keys: Iterable<BoardDir>): Dir | null {
  const active = new Set(keys);
  const vertical = active.has("N")
    ? active.has("S") ? null : "N"
    : active.has("S") ? "S" : null;
  const horizontal = active.has("E")
    ? active.has("W") ? null : "E"
    : active.has("W") ? "W" : null;

  if (vertical === null && (active.has("N") || active.has("S"))) return null;
  if (horizontal === null && (active.has("E") || active.has("W"))) return null;
  if (vertical && horizontal) return `${vertical}${horizontal}` as Extract<Dir, "NE" | "NW" | "SE" | "SW">;
  return vertical ?? horizontal;
}

export class Input {
  private handler: Handler;
  private touchStart: { x: number; y: number; t: number } | null = null;
  private el: HTMLElement;
  private activeBoardKeys = new Set<BoardDir>();
  private lastBoardDir: Dir | null = null;

  constructor(el: HTMLElement, handler: Handler) {
    this.el = el;
    this.handler = handler;
    window.addEventListener("keydown", this.onKey);
    window.addEventListener("keyup", this.onKeyUp);
    window.addEventListener("blur", this.onBlur);
    el.addEventListener("touchstart", this.onTouchStart, { passive: true });
    el.addEventListener("touchend", this.onTouchEnd, { passive: true });
  }

  destroy() {
    window.removeEventListener("keydown", this.onKey);
    window.removeEventListener("keyup", this.onKeyUp);
    window.removeEventListener("blur", this.onBlur);
    this.el.removeEventListener("touchstart", this.onTouchStart);
    this.el.removeEventListener("touchend", this.onTouchEnd);
    this.clearBoardKeys();
  }

  emit(dir: Dir) {
    this.handler(dir);
  }

  private onKey = (e: KeyboardEvent) => {
    const arrowDir = ARROW_KEY_TO_DIR[e.key];
    if (arrowDir) {
      e.preventDefault();
      this.handler(arrowDir);
      return;
    }

    const boardDir = BOARD_KEY_TO_DIR[e.key];
    if (!boardDir) return;

    e.preventDefault();
    this.activeBoardKeys.add(boardDir);
    const dir = resolveBoardKeyDir(this.activeBoardKeys);
    if (dir && (e.repeat || dir !== this.lastBoardDir)) {
      this.handler(dir);
    }
    this.lastBoardDir = dir;
  };

  private onKeyUp = (e: KeyboardEvent) => {
    const boardDir = BOARD_KEY_TO_DIR[e.key];
    if (!boardDir) return;
    this.activeBoardKeys.delete(boardDir);
    this.lastBoardDir = resolveBoardKeyDir(this.activeBoardKeys);
  };

  private onBlur = () => {
    this.clearBoardKeys();
  };

  private clearBoardKeys() {
    this.activeBoardKeys.clear();
    this.lastBoardDir = null;
  }

  private onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    this.touchStart = { x: t.clientX, y: t.clientY, t: performance.now() };
  };

  private onTouchEnd = (e: TouchEvent) => {
    if (!this.touchStart) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - this.touchStart.x;
    const dy = t.clientY - this.touchStart.y;
    const dist = Math.hypot(dx, dy);
    this.touchStart = null;
    if (dist < 24) return;
    let dir: Dir;
    if (Math.abs(dx) > Math.abs(dy)) {
      dir = dx > 0 ? "NE" : "SW";
    } else {
      dir = dy > 0 ? "SE" : "NW";
    }
    this.handler(dir);
  };
}
