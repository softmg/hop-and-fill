import { Application, Container, Graphics, FederatedPointerEvent } from "pixi.js";
import { Level, type LevelData } from "./Level";
import { Player, preloadPlayerTexture, type PlayerTheme } from "./Player";
import { preloadTileTextures } from "./Tile";
import { Input } from "./Input";
import { dirToDelta, gridToScreen, screenToGrid, TILE_H, type Dir } from "./iso";
import { colors, type Palette } from "./theme";

export interface GameCallbacks {
  onHopCount: (n: number) => void;
  onHop: () => void;
  onPaint: () => void;
  onWin: (hops: number) => void;
  onLose: () => void;
}

interface PixiGameOptions {
  onFirstSceneRenderable?: () => void;
}

interface MoveSnapshot {
  fromGx: number;
  fromGy: number;
  toGx: number;
  toGy: number;
  previousHops: number;
  destinationWasPainted: boolean;
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
  private isPaused = false;
  private currentLevelData: LevelData;
  private hoveredTile: { gx: number; gy: number } | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private lastSize: { w: number; h: number } = { w: 0, h: 0 };
  private pendingSize: { w: number; h: number } | null = null;
  private resizeRafId: number | null = null;
  private ready = false;
  private destroyed = false;
  private firstSceneRenderableReported = false;
  private lastMove: MoveSnapshot | null = null;

  constructor(
    private host: HTMLDivElement,
    levelData: LevelData,
    private cb: GameCallbacks,
    private options: PixiGameOptions = {},
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

    this.preloadAndBuild();
    this.input = new Input(host, this.handleDir);
    this.app.renderer.on("resize", this.layout);

    // Мышь: hover + клик. Используем eventMode на stage.
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on("pointermove", this.onPointerMove);
    this.app.stage.on("pointerdown", this.onPointerDown);
    this.app.stage.on("pointerleave", this.onPointerLeave);
    // Следим за реальным изменением размера контейнера и вызываем
    // app.resize() + layout() только когда размеры действительно поменялись.
    // Это решает проблему первой загрузки, когда host ещё не имеет финального размера.
    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) return;
        const { width, height } = entry.contentRect;
        const w = Math.round(width);
        const h = Math.round(height);
        if (w === 0 || h === 0) return;
        if (w === this.lastSize.w && h === this.lastSize.h) return;
        // Throttle через rAF: коалесцируем серию событий ресайза
        // в один вызов на кадр (≈60fps), сохраняя только последний размер.
        this.pendingSize = { w, h };
        if (this.resizeRafId !== null) return;
        this.resizeRafId = requestAnimationFrame(() => {
          this.resizeRafId = null;
          const size = this.pendingSize;
          this.pendingSize = null;
          if (!size) return;
          if (size.w === this.lastSize.w && size.h === this.lastSize.h) return;
          this.lastSize = size;
          this.app.resize();
          this.layout();
        });
      });
      this.resizeObserver.observe(host);
    }
  }

  private async preloadAndBuild() {
    // На первой загрузке Pixi может создать спрайты до готовности PNG-текстур,
    // из-за чего часть плиток появляется только после restart. Ждём ассеты явно.
    await Promise.all([preloadTileTextures(), preloadPlayerTexture()]);
    if (this.destroyed) return;
    this.ready = true;
    this.buildLevel(this.currentLevelData);
    this.queueLayout();
  }

  private queueLayout() {
    if (this.resizeRafId !== null) return;
    this.resizeRafId = requestAnimationFrame(() => {
      this.resizeRafId = null;
      if (!this.ready || this.destroyed) return;
      this.app.resize();
      const w = Math.round(this.host.clientWidth);
      const h = Math.round(this.host.clientHeight);
      if (w > 0 && h > 0) this.lastSize = { w, h };
      this.layout();
    });
  }

  private reportFirstSceneRenderable() {
    if (this.firstSceneRenderableReported || this.destroyed) return;
    this.firstSceneRenderableReported = true;
    this.options.onFirstSceneRenderable?.();
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
    if (!this.ready || this.isPaused || this.state !== "playing" || this.player.isAnimating) {
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
    if (!this.ready || this.isPaused || this.state !== "playing" || this.player.isAnimating) return;
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

    this.player = new Player(
      this.level.startGx,
      this.level.startGy,
      this.palette,
      (data.theme as PlayerTheme | undefined) ?? "default",
    );
    this.world.addChild(this.player.container);

    // Закрашиваем стартовую плитку сразу
    this.level.get(this.level.startGx, this.level.startGy)?.paint();

    this.hops = 0;
    this.state = "playing";
    this.lastMove = null;
    this.cb.onHopCount(0);
  }

  reset() {
    if (!this.ready) return;
    this.buildLevel(this.currentLevelData);
    this.layout();
  }

  setLevel(data: LevelData) {
    this.currentLevelData = data;
    if (!this.ready) return;
    this.buildLevel(data);
    this.layout();
  }

  setMoveLimit(limit: number | null) {
    this.moveLimit = limit;
  }

  canUndoLastMove() {
    return this.ready && !this.isPaused && !this.player.isAnimating && this.lastMove !== null;
  }

  undoLastMove() {
    if (!this.canUndoLastMove()) return false;

    const move = this.lastMove;
    if (!move) return false;

    this.setHover(null);
    this.player.snapTo(move.fromGx, move.fromGy);
    this.level.setTileState(move.toGx, move.toGy, move.destinationWasPainted ? "painted" : "unpainted");
    this.hops = move.previousHops;
    this.state = "playing";
    this.lastMove = null;
    this.cb.onHopCount(this.hops);
    return true;
  }

  pause() {
    this.isPaused = true;
    this.setHover(null);
  }

  resume() {
    this.isPaused = false;
  }

  private handleDir = (dir: Parameters<Input["emit"]>[0]) => {
    if (!this.ready) return;
    if (this.isPaused) return;
    if (this.state !== "playing") return;
    if (this.player.isAnimating) return;
    // Сбрасываем hover, чтобы курсор не "прилипал" к старой плитке
    this.setHover(null);
    const { dx, dy } = dirToDelta(dir);
    const tx = this.player.gx + dx;
    const ty = this.player.gy + dy;
    const target = this.level.get(tx, ty);
    if (!target) {
      // За пределы поля ходить нельзя — игнорируем ход без штрафа
      return;
    }
    this.lastMove = {
      fromGx: this.player.gx,
      fromGy: this.player.gy,
      toGx: tx,
      toGy: ty,
      previousHops: this.hops,
      destinationWasPainted: target.state === "painted",
    };
    this.hops++;
    this.cb.onHopCount(this.hops);
    this.cb.onHop();
    this.player.hop(
      tx, ty,
      () => {
        if (target.paint()) {
          this.cb.onPaint();
        }
      },
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
    if (!this.ready || !this.level) return;
    const w = this.app.renderer.width / this.app.renderer.resolution;
    const h = this.app.renderer.height / this.app.renderer.resolution;

    // Фон рисуется параллакс-слоем (ParallaxBackground), сцена прозрачная
    this.bg.clear();

    // Подгоняем масштаб мира, чтобы level помещался с отступом.
    // На узких экранах (мобильные) уменьшаем горизонтальный отступ
    // и резервируем больше места сверху под HUD/навигацию.
    const isMobile = w < 640;
    const bounds = this.computeLevelBounds(isMobile);
    const padX = isMobile ? 4 : 80;
    const padTop = isMobile ? 120 : 100;
    const padBottom = isMobile ? 40 : 80;
    const scaleX = (w - padX * 2) / bounds.width;
    const scaleY = (h - padTop - padBottom) / bounds.height;
    const maxScale = isMobile ? 2.2 : 1.1;
    const scale = Math.min(maxScale, Math.min(scaleX, scaleY));
    this.world.scale.set(scale);

    // Центрируем по горизонтали; по вертикали — в доступной области
    // (между HUD сверху и нижним отступом).
    const availY = (padTop + (h - padBottom)) / 2;
    this.world.position.set(
      w / 2 - bounds.cx * scale,
      availY - bounds.cy * scale,
    );

    if (w > 0 && h > 0) this.reportFirstSceneRenderable();
  };

  private computeLevelBounds(tight = false) {
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    // Запас по краям спрайта вокруг логических плиток.
    // На мобиле уменьшаем, чтобы сложные уровни не сжимались отступами.
    const padXFactor = tight ? 0.85 : 1.2;
    const padTopFactor = tight ? 0.25 : 0.4;
    const padBottomFactor = tight ? 1.15 : 1.6;
    for (const t of this.level.tiles.values()) {
      const { x, y } = gridToScreen(t.gx, t.gy);
      if (x - TILE_H * padXFactor < minX) minX = x - TILE_H * padXFactor;
      if (x + TILE_H * padXFactor > maxX) maxX = x + TILE_H * padXFactor;
      if (y - TILE_H * padTopFactor < minY) minY = y - TILE_H * padTopFactor;
      if (y + TILE_H * padBottomFactor > maxY) maxY = y + TILE_H * padBottomFactor;
    }
    return {
      width: maxX - minX,
      height: maxY - minY,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
    };
  }

  destroy() {
    this.destroyed = true;
    this.input.destroy();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    if (this.resizeRafId !== null) {
      cancelAnimationFrame(this.resizeRafId);
      this.resizeRafId = null;
    }
    this.pendingSize = null;
    this.app.destroy(true, { children: true });
  }
}
