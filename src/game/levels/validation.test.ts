import { describe, expect, it } from "vitest";
import { levels } from "./index";
import { formatLevelsValidationReport, validateLevels } from "./validation";

describe("level metadata", () => {
  it("assigns metadata to every shipped level", () => {
    expect(levels).toHaveLength(10);

    for (const level of levels) {
      expect(level.chapter).toBe(1);
      expect(level.difficulty).toBeGreaterThanOrEqual(1);
      expect(level.difficulty).toBeLessThanOrEqual(5);
      expect(level.rows.some((row) => row.includes("S"))).toBe(true);
    }
  });
});

describe("level validation", () => {
  it("produces stable metrics for representative current levels", () => {
    const report = validateLevels(levels);

    expect(report.warnings).toEqual([]);
    expect(report.levels[0]).toMatchObject({
      index: 1,
      name: "Разминка",
      chapter: 1,
      difficulty: 1,
      tileCount: 9,
      optimalMoves: 8,
      moveLimit: 13,
      deadEndCount: 0,
      branchingCount: 5,
      graphDiameter: 4,
      startPenalty: 0,
      expectedRetryDifficulty: "low",
    });
    expect(report.levels[3]).toMatchObject({
      index: 4,
      name: "Кольцо",
      theme: "slime",
      tileCount: 12,
      optimalMoves: 11,
      moveLimit: 16,
      deadEndCount: 0,
      branchingCount: 0,
      graphDiameter: 6,
      startPenalty: 0,
      expectedRetryDifficulty: "low",
    });
  });

  it("formats the report as readable line output", () => {
    const output = formatLevelsValidationReport(validateLevels(levels));

    expect(output).toContain("Crash Cubes level validation");
    expect(output).toContain("L01 Разминка");
    expect(output).toContain("Warnings: none");
  });
});
