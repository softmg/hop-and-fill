import { Assets, Container, Graphics, Sprite, Texture } from "pixi.js";
import { TILE_W, TILE_H, gridToScreen, isoZ } from "./iso";
import type { Palette } from "./theme";
import tileUnpaintedUrl from "@/assets/tile-unpainted.png";
import tilePaintedUrl from "@/assets/tile-painted.png";
import tileUnpaintedSlimeUrl from "@/assets/tile-unpainted-slime.png";
import tilePaintedSlimeUrl from "@/assets/tile-painted-slime.png";
import tileUnpaintedNeonUrl from "@/assets/tile-unpainted-neon.png";
import tilePaintedNeonUrl from "@/assets/tile-painted-neon.png";
import tileUnpaintedWoodUrl from "@/assets/tile-unpainted-wood.png";
import tilePaintedWoodUrl from "@/assets/tile-painted-wood.png";
import tileUnpaintedPaperUrl from "@/assets/tile-unpainted-paper.png";
import tilePaintedPaperUrl from "@/assets/tile-painted-paper.png";

export type TileState = "unpainted" | "painted";
export type TileTheme = "default" | "slime" | "neon" | "wood" | "paper";

// Подгоняет ширину спрайта, сохраняя пропорции, даже если текстура
// ещё не загружена (Texture.from асинхронный).
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

// Кэш текстур, чтобы не грузить на каждую плитку
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

export async function preloadTileTextures() {
  const themes: TileTheme[] = ["default", "slime", "neon", "wood", "paper"];
  await Promise.all(
    themes.flatMap((th) => [
      Assets.load<Texture>(URLS[th].unpainted).then((t) => (_tex[th].unpainted = t)),
      Assets.load<Texture>(URLS[th].painted).then((t) => (_tex[th].painted = t)),
    ]),
  );
}

function getTextures(theme: TileTheme = "default") {
  const slot = _tex[theme];
  if (!slot.unpainted) slot.unpainted = Texture.from(URLS[theme].unpainted);
  if (!slot.painted) slot.painted = Texture.from(URLS[theme].painted);
  return { unpainted: slot.unpainted, painted: slot.painted };
}

export class Tile {
  readonly container: Container;
  private sprite: Sprite;
  private highlight: Graphics;
  state: TileState = "unpainted";
  isStart: boolean;
  private hovered = false;

  constructor(
    public gx: number,
    public gy: number,
    isStart: boolean,
    private palette: Palette,
    private theme: TileTheme = "default",
  ) {
    this.isStart = isStart;
    this.container = new Container();

    const { unpainted } = getTextures(this.theme);
    this.sprite = new Sprite(unpainted);
    // Центр верхнего ромба плитки на исходной картинке (1262x1262) находится
    // примерно в (0.5, 0.424). Используем это как anchor — тогда позиция
    // спрайта совпадает с центром верхней грани в мировых координатах.
    this.sprite.anchor.set(0.5, 0.424);
    // Видимая ширина ромба спрайта ≈ 1090/1262 от полной ширины.
    // Чтобы шаг сетки TILE_W соответствовал ромбу с небольшим зазором,
    // делаем спрайт чуть уже сетки.
    const SPRITE_W = TILE_W * (1262 / 1090) * 0.92; // ~0.92 → воздух между плитками
    fitSpriteWidth(this.sprite, SPRITE_W);

    this.highlight = new Graphics();
    this.highlight.visible = false;
    this.drawHighlight();

    // Контейнер: центр верхнего ромба находится в (0, TILE_H/2)
    this.container.addChild(this.sprite, this.highlight);
    this.sprite.position.set(0, TILE_H / 2);

    const { x, y } = gridToScreen(gx, gy);
    this.container.position.set(x, y);
    this.container.zIndex = isoZ(gx, gy, 0);
  }

  setHovered(on: boolean) {
    if (this.hovered === on) return;
    this.hovered = on;
    this.highlight.visible = on;
  }

  private drawHighlight() {
    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    this.highlight.clear();
    this.highlight.lineStyle({ width: 3, color: 0xffffff, alpha: 0.95 });
    this.highlight.beginFill(0xffffff, 0.18);
    this.highlight.moveTo(0, 0);
    this.highlight.lineTo(hw, hh);
    this.highlight.lineTo(0, TILE_H);
    this.highlight.lineTo(-hw, hh);
    this.highlight.closePath();
    this.highlight.endFill();
  }

  paint() {
    if (this.state === "painted") return false;
    this.state = "painted";
    this.sprite.texture = getTextures(this.theme).painted;
    return true;
  }

  reset() {
    this.state = "unpainted";
    this.sprite.texture = getTextures(this.theme).unpainted;
  }
}
