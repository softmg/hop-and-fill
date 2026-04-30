import type { Dir } from "./iso";

type Handler = (dir: Dir) => void;

export class Input {
  private handler: Handler;
  private touchStart: { x: number; y: number; t: number } | null = null;
  private el: HTMLElement;

  constructor(el: HTMLElement, handler: Handler) {
    this.el = el;
    this.handler = handler;
    window.addEventListener("keydown", this.onKey);
    el.addEventListener("touchstart", this.onTouchStart, { passive: true });
    el.addEventListener("touchend", this.onTouchEnd, { passive: true });
  }

  destroy() {
    window.removeEventListener("keydown", this.onKey);
    this.el.removeEventListener("touchstart", this.onTouchStart);
    this.el.removeEventListener("touchend", this.onTouchEnd);
  }

  emit(dir: Dir) {
    this.handler(dir);
  }

  private onKey = (e: KeyboardEvent) => {
    let dir: Dir | null = null;
    switch (e.key) {
      case "ArrowUp": case "w": case "W": case "ц": case "Ц": dir = "NW"; break;
      case "ArrowDown": case "s": case "S": case "ы": case "Ы": dir = "SE"; break;
      case "ArrowLeft": case "a": case "A": case "ф": case "Ф": dir = "SW"; break;
      case "ArrowRight": case "d": case "D": case "в": case "В": dir = "NE"; break;
    }
    if (dir) {
      e.preventDefault();
      this.handler(dir);
    }
  };

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
