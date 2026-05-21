import { Application, Container, Graphics, FederatedPointerEvent } from "pixi.js";
import { Level, type LevelData } from "./Level";
import { Player, preloadPlayerTexture, type PlayerTheme } from "./Player";
import { preloadTileTextures } from "./Tile";
import { Input, type KeyboardRotation } from "./Input";
import { dirToDelta, gridToScreen, screenToGrid, TILE_H, type Dir } from "./iso";
import { colors, type Palette } from "./theme";

const JUMP_TARGET_DIRECTIONS: Dir[] = ["NW", "N", "NE", "E", "SE", "S", "SW", "W"];

export interface GameCallbacks {
  onHopCount: (n: number) => void;
  onHop: () => void;
  onPaint: () => void;
  onWin: (hops: number) => void;
  onLose: () => void;
  /** Receives the player's current screen-space HUD anchor each rendered frame. */
  onPlayerScreenPosition?: (position: { x: number; y: number }) => void;
}

interface PixiGameOptions {
  keyboardRotation?: KeyboardRotation;
  onFirstSceneRenderable?: () => void;
}

interface MoveSnapshot {
  fromGx: number;
  fromGy: number;
  toGx: number;
  toGy: number;
  previousHops: number;
  destinationWasPainted: boolean;
  destinationLandingCount: number;
  sourceWasSealed: boolean;
}

/**
 * Coordinates the Pixi scene, level state, input, and gameplay callbacks.
 */
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

  /**
   * Creates the Pixi application inside the host element and starts scene loading.
   */
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
    this.input = new Input(host, this.handleInputDir, { keyboardRotation: options.keyboardRotation });
    this.app.renderer.on("resize", this.layout);

    // Мышь: hover + клик. Используем eventMode на stage.
    this.app.stage.eventMode = "static";
    this.app.stage.hitArea = this.app.screen;
    this.app.stage.on("pointermove", this.onPointerMove);
    this.app.stage.on("pointerup", this.onPointerUp);
    this.app.stage.on("pointerleave", this.onPointerLeave);
    this.app.ticker.add(this.onTick);
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

  /**
   * Emits the player HUD anchor only when a consumer is registered.
   */
  private reportPlayerScreenPosition() {
    if (!this.ready || !this.player || !this.cb.onPlayerScreenPosition) return;
    const point = this.world.toGlobal(this.player.getHudAnchorPoint());
    this.cb.onPlayerScreenPosition({ x: point.x, y: point.y });
  }

  private screenPointToGrid(globalX: number, globalY: number) {
    // Переводим из stage-координат в world-координаты
    const local = this.world.toLocal({ x: globalX, y: globalY });
    const { gx, gy } = screenToGrid(local.x, local.y);
    return { gx: Math.round(gx), gy: Math.round(gy) };
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
      if (!this.isReachableTarget(target.gx, target.gy)) return;
      t.setHovered(true);
      this.hoveredTile = target;
      this.host.style.cursor = "pointer";
    }
  }

  private onPointerMove = (e: FederatedPointerEvent) => {
    if (!this.ready || this.isPaused || this.state !== "playing") {
      this.setHover(null);
      return;
    }
    const { gx, gy } = this.screenPointToGrid(e.global.x, e.global.y);
    this.setHover({ gx, gy });
  };

  /**
   * Reports whether reachable jump targets should currently be highlighted.
   */
  private canShowJumpTargets() {
    return this.ready && !this.isPaused && this.state === "playing";
  }

  /**
   * Refreshes the per-tile reachable target markers around the player.
   */
  private updateJumpTargets() {
    if (!this.ready || !this.level || !this.player) return;

    for (const tile of this.level.tiles.values()) {
      tile.setJumpAvailable(false);
    }

    if (!this.canShowJumpTargets()) return;

    for (const target of this.getReachableTargets()) {
      this.level.get(target.gx, target.gy)?.setJumpAvailable(true);
    }
  }

  private onTick = () => {
    if (!this.ready || !this.level) return;
    this.updateJumpTargets();
    this.reportPlayerScreenPosition();
    const now = performance.now();
    for (const tile of this.level.tiles.values()) {
      tile.update(now);
    }
  };

  private onPointerLeave = () => {
    this.setHover(null);
  };

  private onPointerUp = (e: FederatedPointerEvent) => {
    if (!this.ready || this.isPaused || this.state !== "playing") return;
    const { gx, gy } = this.screenPointToGrid(e.global.x, e.global.y);
    if (this.isReachableTarget(gx, gy)) {
      this.commitMove(this.player.gx, this.player.gy, gx, gy);
    }
  };

  /**
   * Emits a direction from external controls such as the mobile joystick.
   */
  triggerDir(d: Parameters<Input["emit"]>[0]) {
    this.input.emit(d);
  }

  /**
   * Applies the selected keyboard rotation to the input manager.
   */
  setKeyboardRotation(rotation: KeyboardRotation) {
    this.input.setKeyboardRotation(rotation);
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
    this.level.get(this.level.startGx, this.level.startGy)?.paint({ immediate: true });

    this.hops = 0;
    this.state = "playing";
    this.lastMove = null;
    this.cb.onHopCount(0);
  }

  /**
   * Restarts the current level from its initial state.
   */
  reset() {
    if (!this.ready) return;
    this.buildLevel(this.currentLevelData);
    this.layout();
  }

  /**
   * Rebuilds the current scene with a new level definition.
   */
  setLevel(data: LevelData) {
    this.currentLevelData = data;
    if (!this.ready) return;
    this.buildLevel(data);
    this.layout();
  }

  /**
   * Updates the optional move limit used to detect loss.
   */
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
    this.level.get(move.toGx, move.toGy)?.setLandingCount(move.destinationLandingCount);
    this.level.get(move.fromGx, move.fromGy)?.setFragileSealed(move.sourceWasSealed);
    this.hops = move.previousHops;
    this.state = "playing";
    this.lastMove = null;
    this.cb.onHopCount(this.hops);
    return true;
  }

  /**
   * Pauses gameplay input and clears hover state.
   */
  pause() {
    this.isPaused = true;
    this.setHover(null);
  }

  /**
   * Resumes gameplay after a pause overlay or visibility pause.
   */
  resume() {
    this.isPaused = false;
  }

  /**
   * Handles keyboard or touch movement, respecting animation locks.
   */
  private handleInputDir = (dir: Parameters<Input["emit"]>[0]) => {
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
    const source = this.level.get(this.player.gx, this.player.gy);
    if (!target || !target.canLand()) {
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
      destinationLandingCount: target.landingCount,
      sourceWasSealed: source?.isFragileSealed() ?? false,
    };
    if (source?.shouldSealAfterDeparture()) source.setFragileSealed(true);
    target.recordLanding();
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
        if (this.state !== "playing") return;

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

  /**
   * Commits a move, updates score state, and schedules player/tile effects.
   */
  private commitMove(fromGx: number, fromGy: number, toGx: number, toGy: number) {
    if (!this.ready || this.destroyed) return;
    if (this.isPaused) return;
    if (this.state !== "playing") return;

    const target = this.level.get(toGx, toGy);
    const source = this.level.get(fromGx, fromGy);
    if (!target || !this.isReachableFrom(fromGx, fromGy, toGx, toGy)) return;

    this.lastMove = {
      fromGx,
      fromGy,
      toGx,
      toGy,
      previousHops: this.hops,
      destinationWasPainted: target.state === "painted",
      destinationLandingCount: target.landingCount,
      sourceWasSealed: source?.isFragileSealed() ?? false,
    };
    if (source?.shouldSealAfterDeparture()) source.setFragileSealed(true);
    target.recordLanding();
    this.hops++;
    this.cb.onHopCount(this.hops);
    this.cb.onHop();
    this.player.hopFrom(
      fromGx,
      fromGy,
      toGx,
      toGy,
      () => {
        if (this.state !== "playing") return;

        if (target.paint()) {
          this.cb.onPaint();
        }

        if (this.level.isComplete()) {
          this.state = "won";
          this.setHover(null);
          this.cb.onWin(this.hops);
          return;
        }

        if (this.moveLimit !== null && this.hops >= this.moveLimit) {
          this.state = "lost";
          this.setHover(null);
          this.cb.onLose();
        }
      },
      () => {},
    );
  }

  private getReachableTargets() {
    const targets = JUMP_TARGET_DIRECTIONS.map((dir) => {
      const { dx, dy } = dirToDelta(dir);
      return { gx: this.player.gx + dx, gy: this.player.gy + dy };
    });
    const teleport = this.level.getTeleportDestination(this.player.gx, this.player.gy);
    if (teleport) targets.push(teleport);

    return targets.filter((target, index, allTargets) => {
      const tile = this.level.get(target.gx, target.gy);
      return (
        tile?.canLand() === true &&
        allTargets.findIndex((other) => other.gx === target.gx && other.gy === target.gy) === index
      );
    });
  }

  private isReachableTarget(gx: number, gy: number) {
    return this.getReachableTargets().some((target) => target.gx === gx && target.gy === gy);
  }

  private isReachableFrom(fromGx: number, fromGy: number, toGx: number, toGy: number) {
    const dx = Math.abs(toGx - fromGx);
    const dy = Math.abs(toGy - fromGy);
    if ((dx <= 1 && dy <= 1) && (dx !== 0 || dy !== 0)) {
      return this.level.get(toGx, toGy)?.canLand() === true;
    }

    const teleport = this.level.getTeleportDestination(fromGx, fromGy);
    return teleport?.gx === toGx && teleport.gy === toGy && this.level.get(toGx, toGy)?.canLand() === true;
  }

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
    this.reportPlayerScreenPosition();
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

  /**
   * Releases Pixi resources, input listeners, timers, and observers.
   */
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
    this.app.ticker.remove(this.onTick);
    this.app.destroy(true, { children: true });
  }
}
