import { Assets, ColorMatrixFilter, Container, Graphics, Sprite, Texture } from "pixi.js";
import { TILE_W, TILE_H, gridToScreen, isoZ } from "./iso";
import type { Palette } from "./theme";
import tileUnpaintedUrl from "@/assets/tile-unpainted.webp";
import tilePaintedUrl from "@/assets/tile-painted.webp";
import tileUnpaintedSlimeUrl from "@/assets/tile-unpainted-slime.webp";
import tilePaintedSlimeUrl from "@/assets/tile-painted-slime.webp";
import tileUnpaintedNeonUrl from "@/assets/tile-unpainted-neon.webp";
import tilePaintedNeonUrl from "@/assets/tile-painted-neon.webp";
import tileUnpaintedWoodUrl from "@/assets/tile-unpainted-wood.webp";
import tilePaintedWoodUrl from "@/assets/tile-painted-wood.webp";
import tileUnpaintedPaperUrl from "@/assets/tile-unpainted-paper.webp";
import tilePaintedPaperUrl from "@/assets/tile-painted-paper.webp";

export type TileState = "unpainted" | "painted";
export type TileTheme = "default" | "slime" | "neon" | "wood" | "paper";

const TILE_VISUAL = {
  spriteWidthFactor: 0.92,
  hoverRevealMs: 300,
  paintRevealMs: 300,
  jumpLiftPx: 5,
  jumpLiftEase: 0.16,
  jumpWobbleAmplitudePx: 1.6,
  jumpWobbleFrequency: 0.006,
  jumpBrightnessBoost: 0.16,
  highlightLineWidth: 3,
  highlightLineAlpha: 0.95,
  highlightFillAlpha: 0.18,
};

/** Eases reveal animations toward their target without a hard stop. */
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);
/** Eases paint reveal animations symmetrically at the start and end. */
const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

/**
 * Fits a tile sprite to the target width once its texture is available.
 */
function fitSpriteWidth(sprite: Sprite, targetW: number) {
  const apply = () => {
    const w = sprite.texture.width || 1;
    const s = targetW / w;
    sprite.scale.set(s, s);
  };
  if (sprite.texture.baseTexture.valid) {
    apply();
  } else {
    sprite.texture.baseTexture.once("loaded", apply);
  }
}

const _tex: Record<TileTheme, { unpainted: Texture | null; painted: Texture | null }> = {
  default: { unpainted: null, painted: null },
  slime: { unpainted: null, painted: null },
  neon: { unpainted: null, painted: null },
  wood: { unpainted: null, painted: null },
  paper: { unpainted: null, painted: null },
};

const URLS: Record<TileTheme, { unpainted: string; painted: string }> = {
  default: { unpainted: tileUnpaintedUrl, painted: tilePaintedUrl },
  slime: { unpainted: tileUnpaintedSlimeUrl, painted: tilePaintedSlimeUrl },
  neon: { unpainted: tileUnpaintedNeonUrl, painted: tilePaintedNeonUrl },
  wood: { unpainted: tileUnpaintedWoodUrl, painted: tilePaintedWoodUrl },
  paper: { unpainted: tileUnpaintedPaperUrl, painted: tilePaintedPaperUrl },
};

/**
 * Loads all tile theme textures before the scene is built.
 */
export async function preloadTileTextures() {
  const themes: TileTheme[] = ["default", "slime", "neon", "wood", "paper"];
  await Promise.all(
    themes.flatMap((th) => [
      Assets.load<Texture>(URLS[th].unpainted).then((t) => (_tex[th].unpainted = t)),
      Assets.load<Texture>(URLS[th].painted).then((t) => (_tex[th].painted = t)),
    ]),
  );
}

const TILE_METRICS: Record<TileTheme, { anchorX: number; anchorY: number; faceWRatio: number }> = {
  default: { anchorX: 0.5, anchorY: 0.424, faceWRatio: 1090 / 1262 },
  slime: { anchorX: 0.5, anchorY: 0.424, faceWRatio: 1090 / 1262 },
  neon: { anchorX: 0.5, anchorY: 0.424, faceWRatio: 1090 / 1262 },
  wood: { anchorX: 0.506, anchorY: 0.484, faceWRatio: 1115 / 1254 },
  paper: { anchorX: 0.5, anchorY: 0.424, faceWRatio: 1090 / 1262 },
};

/**
 * Returns cached tile textures, creating lazy Texture instances when needed.
 */
function getTextures(theme: TileTheme = "default") {
  const slot = _tex[theme];
  if (!slot.unpainted) slot.unpainted = Texture.from(URLS[theme].unpainted);
  if (!slot.painted) slot.painted = Texture.from(URLS[theme].painted);
  return { unpainted: slot.unpainted, painted: slot.painted };
}

/**
 * Renders one board tile and manages paint, hover, and jump-available effects.
 */
export class Tile {
  readonly container: Container;
  private visual: Container;
  private unpaintedSprite: Sprite;
  private paintedSprite: Sprite;
  private paintMask: Graphics;
  private brightnessFilter: ColorMatrixFilter;
  private highlight: Graphics;
  private highlightMask: Graphics;
  state: TileState = "unpainted";
  isStart: boolean;
  private hovered = false;
  private jumpAvailable = false;
  private jumpLift = 0;
  private hoverProgress = 0;
  private hoverTarget = 0;
  private hoverChangedAt = 0;
  private hoverChangedFrom = 0;
  private paintProgress = 0;
  private paintChangedAt = 0;
  private paintChangedFrom = 0;
  private paintAnimating = false;

  /**
   * Creates a tile at the given grid cell using the selected visual theme.
   */
  constructor(
    public gx: number,
    public gy: number,
    isStart: boolean,
    private palette: Palette,
    private theme: TileTheme = "default",
  ) {
    this.isStart = isStart;
    this.container = new Container();
    this.visual = new Container();

    const { unpainted, painted } = getTextures(this.theme);
    this.unpaintedSprite = new Sprite(unpainted);
    this.paintedSprite = new Sprite(painted);

    const metrics = TILE_METRICS[this.theme] ?? TILE_METRICS.default;
    this.unpaintedSprite.anchor.set(metrics.anchorX, metrics.anchorY);
    this.paintedSprite.anchor.set(metrics.anchorX, metrics.anchorY);
    const spriteW = (TILE_W / metrics.faceWRatio) * TILE_VISUAL.spriteWidthFactor;
    fitSpriteWidth(this.unpaintedSprite, spriteW);
    fitSpriteWidth(this.paintedSprite, spriteW);

    this.paintMask = new Graphics();
    this.paintedSprite.mask = this.paintMask;
    this.brightnessFilter = new ColorMatrixFilter();
    this.visual.filters = [this.brightnessFilter];

    this.highlight = new Graphics();
    this.highlightMask = new Graphics();
    this.highlight.mask = this.highlightMask;
    this.highlight.visible = false;
    this.drawHighlight();
    this.drawHighlightMask(0);
    this.drawPaintMask(0);

    this.container.addChild(this.visual);
    this.visual.addChild(this.unpaintedSprite, this.paintedSprite, this.paintMask, this.highlight, this.highlightMask);
    this.unpaintedSprite.position.set(0, TILE_H / 2);
    this.paintedSprite.position.set(0, TILE_H / 2);

    const { x, y } = gridToScreen(gx, gy);
    this.container.position.set(x, y);
    this.container.zIndex = isoZ(gx, gy, 0);
  }

  /**
   * Starts or reverses the hover highlight reveal animation.
   */
  setHovered(on: boolean) {
    if (this.hovered === on) return;
    this.hovered = on;
    this.hoverChangedFrom = this.hoverProgress;
    this.hoverTarget = on ? 1 : 0;
    this.hoverChangedAt = performance.now();
    if (on) this.highlight.visible = true;
  }

  /**
   * Marks whether this tile is a currently reachable jump target.
   */
  setJumpAvailable(on: boolean) {
    this.jumpAvailable = on;
  }

  /**
   * Advances all per-frame tile visual effects.
   */
  update(now: number) {
    this.updateHover(now);
    this.updatePaint(now);
    this.updateJumpMotion(now);
  }

  /**
   * Draws the static diamond highlight shape before it is masked.
   */
  private drawHighlight() {
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    this.highlight.clear();
    this.highlight.lineStyle({
      width: TILE_VISUAL.highlightLineWidth,
      color: 0xffffff,
      alpha: TILE_VISUAL.highlightLineAlpha,
    });
    this.highlight.beginFill(0xffffff, TILE_VISUAL.highlightFillAlpha);
    this.highlight.moveTo(0, 0);
    this.highlight.lineTo(hw, hh);
    this.highlight.lineTo(0, TILE_H);
    this.highlight.lineTo(-hw, hh);
    this.highlight.closePath();
    this.highlight.endFill();
  }

  /**
   * Updates the radial mask that reveals the hover highlight.
   */
  private drawHighlightMask(progress: number) {
    this.drawRadialMask(this.highlightMask, progress);
  }

  /**
   * Updates the radial mask that reveals the painted sprite.
   */
  private drawPaintMask(progress: number) {
    this.drawRadialMask(this.paintMask, progress);
  }

  /**
   * Draws a circular reveal mask centered on the visible tile face.
   */
  private drawRadialMask(mask: Graphics, progress: number) {
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const maxRadius = Math.sqrt(hw * hw + hh * hh);
    mask.clear();
    if (progress <= 0) return;
    mask.beginFill(0xffffff, 1);
    mask.drawCircle(0, hh, maxRadius * progress);
    mask.endFill();
  }

  /**
   * Animates hover highlight progress toward the current hover target.
   */
  private updateHover(now: number) {
    if (this.hoverProgress === this.hoverTarget) return;
    const raw = (now - this.hoverChangedAt) / TILE_VISUAL.hoverRevealMs;
    const t = Math.min(1, Math.max(0, raw));
    const eased = easeOutCubic(t);
    this.hoverProgress = this.hoverChangedFrom + (this.hoverTarget - this.hoverChangedFrom) * eased;
    this.drawHighlightMask(this.hoverProgress);
    if (t >= 1) {
      this.hoverProgress = this.hoverTarget;
      this.drawHighlightMask(this.hoverProgress);
      this.highlight.visible = this.hoverProgress > 0;
    }
  }

  /**
   * Animates the painted texture reveal after the tile is stepped on.
   */
  private updatePaint(now: number) {
    if (!this.paintAnimating) return;
    const raw = (now - this.paintChangedAt) / TILE_VISUAL.paintRevealMs;
    const t = Math.min(1, Math.max(0, raw));
    const eased = easeInOutSine(t);
    this.paintProgress = this.paintChangedFrom + (1 - this.paintChangedFrom) * eased;
    this.drawPaintMask(this.paintProgress);
    if (t >= 1) {
      this.paintProgress = 1;
      this.paintAnimating = false;
      this.drawPaintMask(1);
    }
  }

  /**
   * Applies lift, wobble, and brightness while the tile is a jump target.
   */
  private updateJumpMotion(now: number) {
    const targetLift = this.jumpAvailable ? TILE_VISUAL.jumpLiftPx : 0;
    this.jumpLift += (targetLift - this.jumpLift) * TILE_VISUAL.jumpLiftEase;
    const wobble = this.jumpAvailable
      ? Math.sin(now * TILE_VISUAL.jumpWobbleFrequency) * TILE_VISUAL.jumpWobbleAmplitudePx
      : 0;
    this.visual.y = -this.jumpLift + wobble;
    const liftedHeight = Math.max(0, -this.visual.y);
    const brightnessProgress = Math.min(1, liftedHeight / (TILE_VISUAL.jumpLiftPx + TILE_VISUAL.jumpWobbleAmplitudePx));
    this.brightnessFilter.brightness(1 + TILE_VISUAL.jumpBrightnessBoost * brightnessProgress, false);
  }

  /**
   * Marks the tile painted and optionally skips the reveal animation.
   */
  paint(options: { immediate?: boolean } = {}) {
    if (this.state === "painted") return false;
    this.state = "painted";
    this.paintChangedFrom = this.paintProgress;
    this.paintChangedAt = performance.now();
    this.paintAnimating = !options.immediate;
    this.paintProgress = options.immediate ? 1 : this.paintProgress;
    this.drawPaintMask(this.paintProgress);
    return true;
  }

  /**
   * Restores the tile to its initial unpainted and unhighlighted state.
   */
  reset() {
    this.state = "unpainted";
    this.paintAnimating = false;
    this.paintProgress = 0;
    this.drawPaintMask(0);
    this.setHovered(false);
    this.setJumpAvailable(false);
    this.jumpLift = 0;
    this.visual.y = 0;
    this.brightnessFilter.brightness(1, false);
  }
}
