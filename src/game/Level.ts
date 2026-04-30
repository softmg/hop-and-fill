import { Container } from "pixi.js";
import { Tile } from "./Tile";
import type { Palette } from "./theme";

export interface LevelData {
  name: string;
  // Каждая строка — ряд по gy. Символы: 'X' плитка, 'S' старт-плитка, '.' пусто.
  rows: string[];
}

export class Level {
  readonly container: Container;
  readonly tiles: Map<string, Tile> = new Map();
  startGx = 0;
  startGy = 0;

  constructor(public data: LevelData, palette: Palette) {
    this.container = new Container();
    this.container.sortableChildren = true;

    data.rows.forEach((row, gy) => {
      [...row].forEach((ch, gx) => {
        if (ch === "." || ch === " ") return;
        const isStart = ch === "S";
        const tile = new Tile(gx, gy, isStart, palette);
        this.tiles.set(key(gx, gy), tile);
        this.container.addChild(tile.container);
        if (isStart) {
          this.startGx = gx;
          this.startGy = gy;
        }
      });
    });
  }

  has(gx: number, gy: number) {
    return this.tiles.has(key(gx, gy));
  }

  get(gx: number, gy: number) {
    return this.tiles.get(key(gx, gy));
  }

  isComplete() {
    for (const t of this.tiles.values()) {
      if (t.state !== "painted") return false;
    }
    return true;
  }

  reset() {
    for (const t of this.tiles.values()) t.reset();
  }
}

function key(gx: number, gy: number) {
  return `${gx},${gy}`;
}
