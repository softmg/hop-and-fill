import type { Dir } from "./iso";

type Handler = (dir: Dir) => void;

type BoardDir = Extract<Dir, "N" | "E" | "S" | "W">;
type DiagonalDir = Extract<Dir, "NE" | "NW" | "SE" | "SW">;

export type KeyboardRotation = "default" | "counterclockwise";

export const BOARD_COMBO_DEBOUNCE_MS = 120;
export const TOUCH_MIN_DISTANCE = 24;

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

const SCREEN_DIRS_CLOCKWISE: Dir[] = ["NW", "N", "NE", "E", "SE", "S", "SW", "W"];

export function keyToDir(key: string): Dir | null {
  return ARROW_KEY_TO_DIR[key] ?? BOARD_KEY_TO_DIR[key] ?? null;
}

export function rotateKeyboardDir(dir: Dir, rotation: KeyboardRotation): Dir {
  if (rotation === "default") return dir;

  const index = SCREEN_DIRS_CLOCKWISE.indexOf(dir);
  return SCREEN_DIRS_CLOCKWISE[(index + SCREEN_DIRS_CLOCKWISE.length - 2) % SCREEN_DIRS_CLOCKWISE.length];
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

const SCREEN_VECTOR_DIRS: Dir[] = ["NE", "E", "SE", "S", "SW", "W", "NW", "N"];

export function screenVectorToDir(dx: number, dy: number, minDistance = TOUCH_MIN_DISTANCE): Dir | null {
  if (Math.hypot(dx, dy) < minDistance) return null;

  const sector = Math.round(Math.atan2(dy, dx) / (Math.PI / 4));
  return SCREEN_VECTOR_DIRS[(sector + SCREEN_VECTOR_DIRS.length) % SCREEN_VECTOR_DIRS.length];
}

function isDiagonalDir(dir: Dir): dir is DiagonalDir {
  return dir === "NE" || dir === "NW" || dir === "SE" || dir === "SW";
}

export class Input {
  private handler: Handler;
  private keyboardRotation: KeyboardRotation;
  private touchStart: { x: number; y: number } | null = null;
  private el: HTMLElement;
  private activeBoardKeys = new Set<BoardDir>();
  private lastBoardDir: Dir | null = null;
  private pendingBoardDir: BoardDir | null = null;
  private boardComboTimer: number | null = null;

  constructor(el: HTMLElement, handler: Handler, options: { keyboardRotation?: KeyboardRotation } = {}) {
    this.el = el;
    this.handler = handler;
    this.keyboardRotation = options.keyboardRotation ?? "default";
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

  setKeyboardRotation(rotation: KeyboardRotation) {
    if (this.keyboardRotation === rotation) return;
    this.keyboardRotation = rotation;
    this.clearBoardKeys();
  }

  private emitKeyboardDir(dir: Dir) {
    this.handler(rotateKeyboardDir(dir, this.keyboardRotation));
  }

  private onKey = (e: KeyboardEvent) => {
    const arrowDir = ARROW_KEY_TO_DIR[e.key];
    if (arrowDir) {
      e.preventDefault();
      this.emitKeyboardDir(arrowDir);
      return;
    }

    const boardDir = BOARD_KEY_TO_DIR[e.key];
    if (!boardDir) return;

    e.preventDefault();
    this.activeBoardKeys.add(boardDir);
    const dir = resolveBoardKeyDir(this.activeBoardKeys);
    this.handleBoardDir(dir, e.repeat);
  };

  private handleBoardDir(dir: Dir | null, isRepeat: boolean) {
    if (!dir) {
      this.clearPendingBoardDir();
      this.lastBoardDir = null;
      return;
    }

    if (isDiagonalDir(dir)) {
      this.clearPendingBoardDir();
      if (isRepeat || dir !== this.lastBoardDir) {
        this.emitKeyboardDir(dir);
      }
      this.lastBoardDir = dir;
      return;
    }

    if (isRepeat) {
      if (this.pendingBoardDir) return;
      this.emitKeyboardDir(dir);
      this.lastBoardDir = dir;
      return;
    }

    if (dir === this.lastBoardDir && !this.pendingBoardDir) return;

    this.scheduleBoardDir(dir);
    this.lastBoardDir = dir;
  }

  private onKeyUp = (e: KeyboardEvent) => {
    const boardDir = BOARD_KEY_TO_DIR[e.key];
    if (!boardDir) return;
    e.preventDefault();

    const dirBeforeRelease = resolveBoardKeyDir(this.activeBoardKeys);
    if (this.pendingBoardDir && dirBeforeRelease === this.pendingBoardDir) {
      this.flushPendingBoardDir();
    }

    this.activeBoardKeys.delete(boardDir);
    this.lastBoardDir = resolveBoardKeyDir(this.activeBoardKeys);
  };

  private onBlur = () => {
    this.clearBoardKeys();
  };

  private clearBoardKeys() {
    this.activeBoardKeys.clear();
    this.lastBoardDir = null;
    this.clearPendingBoardDir();
  }

  private scheduleBoardDir(dir: BoardDir) {
    this.clearPendingBoardDir();
    this.pendingBoardDir = dir;
    this.boardComboTimer = window.setTimeout(() => {
      this.boardComboTimer = null;
      if (this.pendingBoardDir !== dir) return;

      const currentDir = resolveBoardKeyDir(this.activeBoardKeys);
      this.pendingBoardDir = null;
      if (currentDir === dir) {
        this.emitKeyboardDir(dir);
      }
    }, BOARD_COMBO_DEBOUNCE_MS);
  }

  private flushPendingBoardDir() {
    const dir = this.pendingBoardDir;
    if (!dir) return;
    this.clearPendingBoardDir();
    this.emitKeyboardDir(dir);
    this.lastBoardDir = dir;
  }

  private clearPendingBoardDir() {
    if (this.boardComboTimer !== null) {
      window.clearTimeout(this.boardComboTimer);
      this.boardComboTimer = null;
    }
    this.pendingBoardDir = null;
  }

  private onTouchStart = (e: TouchEvent) => {
    const t = e.touches[0];
    if (!t) return;
    this.touchStart = { x: t.clientX, y: t.clientY };
  };

  private onTouchEnd = (e: TouchEvent) => {
    if (!this.touchStart) return;
    const t = e.changedTouches[0];
    if (!t) return;
    const dx = t.clientX - this.touchStart.x;
    const dy = t.clientY - this.touchStart.y;
    this.touchStart = null;
    const dir = screenVectorToDir(dx, dy);
    if (dir) this.handler(dir);
  };
}
