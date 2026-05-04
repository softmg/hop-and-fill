import type { LevelData, StarThresholds } from "./Level.ts";
import {
  countDeadEnds,
  getDistanceToNearestDeadEnd,
  parseLevelGraph,
} from "./levelAnalysis.ts";

// ──────────────────────────────────────────────────────────────────────────────
// Расчёт минимального количества ходов (M_opt) для уровня-головоломки.
//
// Соседство — 8 направлений, шаг ±1 по одной или обеим осям.
//
// Формула:
//     M_opt = (N - 1) + 2 * max(0, T - 1) + Sp
// где:
//   N  — количество закрашиваемых плиток,
//   T  — количество тупиков (клеток со степенью 1 в графе плиток),
//   Sp — пенальти старта: кратчайшее расстояние (в шагах) от стартовой
//        клетки до ближайшего тупика. Если тупиков нет — Sp = 0.
//
// Идея Sp: из любой стартовой позиции, не являющейся тупиком, нам всё равно
// придётся «дойти» до самого дальнего тупика, чтобы там закончить маршрут.
// А значит, в начале мы вынуждены потратить какое-то число шагов до
// ближайшего тупика, чтобы оттуда оптимально пойти по графу. Эти шаги и
// есть Sp. Для старта прямо в тупике Sp = 0.
// ──────────────────────────────────────────────────────────────────────────────

export function computeOptimalMoves(level: LevelData): number {
  if (typeof level.mOpt === "number" && Number.isFinite(level.mOpt) && level.mOpt >= 0) {
    return Math.trunc(level.mOpt);
  }

  const graph = parseLevelGraph(level);
  const N = graph.cells.length;
  if (N <= 1) return 0;

  const T = countDeadEnds(graph);
  const Sp = getDistanceToNearestDeadEnd(graph);

  // Каждый тупик кроме одного "финального" требует возврата (+2 хода).
  const extraDeadEnds = Math.max(0, T - 1);
  return (N - 1) + 2 * extraDeadEnds + Sp;
}

export function getStarThresholds(levelOrOptimal: LevelData | number): StarThresholds {
  if (typeof levelOrOptimal === "number") {
    return {
      threeStars: levelOrOptimal,
      twoStars: levelOrOptimal + 3,
      oneStar: levelOrOptimal + 5,
    };
  }

  if (levelOrOptimal.starThresholds) {
    return levelOrOptimal.starThresholds;
  }

  return getStarThresholds(computeOptimalMoves(levelOrOptimal));
}

export function moveLimit(levelOrOptimal: LevelData | number): number {
  return getStarThresholds(levelOrOptimal).oneStar;
}

export function computeStars(hops: number, levelOrOptimal: LevelData | number): 1 | 2 | 3 {
  const thresholds = getStarThresholds(levelOrOptimal);
  if (hops <= thresholds.threeStars) return 3;
  if (hops <= thresholds.twoStars) return 2;
  return 1;
}
