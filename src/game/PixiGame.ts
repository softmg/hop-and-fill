import { Application, Container, Graphics } from "pixi.js";
import { Level, type LevelData } from "./Level";
import { Player } from "./Player";
import { Input } from "./Input";
import { dirToDelta, gridToScreen, TILE_H } from "./iso";
import { colors, type Palette } from "./theme";

export interface GameCallbacks {
  onHopCount: (n: number) => void;
  onWin: () => void;
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
  private state: "playing" | "won" | "lost" = "playing";
  private currentLevelData: LevelData;

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
    this.layout();
  }

  triggerDir(d: Parameters<Input["emit"]>[0]) {
    this.input.emit(d);
  }

  private buildLevel(data: LevelData) {
    // очистка
    this.world.removeChildren();
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

  private handleDir = (dir: Parameters<Input["emit"]>[0]) => {
    if (this.state !== "playing") return;
    if (this.player.isAnimating) return;
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
          this.cb.onWin();
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
    for (const t of this.level.tiles.values()) {
      const { x, y } = gridToScreen(t.gx, t.gy);
      // верх плитки
      if (x - 48 < minX) minX = x - 48;
      if (x + 48 > maxX) maxX = x + 48;
      if (y - 4 < minY) minY = y - 4;
      if (y + TILE_H + 28 > maxY) maxY = y + TILE_H + 28;
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
