import { describe, expect, it } from "vitest";
import type { LevelData } from "../Level";
import { deriveChapters, getChapterTransition, getLevelTheme } from "./chapters";

const fixtureLevels: LevelData[] = [
  { name: "One", rows: ["S"], theme: "default", chapter: 1, difficulty: 1 },
  { name: "Two", rows: ["S"], chapter: 1, difficulty: 1 },
  { name: "Three", rows: ["S"], theme: "slime", chapter: 2, difficulty: 1 },
  { name: "Four", rows: ["S"], theme: "slime", chapter: 2, difficulty: 1 },
  { name: "Five", rows: ["S"], theme: "wood", chapter: 3, difficulty: 1 },
];

describe("chapter helpers", () => {
  it("treats missing theme as default", () => {
    expect(getLevelTheme(fixtureLevels[1])).toBe("default");
  });

  it("groups adjacent levels by theme", () => {
    expect(deriveChapters(fixtureLevels)).toEqual([
      {
        chapterIndex: 1,
        startLevelIndex: 0,
        endLevelIndex: 1,
        theme: "default",
        themeLabel: "Плюшевая долина",
      },
      {
        chapterIndex: 2,
        startLevelIndex: 2,
        endLevelIndex: 3,
        theme: "slime",
        themeLabel: "Желейное болото",
      },
      {
        chapterIndex: 3,
        startLevelIndex: 4,
        endLevelIndex: 4,
        theme: "wood",
        themeLabel: "Столярная мастерская",
      },
    ]);
  });

  it("returns a transition only at chapter boundaries", () => {
    expect(getChapterTransition(fixtureLevels, 0)).toBeNull();
    expect(getChapterTransition(fixtureLevels, 1)).toMatchObject({
      nextLevelIndex: 2,
      fromChapter: { chapterIndex: 1, theme: "default" },
      toChapter: { chapterIndex: 2, theme: "slime" },
    });
    expect(getChapterTransition(fixtureLevels, 4)).toBeNull();
  });
});
