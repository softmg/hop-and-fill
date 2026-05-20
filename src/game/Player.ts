import { Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import { TILE_H, TILE_W, gridToScreen, isoZ } from "./iso";
import type { Palette } from "./theme";
import playerDefaultUrl from "@/assets/player.webp";
import playerSlimeUrl from "@/assets/player-slime.webp";
import playerNeonUrl from "@/assets/player-neon.webp";
import playerWoodUrl from "@/assets/player-wood.webp";
import playerPaperUrl from "@/assets/player-paper.webp";

const HOP_DURATION = 280; // ms
const HOP_HEIGHT = 80;
const FAST_FORWARD_DISTANCE = 1;
const FAST_FORWARD_MULTIPLIER = 2;

interface HopJob {
  fromGx: number;
  fromGy: number;
  targetGx: number;
  targetGy: number;
  onLand: () => void;
  onSettle: () => void;
}

export type PlayerTheme = "default" | "slime" | "neon" | "wood" | "paper";

const PLAYER_URLS: Record<PlayerTheme, string> = {
  default: playerDefaultUrl,
  slime: playerSlimeUrl,
  neon: playerNeonUrl,
  wood: playerWoodUrl,
  paper: playerPaperUrl,
};

const _texPlayer: Record<PlayerTheme, Texture | null> = {
  default: null,
  slime: null,
  neon: null,
  wood: null,
  paper: null,
};

/**
 * Loads all player theme textures before the scene is built.
 */
export async function preloadPlayerTexture() {
  const themes: PlayerTheme[] = ["default", "slime", "neon", "wood", "paper"];
  await Promise.all(
    themes.map((th) =>
      Assets.load<Texture>(PLAYER_URLS[th]).then((t) => (_texPlayer[th] = t)),
    ),
  );
}

function getPlayerTexture(theme: PlayerTheme = "default") {
  if (!_texPlayer[theme]) _texPlayer[theme] = Texture.from(PLAYER_URLS[theme]);
  return _texPlayer[theme]!;
}

/**
 * Renders the player sprite and coordinates hop, queue, and fall animations.
 */
export class Player {
  readonly container: Container;
  private body: Sprite;
  private shadow: Graphics;
  gx: number;
  gy: number;
  private animating = false;
  private hopQueue: HopJob[] = [];
  private animationToken = 0;

  /**
   * Creates a player at the given grid cell using the selected visual theme.
   */
  constructor(gx: number, gy: number, private palette: Palette, private theme: PlayerTheme = "default") {
    this.gx = gx;
    this.gy = gy;
    this.container = new Container();

    this.shadow = new Graphics();
    this.drawShadow();

    this.body = new Sprite(getPlayerTexture(this.theme));
    this.body.anchor.set(0.5, 0.92);
    const targetW = TILE_W * 0.92;
    const applySize = () => {
      const w = this.body.texture.width || 1;
      const s = targetW / w;
      this.body.scale.set(s, s);
    };
    if (this.body.texture.baseTexture.valid) applySize();
    else this.body.texture.baseTexture.once("loaded", applySize);

    this.container.addChild(this.shadow, this.body);
    this.snapTo(gx, gy);
  }

  /**
   * Reports whether a hop, queued hop, or fall animation is currently active.
   */
  get isAnimating() {
    return this.animating;
  }

  private drawShadow() {
    this.shadow.clear();
    this.shadow.beginFill(0x000000, 0.22);
    this.shadow.drawEllipse(0, 0, TILE_W * 0.32, TILE_H * 0.28);
    this.shadow.endFill();
  }

  /**
   * Places the player on a grid cell and cancels any active hop queue.
   */
  snapTo(gx: number, gy: number) {
    this.animationToken++;
    this.hopQueue = [];
    this.animating = false;
    this.body.y = 0;
    this.gx = gx;
    this.gy = gy;
    const { x, y } = gridToScreen(gx, gy);
    this.container.position.set(x, y + TILE_H / 2);
    this.container.zIndex = isoZ(gx, gy, 50);
  }

  /**
   * Starts a hop from the player's current grid cell to the target cell.
   */
  hop(targetGx: number, targetGy: number, onLand: () => void, onSettle: () => void) {
    this.hopFrom(this.gx, this.gy, targetGx, targetGy, onLand, onSettle);
  }

  /**
   * Queues or runs a hop from an explicit source cell to preserve rapid input order.
   */
  hopFrom(
    fromGx: number,
    fromGy: number,
    targetGx: number,
    targetGy: number,
    onLand: () => void,
    onSettle: () => void,
  ) {
    const job = { fromGx, fromGy, targetGx, targetGy, onLand, onSettle };

    this.gx = targetGx;
    this.gy = targetGy;

    if (this.animating) {
      this.hopQueue.push(job);
      return;
    }

    this.runHop(job);
  }

  /**
   * Runs one visual hop job and continues with the next queued job after settling.
   */
  private runHop(job: HopJob) {
    this.animating = true;

    const startScreen = gridToScreen(job.fromGx, job.fromGy);
    const endScreen = gridToScreen(job.targetGx, job.targetGy);
    const startY = startScreen.y + TILE_H / 2;
    const endY = endScreen.y + TILE_H / 2;
    const startX = startScreen.x;
    const endX = endScreen.x;

    let lastFrameTime = performance.now();
    let progress = 0;
    const baseScaleX = this.body.scale.x;
    const baseScaleY = this.body.scale.y;
    const token = ++this.animationToken;

    const tick = () => {
      if (token !== this.animationToken) return;
      if (!this.body || this.body.destroyed) return;
      const now = performance.now();
      const elapsed = now - lastFrameTime;
      lastFrameTime = now;
      progress = Math.min(1, progress + (elapsed * this.visualSpeedMultiplier()) / HOP_DURATION);
      const t = progress;
      const x = startX + (endX - startX) * t;
      const y = startY + (endY - startY) * t;
      const arc = -Math.sin(t * Math.PI) * HOP_HEIGHT;

      this.container.position.set(x, y);
      this.body.y = arc;

      const sq = 1 + Math.sin(t * Math.PI) * 0.08;
      this.body.scale.set(baseScaleX / sq, baseScaleY * sq);

      const zFrom = isoZ(job.fromGx, job.fromGy, 50);
      const zTo = isoZ(job.targetGx, job.targetGy, 50);
      this.container.zIndex = Math.max(zFrom, zTo);

      if (t < 1) {
        requestAnimationFrame(tick);
      } else {
        this.body.y = 0;
        this.body.scale.set(baseScaleX, baseScaleY);
        job.onLand();
        let lastSettleFrameTime = performance.now();
        let settleProgress = 0;
        const settle = () => {
          if (token !== this.animationToken) return;
          if (!this.body || this.body.destroyed) return;
          const now = performance.now();
          const elapsed = now - lastSettleFrameTime;
          lastSettleFrameTime = now;
          settleProgress = Math.min(1, settleProgress + (elapsed * this.visualSpeedMultiplier()) / 140);
          const e = settleProgress;
          if (e >= 1) {
            this.body.scale.set(baseScaleX, baseScaleY);
            job.onSettle();
            const next = this.hopQueue.shift();
            if (next) {
              this.runHop(next);
            } else {
              this.animating = false;
            }
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

  /**
   * Speeds up visual playback when input has queued multiple pending moves.
   */
  private visualSpeedMultiplier() {
    const queuedVisualMoves = 1 + this.hopQueue.length;
    return queuedVisualMoves > FAST_FORWARD_DISTANCE ? FAST_FORWARD_MULTIPLIER : 1;
  }

  /**
   * Plays the level-failure fall animation toward a target grid cell.
   */
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
      if (!this.body || this.body.destroyed) return;
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

  /**
   * Restores visual properties after transient animations.
   */
  resetVisual() {
    this.container.alpha = 1;
  }
}
