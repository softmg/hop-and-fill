import { Container, Graphics, Sprite, Texture } from "pixi.js";
import { TILE_H, TILE_W, gridToScreen, isoZ } from "./iso";
import type { Palette } from "./theme";
import playerUrl from "@/assets/player.png";

const HOP_DURATION = 280; // ms
const HOP_HEIGHT = 80;

let _texPlayer: Texture | null = null;
function getPlayerTexture() {
  if (!_texPlayer) _texPlayer = Texture.from(playerUrl);
  return _texPlayer;
}

export class Player {
  readonly container: Container;
  private body: Sprite;
  private shadow: Graphics;
  gx: number;
  gy: number;
  private animating = false;

  constructor(gx: number, gy: number, private palette: Palette) {
    this.gx = gx;
    this.gy = gy;
    this.container = new Container();

    this.shadow = new Graphics();
    this.drawShadow();

    this.body = new Sprite(getPlayerTexture());
    // Якорь: горизонтально по центру, по вертикали — у "ног" персонажа
    this.body.anchor.set(0.5, 0.92);
    // Размер: чуть меньше плитки по ширине
    const targetW = TILE_W * 0.92;
    this.body.width = targetW;
    this.body.scale.y = this.body.scale.x;

    this.container.addChild(this.shadow, this.body);
    this.snapTo(gx, gy);
  }

  get isAnimating() {
    return this.animating;
  }

  private drawShadow() {
    this.shadow.clear();
    this.shadow.beginFill(0x000000, 0.22);
    this.shadow.drawEllipse(0, 0, TILE_W * 0.32, TILE_H * 0.28);
    this.shadow.endFill();
  }

  snapTo(gx: number, gy: number) {
    this.gx = gx;
    this.gy = gy;
    const { x, y } = gridToScreen(gx, gy);
    this.container.position.set(x, y + TILE_H / 2);
    this.container.zIndex = isoZ(gx, gy, 50);
  }

  hop(targetGx: number, targetGy: number, onLand: () => void, onSettle: () => void) {
    if (this.animating) return;
    this.animating = true;

    const startScreen = gridToScreen(this.gx, this.gy);
    const endScreen = gridToScreen(targetGx, targetGy);
    const startY = startScreen.y + TILE_H / 2;
    const endY = endScreen.y + TILE_H / 2;
    const startX = startScreen.x;
    const endX = endScreen.x;

    const t0 = performance.now();
    const fromGx = this.gx;
    const fromGy = this.gy;
    const baseScaleX = this.body.scale.x;
    const baseScaleY = this.body.scale.y;

    this.gx = targetGx;
    this.gy = targetGy;

    const tick = () => {
      const elapsed = performance.now() - t0;
      const t = Math.min(1, elapsed / HOP_DURATION);
      const x = startX + (endX - startX) * t;
      const y = startY + (endY - startY) * t;
      const arc = -Math.sin(t * Math.PI) * HOP_HEIGHT;

      this.container.position.set(x, y);
      this.body.y = arc;

      const sq = 1 + Math.sin(t * Math.PI) * 0.08;
      this.body.scale.set(baseScaleX / sq, baseScaleY * sq);

      const zFrom = isoZ(fromGx, fromGy, 50);
      const zTo = isoZ(targetGx, targetGy, 50);
      this.container.zIndex = Math.max(zFrom, zTo);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        this.body.y = 0;
        this.body.scale.set(baseScaleX, baseScaleY);
        onLand();
        const t1 = performance.now();
        const settle = () => {
          const e = (performance.now() - t1) / 140;
          if (e >= 1) {
            this.body.scale.set(baseScaleX, baseScaleY);
            this.animating = false;
            onSettle();
            return;
          }
          const s = 1 - Math.sin(e * Math.PI) * 0.16;
          this.body.scale.set(baseScaleX / s, baseScaleY * s);
          requestAnimationFrame(settle);
        };
        requestAnimationFrame(settle);
      }
    };
    requestAnimationFrame(tick);
  }

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
  }
}
