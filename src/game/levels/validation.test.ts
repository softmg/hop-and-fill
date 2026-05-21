import { beforeAll, describe, expect, it } from "vitest";
import type { LevelData } from "../Level";
import { levels } from "./index";
import { formatLevelsValidationReport, validateLevels } from "./validation";

describe("level metadata", () => {
  it("assigns metadata to every shipped level", () => {
    expect(levels).toHaveLength(25);

    for (const level of levels) {
      expect(level.chapter).toBeGreaterThanOrEqual(1);
      expect(level.difficulty).toBeGreaterThanOrEqual(1);
      expect(level.difficulty).toBeLessThanOrEqual(5);
      expect(level.rows.some((row) => row.includes("S"))).toBe(true);
      expect(level.mOpt).toBeGreaterThanOrEqual(0);
      expect(level.starThresholds?.threeStars).toBe(level.mOpt);
      expect(level.starThresholds?.twoStars).toBeGreaterThanOrEqual(level.starThresholds?.threeStars ?? 0);
      expect(level.starThresholds?.oneStar).toBeGreaterThanOrEqual(level.starThresholds?.twoStars ?? 0);

      if (level.chapter >= 2) {
        expect(level.fragileCells?.length).toBeGreaterThanOrEqual(1);
      } else {
        expect(level.fragileCells).toBeUndefined();
      }

      if (level.chapter >= 3) {
        expect(level.teleportPairs?.length).toBeGreaterThanOrEqual(1);
      } else {
        expect(level.teleportPairs).toBeUndefined();
      }
    }

    expect(levels.map((level) => ({ name: level.name, chapter: level.chapter, theme: level.theme ?? "default" }))).toEqual([
      { name: "Square", chapter: 1, theme: "default" },
      { name: "T Shape", chapter: 1, theme: "default" },
      { name: "Zigzag Spine", chapter: 1, theme: "default" },
      { name: "Offset Rooms", chapter: 1, theme: "default" },
      { name: "Asymmetric Gauntlet", chapter: 1, theme: "default" },
      { name: "Bent Orchard", chapter: 2, theme: "slime" },
      { name: "Cracked Arcade", chapter: 2, theme: "slime" },
      { name: "Kite Junction", chapter: 2, theme: "slime" },
      { name: "Soft Reboot", chapter: 2, theme: "slime" },
      { name: "Angled Pockets", chapter: 2, theme: "slime" },
      { name: "Broken Switchbacks", chapter: 3, theme: "neon" },
      { name: "Deep Switchback", chapter: 3, theme: "neon" },
      { name: "Sawtooth Gate", chapter: 3, theme: "neon" },
      { name: "Layered Passage", chapter: 3, theme: "neon" },
      { name: "Hidden Spine", chapter: 3, theme: "neon" },
      { name: "Soft Drop", chapter: 4, theme: "wood" },
      { name: "Bent Gallery", chapter: 4, theme: "wood" },
      { name: "Half-Moon Yard", chapter: 4, theme: "wood" },
      { name: "Skewed Garden", chapter: 4, theme: "wood" },
      { name: "Cutout Lane", chapter: 4, theme: "wood" },
      { name: "Crooked Reservoir", chapter: 5, theme: "paper" },
      { name: "Branchlock Court", chapter: 5, theme: "paper" },
      { name: "Twinned Ridges", chapter: 5, theme: "paper" },
      { name: "Longhook Maze", chapter: 5, theme: "paper" },
      { name: "Square Route Crown", chapter: 5, theme: "paper" },
    ]);

    expect(levels[9]).toMatchObject({
      name: "Angled Pockets",
      chapter: 2,
      difficulty: 4,
      mOpt: 29,
      starThresholds: { threeStars: 29, twoStars: 31, oneStar: 34 },
    });
    expect(levels[14]).toMatchObject({
      name: "Hidden Spine",
      chapter: 3,
      difficulty: 4,
      mOpt: 29,
      starThresholds: { threeStars: 29, twoStars: 31, oneStar: 34 },
    });
    expect(levels[19]).toMatchObject({
      name: "Cutout Lane",
      chapter: 4,
      difficulty: 4,
      mOpt: 45,
      starThresholds: { threeStars: 45, twoStars: 47, oneStar: 50 },
    });
    expect(levels[21]).toMatchObject({
      name: "Branchlock Court",
      chapter: 5,
      difficulty: 5,
      mOpt: 53,
      starThresholds: { threeStars: 53, twoStars: 55, oneStar: 58 },
    });
    expect(levels[24]).toMatchObject({
      name: "Square Route Crown",
      chapter: 5,
      difficulty: 5,
      mOpt: 85,
      starThresholds: { threeStars: 85, twoStars: 87, oneStar: 90 },
    });
  });
});

describe("level validation", () => {
  let report: ReturnType<typeof validateLevels>;

  beforeAll(() => {
    report = validateLevels(levels);
  }, 30_000);

  it("produces stable metrics for representative current levels", () => {
    expect(report.warnings).toEqual([]);
    expect(report.levels[0]).toMatchObject({
      index: 1,
      name: "Square",
      chapter: 1,
      difficulty: 1,
      tileCount: 9,
      optimalMoves: 8,
      moveLimit: 13,
      deadEndCount: 0,
      branchingCount: 9,
      graphDiameter: 2,
      startPenalty: 0,
      expectedRetryDifficulty: "medium",
    });
    expect(report.levels[3]).toMatchObject({
      index: 4,
      name: "Offset Rooms",
      chapter: 1,
      difficulty: 3,
      theme: "default",
      tileCount: 24,
      optimalMoves: 23,
      moveLimit: 28,
      deadEndCount: 0,
      branchingCount: 17,
      graphDiameter: 7,
      startPenalty: 0,
      expectedRetryDifficulty: "high",
    });
  });

  it("formats the report as readable line output", () => {
    const output = formatLevelsValidationReport(report);

    expect(output).toContain("Hop and Fill level validation");
    expect(output).toContain("L01 Square");
    expect(output).toContain("Warnings: none");
  });

  it("warns about fragile starts and reused teleport endpoints", () => {
    const invalidLevel = {
      name: "Invalid Feature Endpoints",
      rows: [
        "SXX",
        "XXX",
        "XXX",
      ],
      chapter: 1,
      difficulty: 1,
      fragileCells: [{ gx: 0, gy: 0 }],
      teleportPairs: [
        { from: { gx: 0, gy: 1 }, to: { gx: 2, gy: 2 } },
        { from: { gx: 0, gy: 1 }, to: { gx: 2, gy: 0 } },
      ],
    } satisfies LevelData;

    expect(validateLevels([invalidLevel]).warnings).toEqual(expect.arrayContaining([
      "L1 Invalid Feature Endpoints: fragile cell is the start tile: 0,0",
      "L1 Invalid Feature Endpoints: teleport endpoint is reused 2 times: 0,1",
    ]));
  });

  it("keeps shipped teleports structural in representative advanced levels", () => {
    for (const levelName of [
      "Broken Switchbacks",
      "Hidden Spine",
      "Half-Moon Yard",
      "Branchlock Court",
    ]) {
      expect(report.levels.find((level) => level.name === levelName)).toMatchObject({
        teleportRequiredForOptimal: true,
        optimalRouteUsesTeleport: true,
      });
    }
  });

  it("keeps the redesigned chapters under higher route-planning pressure", () => {
    expect(report.levels.filter((level) => level.chapter === 2).map((level) => level.interiorFragileCount)).toEqual([2, 3, 3, 2, 2]);
    expect(report.levels.filter((level) => level.chapter === 3).map((level) => level.interiorFragileCount)).toEqual([3, 3, 3, 3, 3]);
    expect(report.levels.filter((level) => level.chapter === 4).map((level) => level.interiorFragileCount)).toEqual([4, 4, 4, 4, 4]);
    expect(report.levels.filter((level) => level.chapter === 5).map((level) => level.interiorFragileCount)).toEqual([4, 4, 4, 4, 4]);

    const chapterAverages = [2, 3, 4, 5].map((chapter) => {
      const chapterLevels = report.levels.filter((level) => level.chapter === chapter);
      return chapterLevels.reduce((sum, level) => sum + level.routeDecisionScore, 0) / chapterLevels.length;
    });

    expect(chapterAverages).toEqual([...chapterAverages].sort((a, b) => a - b));
  });
});
