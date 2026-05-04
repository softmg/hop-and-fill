import type { LevelData } from "../Level.ts";
import { computeOptimalMoves, moveLimit } from "../difficulty.ts";
import { analyzeLevelGraph } from "../levelAnalysis.ts";

export type RetryDifficulty = "low" | "medium" | "high";

export interface LevelValidationRow {
  index: number;
  name: string;
  theme: NonNullable<LevelData["theme"]> | "default";
  chapter: number;
  difficulty: LevelData["difficulty"];
  intendedTrick: string | null;
  tileCount: number;
  optimalMoves: number;
  moveLimit: number;
  deadEndCount: number;
  branchingCount: number;
  graphDiameter: number;
  startPenalty: number;
  expectedRetryDifficulty: RetryDifficulty;
  warnings: string[];
}

export interface LevelsValidationReport {
  levels: LevelValidationRow[];
  warnings: string[];
}

function inferRetryDifficulty(row: Omit<LevelValidationRow, "expectedRetryDifficulty" | "warnings">): RetryDifficulty {
  const score =
    row.difficulty +
    row.deadEndCount * 0.5 +
    row.branchingCount * 0.75 +
    row.startPenalty +
    Math.max(0, row.graphDiameter - 4) * 0.25;

  if (score >= 9) return "high";
  if (score >= 5) return "medium";
  return "low";
}

function validateLevel(level: LevelData, index: number, seenNames: Set<string>) {
  const graphMetrics = analyzeLevelGraph(level);
  const optimalMoves = computeOptimalMoves(level);
  const limit = moveLimit(level);
  const warnings: string[] = [];

  if (graphMetrics.startCellCount === 0) {
    warnings.push("missing start tile");
  } else if (graphMetrics.startCellCount > 1) {
    warnings.push(`multiple start tiles: ${graphMetrics.startCellCount}`);
  }

  if (!Number.isInteger(level.chapter) || level.chapter < 1) {
    warnings.push(`invalid chapter value: ${level.chapter}`);
  }

  if (!Number.isInteger(level.difficulty) || level.difficulty < 1 || level.difficulty > 5) {
    warnings.push(`invalid difficulty value: ${level.difficulty}`);
  }

  if (limit < optimalMoves) {
    warnings.push(`move limit ${limit} is lower than optimal ${optimalMoves}`);
  }

  if (seenNames.has(level.name)) {
    warnings.push(`duplicate level name: ${level.name}`);
  }
  seenNames.add(level.name);

  const rowBase = {
    index: index + 1,
    name: level.name,
    theme: level.theme ?? "default",
    chapter: level.chapter,
    difficulty: level.difficulty,
    intendedTrick: level.intendedTrick ?? null,
    tileCount: graphMetrics.tileCount,
    optimalMoves,
    moveLimit: limit,
    deadEndCount: graphMetrics.deadEndCount,
    branchingCount: graphMetrics.branchingCount,
    graphDiameter: graphMetrics.graphDiameter,
    startPenalty: graphMetrics.startPenalty,
  };

  return {
    ...rowBase,
    expectedRetryDifficulty: inferRetryDifficulty(rowBase),
    warnings,
  } satisfies LevelValidationRow;
}

export function validateLevels(levels: LevelData[]): LevelsValidationReport {
  const seenNames = new Set<string>();
  const rows = levels.map((level, index) => validateLevel(level, index, seenNames));

  return {
    levels: rows,
    warnings: rows.flatMap((row) => row.warnings.map((warning) => `L${row.index} ${row.name}: ${warning}`)),
  };
}

export function formatLevelsValidationReport(report: LevelsValidationReport) {
  const lines = ["Crash Cubes level validation", `Levels analyzed: ${report.levels.length}`, ""];

  for (const level of report.levels) {
    lines.push(
      [
        `L${level.index.toString().padStart(2, "0")} ${level.name}`,
        `chapter=${level.chapter}`,
        `difficulty=${level.difficulty}`,
        `theme=${level.theme}`,
        `tiles=${level.tileCount}`,
        `optimal=${level.optimalMoves}`,
        `limit=${level.moveLimit}`,
        `deadEnds=${level.deadEndCount}`,
        `branching=${level.branchingCount}`,
        `diameter=${level.graphDiameter}`,
        `startPenalty=${level.startPenalty}`,
        `retry=${level.expectedRetryDifficulty}`,
        `trick=${level.intendedTrick ?? "-"}`,
      ].join(" | "),
    );
  }

  lines.push("");
  lines.push(report.warnings.length > 0 ? "Warnings:" : "Warnings: none");

  for (const warning of report.warnings) {
    lines.push(`- ${warning}`);
  }

  return lines.join("\n");
}
