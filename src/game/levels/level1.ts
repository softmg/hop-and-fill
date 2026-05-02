import type { LevelData } from "../Level.ts";

// 8x8 поле, старт в центре
export const level1: LevelData = {
  name: "Уровень 1",
  rows: [
    "XXXXXXXX",
    "XXXXXXXX",
    "XXXXXXXX",
    "XXXSXXXX",
    "XXXXXXXX",
    "XXXXXXXX",
    "XXXXXXXX",
    "XXXXXXXX",
  ],
  chapter: 1,
  difficulty: 1,
  intendedTrick: "basic coverage from a center-near start",
};
