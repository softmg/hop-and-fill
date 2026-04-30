import { Container, Graphics } from "pixi.js";
import { TILE_H, TILE_W, gridToScreen, isoZ } from "./iso";
import type { Palette } from "./theme";

const HOP_DURATION = 280; // ms
const HOP_HEIGHT = 80;

export class Player {
  readonly container: Container;
  private body: Graphics;
  private shadow: Graphics;
  gx: number;
  gy: number;
  private animating = false;
  private squash = 1;

  constructor(gx: number, gy: number, private palette: Palette) {
    this.gx = gx;
    this.gy = gy;
    this.container = new Container();
    this.shadow = new Graphics();
    this.body = new Graphics();
    this.container.addChild(this.shadow, this.body);
    this.drawShadow();
    this.drawBody();
    this.snapTo(gx, gy);
  }

  get isAnimating() {
    return this.animating;
  }

  private drawShadow() {
    this.shadow.clear();
    this.shadow.beginFill(this.palette.playerShadow, 0.35);
    this.shadow.drawEllipse(0, 0, TILE_W * 0.28, TILE_H * 0.28);
    this.shadow.endFill();
  }

  private drawBody() {
    const p = this.palette;
    this.body.clear();
    // Пого-стик (вертикальная палка)
    this.body.beginFill(p.playerStick);
    this.body.drawRect(-3, -34, 6, 30);
    this.body.endFill();
    // Пружина
    this.body.beginFill(p.playerSpring);
    this.body.drawRect(-6, -8, 12, 6);
    this.body.endFill();
    // Тело-шар
    this.body.beginFill(p.playerBody);
    this.body.drawCircle(0, -52, 18);
    this.body.endFill();
    // Глаза
    this.body.beginFill(0xffffff);
    this.body.drawCircle(-6, -54, 4);
    this.body.drawCircle(6, -54, 4);
    this.body.endFill();
    this.body.beginFill(0x111111);
    this.body.drawCircle(-6, -54, 2);
    this.body.drawCircle(6, -54, 2);
    this.body.endFill();
  }

  snapTo(gx: number, gy: number) {
    this.gx = gx;
    this.gy = gy;
    const { x, y } = gridToScreen(gx, gy);
    // ставим в центр верхней грани плитки (gridToScreen уже даёт центр верха)
    this.container.position.set(x, y);
    this.container.zIndex = isoZ(gx, gy, 50);
  }

  // Анимация прыжка между плитками. onLand вызывается в момент приземления
  // (даже если приземления нет — летит в пустоту).
  hop(targetGx: number, targetGy: number, onLand: () => void, onSettle: () => void) {
    if (this.animating) return;
    this.animating = true;

    const startScreen = gridToScreen(this.gx, this.gy);
    const endScreen = gridToScreen(targetGx, targetGy);
    const startY = startScreen.y;
    const endY = endScreen.y;
    const startX = startScreen.x;
    const endX = endScreen.x;

    const t0 = performance.now();
    const fromGx = this.gx;
    const fromGy = this.gy;

    // Сразу обновляем grid-позицию (логика идёт впереди визуала)
    this.gx = targetGx;
    this.gy = targetGy;

    const tick = () => {
      const elapsed = performance.now() - t0;
      const t = Math.min(1, elapsed / HOP_DURATION);
      const ease = t;
      const x = startX + (endX - startX) * ease;
      const y = startY + (endY - startY) * ease;
      const arc = -Math.sin(t * Math.PI) * HOP_HEIGHT;
      // Контейнер следует по земле (без арки) — тень всегда под целевой клеткой по траектории
      this.container.position.set(x, y);
      // Тело прыгает вверх отдельно, тень остаётся на земле (y=0 в локальных координатах)
      this.body.y = arc;

      // squash на старте/приземлении
      const sq = 1 + Math.sin(t * Math.PI) * 0.1;
      this.body.scale.set(1 / sq, sq);

      // Z-index плавно: используем максимум из from/to чтобы не нырять под плитки
      const zFrom = isoZ(fromGx, fromGy, 50);
      const zTo = isoZ(targetGx, targetGy, 50);
      this.container.zIndex = Math.max(zFrom, zTo);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        this.body.y = 0;
        this.body.scale.set(1, 1);
        onLand();
        // микро-сжатие при посадке
        const t1 = performance.now();
        const settle = () => {
          const e = (performance.now() - t1) / 120;
          if (e >= 1) {
            this.body.scale.set(1, 1);
            this.animating = false;
            onSettle();
            return;
          }
          const s = 1 - Math.sin(e * Math.PI) * 0.18;
          this.body.scale.set(1 / s, s);
          requestAnimationFrame(settle);
        };
        requestAnimationFrame(settle);
      }
    };
    requestAnimationFrame(tick);
  }

  // Падение в пустоту — летит вниз, исчезает
  fall(targetGx: number, targetGy: number, onDone: () => void) {
    if (this.animating) return;
    this.animating = true;
    const startScreen = gridToScreen(this.gx, this.gy);
    const endScreen = gridToScreen(targetGx, targetGy);
    const startY = startScreen.y + TILE_H / 2;
    const startX = startScreen.x;
    const endX = endScreen.x;
    const t0 = performance.now();
    const DURATION = 600;
    const tick = () => {
      const elapsed = performance.now() - t0;
      const t = Math.min(1, elapsed / DURATION);
      const x = startX + (endX - startX) * t;
      // парабола вниз: летит вверх немного, потом падает далеко
      const arc = -Math.sin(t * Math.PI * 0.5) * 40 + t * t * 600;
      this.container.position.set(x, startY + arc);
      this.container.alpha = 1 - Math.max(0, t - 0.6) / 0.4;
      if (t < 1) requestAnimationFrame(tick);
      else {
        this.animating = false;
        onDone();
      }
    };
    requestAnimationFrame(tick);
  }

  resetVisual() {
    this.container.alpha = 1;
    this.body.scale.set(1, 1);
  }
}
