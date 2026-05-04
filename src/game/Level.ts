import { Container } from "pixi.js";
import { Tile, type TileState, type TileTheme } from "./Tile";
import type { Palette } from "./theme";

export type LevelDifficulty = 1 | 2 | 3 | 4 | 5;

export interface LevelMetadata {
  chapter: number;
  difficulty: LevelDifficulty;
  intendedTrick?: string;
}

export interface StarThresholds {
  threeStars: number;
  twoStars: number;
  oneStar: number;
}

export interface LevelData {
  name: string;
  // Каждая строка — ряд по gy. Символы: 'X' плитка, 'S' старт-плитка, '.' пусто.
  rows: string[];
  theme?: TileTheme;
  chapter: number;
  difficulty: LevelDifficulty;
  intendedTrick?: string;
  // Optional balancing data from imported level packs.
  mOpt?: number;
  starThresholds?: StarThresholds;
}

export class Level {
  readonly container: Container;
  readonly tiles: Map<string, Tile> = new Map();
  startGx = 0;
  startGy = 0;

  constructor(public data: LevelData, palette: Palette) {
    this.container = new Container();
    this.container.sortableChildren = true;
    const theme: TileTheme = data.theme ?? "default";

    data.rows.forEach((row, gy) => {
      [...row].forEach((ch, gx) => {
        if (ch === "." || ch === " ") return;
        const isStart = ch === "S";
        const tile = new Tile(gx, gy, isStart, palette, theme);
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

  getTileState(gx: number, gy: number): TileState | null {
    return this.get(gx, gy)?.state ?? null;
  }

  setTileState(gx: number, gy: number, state: TileState) {
    const tile = this.get(gx, gy);
    if (!tile) return false;
    if (state === "painted") {
      tile.paint();
      return true;
    }
    tile.reset();
    return true;
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
