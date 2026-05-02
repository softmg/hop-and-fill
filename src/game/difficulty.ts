import type { LevelData } from "./Level.ts";
import {
  countDeadEnds,
  getDistanceToNearestDeadEnd,
  parseLevelGraph,
} from "./levelAnalysis.ts";

// ──────────────────────────────────────────────────────────────────────────────
// Расчёт минимального количества ходов (M_opt) для уровня-головоломки.
//
// Соседство — 4 ортогональных направления (N/E/S/W), шаг ±1 по одной из осей.
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
  const graph = parseLevelGraph(level);
  const N = graph.cells.length;
  if (N <= 1) return 0;

  const T = countDeadEnds(graph);
  const Sp = getDistanceToNearestDeadEnd(graph);

  // Каждый тупик кроме одного "финального" требует возврата (+2 хода).
  const extraDeadEnds = Math.max(0, T - 1);
  return (N - 1) + 2 * extraDeadEnds + Sp;
}

export function moveLimit(optimal: number): number {
  return optimal + 5;
}

export function computeStars(hops: number, optimal: number): 1 | 2 | 3 {
  if (hops <= optimal) return 3;
  if (hops <= optimal + 3) return 2;
  return 1;
}
