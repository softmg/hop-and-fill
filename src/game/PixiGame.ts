import { Application, Container, Graphics, FederatedPointerEvent } from "pixi.js";
import { Level, type LevelData } from "./Level";
import { Player } from "./Player";
import { Input } from "./Input";
import { dirToDelta, gridToScreen, screenToGrid, TILE_H, type Dir } from "./iso";
import { colors, type Palette } from "./theme";

export interface GameCallbacks {
  onHopCount: (n: number) => void;
  onWin: (hops: number) => void;
  onLose: () => void;
}

export class PixiGame {
  app: Application;
  private world: Container;
  private bg: Graphics;
  private level!: Level;
  private player!: Player;
  private input!: Input;
  private palette: Palette;
  private hops = 0;
  private moveLimit: number | null = null;
  private state: "playing" | "won" | "lost" = "playing";
  private currentLevelData: LevelData;
  private hoveredTile: { gx: number; gy: number } | null = null;

  constructor(
    private host: HTMLDivElement,
    levelData: LevelData,
    private cb: GameCallbacks,
  ) {
    this.currentLevelData = levelData;
    this.palette = colors();

    this.app = new Application({
      resizeTo: host,
      backgroundAlpha: 0,
      antialias: true,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    host.appendChild(this.app.view as HTMLCanvasElement);

    this.bg = new Graphics();
    this.world = new Container();
    this.world.sortableChildren = true;
    this.app.stage.addChild(this.bg, this.world);

    this.buildLevel(levelData);
    this.input = new Input(host, this.handleDir);
    this.app.renderer.on("resize", this.layout);

    // Мышь: hover + клик. Используем eventMode на stage.
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on("pointermove", this.onPointerMove);
    this.app.stage.on("pointerdown", this.onPointerDown);
    this.app.stage.on("pointerleave", this.onPointerLeave);

    this.layout();
    // Хост может ещё не иметь финальный размер на момент конструктора
    // (особенно при первой загрузке). Перепроверяем размер в следующих кадрах.
    requestAnimationFrame(() => {
      this.app.resize();
      this.layout();
    });
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        this.app.resize();
        this.layout();
      });
    });
  }

  private screenPointToGrid(globalX: number, globalY: number) {
    // Переводим из stage-координат в world-координаты
    const local = this.world.toLocal({ x: globalX, y: globalY });
    const { gx, gy } = screenToGrid(local.x, local.y);
    return { gx: Math.round(gx), gy: Math.round(gy) };
  }

  // Возвращает направление, если (gx, gy) — одна из 8 соседних плиток, иначе null
  private dirToNeighbor(gx: number, gy: number): Dir | null {
    const dx = gx - this.player.gx;
    const dy = gy - this.player.gy;
    if (dx === -1 && dy === -1) return "NW";
    if (dx === 1 && dy === 1) return "SE";
    if (dx === 1 && dy === -1) return "NE";
    if (dx === -1 && dy === 1) return "SW";
    if (dx === 0 && dy === -1) return "N";
    if (dx === 1 && dy === 0) return "E";
    if (dx === 0 && dy === 1) return "S";
    if (dx === -1 && dy === 0) return "W";
    return null;
  }

  private setHover(target: { gx: number; gy: number } | null) {
    if (this.hoveredTile && (!target || this.hoveredTile.gx !== target.gx || this.hoveredTile.gy !== target.gy)) {
      const prev = this.level.get(this.hoveredTile.gx, this.hoveredTile.gy);
      prev?.setHovered(false);
      this.hoveredTile = null;
      this.host.style.cursor = "default";
    }
    if (target) {
      const t = this.level.get(target.gx, target.gy);
      if (!t) return;
      const dir = this.dirToNeighbor(target.gx, target.gy);
      if (!dir) return;
      t.setHovered(true);
      this.hoveredTile = target;
      this.host.style.cursor = "pointer";
    }
  }

  private onPointerMove = (e: FederatedPointerEvent) => {
    if (this.state !== "playing" || this.player.isAnimating) {
      this.setHover(null);
      return;
    }
    const { gx, gy } = this.screenPointToGrid(e.global.x, e.global.y);
    this.setHover({ gx, gy });
  };

  private onPointerLeave = () => {
    this.setHover(null);
  };

  private onPointerDown = (e: FederatedPointerEvent) => {
    if (this.state !== "playing" || this.player.isAnimating) return;
    const { gx, gy } = this.screenPointToGrid(e.global.x, e.global.y);
    const dir = this.dirToNeighbor(gx, gy);
    if (dir) this.handleDir(dir);
  };

  triggerDir(d: Parameters<Input["emit"]>[0]) {
    this.input.emit(d);
  }

  private buildLevel(data: LevelData) {
    // очистка
    this.world.removeChildren();
    this.hoveredTile = null;
    this.level = new Level(data, this.palette);
    this.world.addChild(this.level.container);

    this.player = new Player(this.level.startGx, this.level.startGy, this.palette);
    this.world.addChild(this.player.container);

    // Закрашиваем стартовую плитку сразу
    this.level.get(this.level.startGx, this.level.startGy)?.paint();

    this.hops = 0;
    this.state = "playing";
    this.cb.onHopCount(0);
  }

  reset() {
    this.buildLevel(this.currentLevelData);
    this.layout();
  }

  setLevel(data: LevelData) {
    this.currentLevelData = data;
    this.buildLevel(data);
    this.layout();
  }

  setMoveLimit(limit: number | null) {
    this.moveLimit = limit;
  }

  private handleDir = (dir: Parameters<Input["emit"]>[0]) => {
    if (this.state !== "playing") return;
    if (this.player.isAnimating) return;
    // Сбрасываем hover, чтобы курсор не "прилипал" к старой плитке
    this.setHover(null);
    const { dx, dy } = dirToDelta(dir);
    const tx = this.player.gx + dx;
    const ty = this.player.gy + dy;
    const target = this.level.get(tx, ty);
    if (!target) {
      // прыжок в пустоту — проигрыш
      this.state = "lost";
      this.player.fall(tx, ty, () => {
        this.cb.onLose();
      });
      return;
    }
    this.hops++;
    this.cb.onHopCount(this.hops);
    this.player.hop(
      tx, ty,
      () => { target.paint(); },
      () => {
        if (this.level.isComplete()) {
          this.state = "won";
          this.cb.onWin(this.hops);
          return;
        }
        if (this.moveLimit !== null && this.hops >= this.moveLimit) {
          this.state = "lost";
          this.cb.onLose();
        }
      },
    );
  };

  private layout = () => {
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;

    // Фон-градиент
    this.bg.clear();
    this.bg.beginFill(this.palette.skyTop);
    this.bg.drawRect(0, 0, w, h * 0.55);
    this.bg.endFill();
    this.bg.beginFill(this.palette.skyBottom);
    this.bg.drawRect(0, h * 0.55, w, h * 0.45);
    this.bg.endFill();

    // Подгоняем масштаб мира, чтобы level помещался с отступом
    const bounds = this.computeLevelBounds();
    const padding = 80;
    const scaleX = (w - padding * 2) / bounds.width;
    const scaleY = (h - padding * 2) / bounds.height;
    const scale = Math.min(1.1, Math.min(scaleX, scaleY));
    this.world.scale.set(scale);

    // Центрируем
    this.world.position.set(
      w / 2 - bounds.cx * scale,
      h / 2 - bounds.cy * scale,
    );
  };

  private computeLevelBounds() {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    const halfW = TILE_H; // запас по ширине под выпуклые края спрайта
    for (const t of this.level.tiles.values()) {
      const { x, y } = gridToScreen(t.gx, t.gy);
      if (x - TILE_H * 1.2 < minX) minX = x - TILE_H * 1.2;
      if (x + TILE_H * 1.2 > maxX) maxX = x + TILE_H * 1.2;
      if (y - TILE_H * 0.4 < minY) minY = y - TILE_H * 0.4;
      if (y + TILE_H * 1.6 > maxY) maxY = y + TILE_H * 1.6;
    }
    return {
      width: maxX - minX,
      height: maxY - minY,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
    };
  }

  destroy() {
    this.input.destroy();
    this.app.destroy(true, { children: true });
  }
}
