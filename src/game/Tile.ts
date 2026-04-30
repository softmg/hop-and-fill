import { Container, Graphics } from "pixi.js";
import { TILE_W, TILE_H, TILE_DEPTH, gridToScreen, isoZ } from "./iso";
import type { Palette } from "./theme";

export type TileState = "unpainted" | "painted";

export class Tile {
  readonly container: Container;
  private top: Graphics;
  private left: Graphics;
  private right: Graphics;
  private highlight: Graphics;
  state: TileState = "unpainted";
  isStart: boolean;
  private hovered = false;

  constructor(
    public gx: number,
    public gy: number,
    isStart: boolean,
    private palette: Palette,
  ) {
    this.isStart = isStart;
    this.container = new Container();
    this.top = new Graphics();
    this.left = new Graphics();
    this.right = new Graphics();
    this.highlight = new Graphics();
    this.highlight.visible = false;
    this.container.addChild(this.left, this.right, this.top, this.highlight);

    const { x, y } = gridToScreen(gx, gy);
    this.container.position.set(x, y);
    this.container.zIndex = isoZ(gx, gy, 0);

    this.draw();
    this.drawHighlight();
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
    this.draw();
    return true;
  }

  reset() {
    this.state = "unpainted";
    this.draw();
  }

  private draw() {
    const p = this.palette;
    const useStart = this.isStart && this.state === "unpainted";
    const topColor = useStart ? p.tileStartTop
      : this.state === "painted" ? p.tilePaintedTop : p.tileUnpaintedTop;
    const leftColor = useStart ? p.tileStartLeft
      : this.state === "painted" ? p.tilePaintedLeft : p.tileUnpaintedLeft;
    const rightColor = useStart ? p.tileStartRight
      : this.state === "painted" ? p.tilePaintedRight : p.tileUnpaintedRight;

    const hw = TILE_W / 2;
    const hh = TILE_H / 2;
    const d = TILE_DEPTH;

    // Top diamond (центр спрайта = верхний центр ромба верхней грани)
    this.top.clear();
    this.top.lineStyle({ width: 1, color: p.tileEdge, alpha: 0.35 });
    this.top.beginFill(topColor);
    this.top.moveTo(0, 0);
    this.top.lineTo(hw, hh);
    this.top.lineTo(0, TILE_H);
    this.top.lineTo(-hw, hh);
    this.top.closePath();
    this.top.endFill();

    // Левая боковая грань (от нижней-левой вершины ромба вниз)
    this.left.clear();
    this.left.lineStyle({ width: 1, color: p.tileEdge, alpha: 0.4 });
    this.left.beginFill(leftColor);
    this.left.moveTo(-hw, hh);
    this.left.lineTo(0, TILE_H);
    this.left.lineTo(0, TILE_H + d);
    this.left.lineTo(-hw, hh + d);
    this.left.closePath();
    this.left.endFill();

    // Правая боковая грань
    this.right.clear();
    this.right.lineStyle({ width: 1, color: p.tileEdge, alpha: 0.4 });
    this.right.beginFill(rightColor);
    this.right.moveTo(hw, hh);
    this.right.lineTo(0, TILE_H);
    this.right.lineTo(0, TILE_H + d);
    this.right.lineTo(hw, hh + d);
    this.right.closePath();
    this.right.endFill();
  }
}
