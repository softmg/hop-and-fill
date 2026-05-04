import type { LevelData } from "../Level.ts";

export const level1: LevelData = {
  name: "Square",
  rows: [
    "XXX",
    "XSX",
    "XXX",
  ],
  chapter: 1,
  difficulty: 1,
  mOpt: 8,
  starThresholds: { threeStars: 8, twoStars: 10, oneStar: 13 },
};
