import { describe, expect, it } from "vitest";
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
    }

    expect(levels.map((level) => ({ name: level.name, chapter: level.chapter, theme: level.theme ?? "default" }))).toEqual([
      { name: "Square", chapter: 1, theme: "default" },
      { name: "T Shape", chapter: 1, theme: "default" },
      { name: "Zigzag Spine", chapter: 1, theme: "default" },
      { name: "Offset Rooms", chapter: 1, theme: "default" },
      { name: "Asymmetric Gauntlet", chapter: 1, theme: "default" },
      { name: "Broken Bridge", chapter: 2, theme: "slime" },
      { name: "Branching Labyrinth", chapter: 2, theme: "slime" },
      { name: "Bent Orchard", chapter: 2, theme: "slime" },
      { name: "Cracked Arcade", chapter: 2, theme: "slime" },
      { name: "Sawtooth Gate", chapter: 2, theme: "slime" },
      { name: "Broken Switchbacks", chapter: 3, theme: "neon" },
      { name: "Hidden Spine", chapter: 3, theme: "neon" },
      { name: "Skewed Garden", chapter: 3, theme: "neon" },
      { name: "Deep Switchback", chapter: 3, theme: "neon" },
      { name: "Gauntlet Return", chapter: 3, theme: "neon" },
      { name: "Bent Gallery", chapter: 4, theme: "wood" },
      { name: "Branchlock Court", chapter: 4, theme: "wood" },
      { name: "Twinned Ridges", chapter: 4, theme: "wood" },
      { name: "Longhook Maze", chapter: 4, theme: "wood" },
      { name: "Bent Stronghold", chapter: 4, theme: "wood" },
      { name: "Soft Drop", chapter: 5, theme: "paper" },
      { name: "Asymmetric Bastion", chapter: 5, theme: "paper" },
      { name: "Hooked Citadel", chapter: 5, theme: "paper" },
      { name: "Broken Ramparts", chapter: 5, theme: "paper" },
      { name: "Shifted Fortress", chapter: 5, theme: "paper" },
    ]);

    expect(levels[9]).toMatchObject({
      name: "Sawtooth Gate",
      chapter: 2,
      difficulty: 5,
      mOpt: 46,
      starThresholds: { threeStars: 46, twoStars: 48, oneStar: 51 },
    });
    expect(levels[14]).toMatchObject({
      name: "Gauntlet Return",
      chapter: 3,
      difficulty: 5,
      mOpt: 57,
      starThresholds: { threeStars: 57, twoStars: 59, oneStar: 62 },
    });
    expect(levels[19]).toMatchObject({
      name: "Bent Stronghold",
      chapter: 4,
      difficulty: 5,
      mOpt: 65,
      starThresholds: { threeStars: 65, twoStars: 67, oneStar: 70 },
    });
    expect(levels[21]).toMatchObject({
      name: "Asymmetric Bastion",
      chapter: 5,
      difficulty: 5,
      mOpt: 62,
      starThresholds: { threeStars: 62, twoStars: 64, oneStar: 67 },
    });
    expect(levels[24]).toMatchObject({
      name: "Shifted Fortress",
      chapter: 5,
      difficulty: 5,
      mOpt: 103,
      starThresholds: { threeStars: 103, twoStars: 105, oneStar: 108 },
    });
  });
});

describe("level validation", () => {
  it("produces stable metrics for representative current levels", () => {
    const report = validateLevels(levels);

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
    const output = formatLevelsValidationReport(validateLevels(levels));

    expect(output).toContain("Crash Cubes level validation");
    expect(output).toContain("L01 Square");
    expect(output).toContain("Warnings: none");
  });
});
