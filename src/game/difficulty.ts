import type { LevelData } from "./Level";

// Расчёт минимально возможного количества ходов для уровня.
// Соседство — 4 ортогональных направления по grid (±1 по одной оси).
// Формула:
//   M_opt = (N - 1) + 2 * max(0, T - 1) + S_p
// где:
//   N  — количество закрашиваемых плиток
//   T  — количество тупиков (степень = 1 в графе плиток)
//   S_p — пенальти стартовой позиции:
//          0, если старт в тупике (degree == 1)
//          иначе max(0, T) - (degree>=3 ? 1 : 0)  — упрощённо: 0 если degree<=2 и T<=1
//
// Чтобы не усложнять и при этом отражать концепт: если старт не в тупике и
// есть тупики, добавляем 1 за каждый тупик сверх first-leaf, который мы не
// можем "съесть" по пути. Реализуем как: S_p = (старт_не_в_тупике ? 1 : 0) если T>0.

interface ParsedLevel {
  cells: Array<{ gx: number; gy: number; isStart: boolean }>;
  startGx: number;
  startGy: number;
}

function parse(level: LevelData): ParsedLevel {
  const cells: ParsedLevel["cells"] = [];
  let startGx = 0, startGy = 0;
  level.rows.forEach((row, gy) => {
    [...row].forEach((ch, gx) => {
      if (ch === "." || ch === " ") return;
      const isStart = ch === "S";
      cells.push({ gx, gy, isStart });
      if (isStart) { startGx = gx; startGy = gy; }
    });
  });
  return { cells, startGx, startGy };
}

function buildAdjacency(cells: ParsedLevel["cells"]) {
  const set = new Set(cells.map((c) => `${c.gx},${c.gy}`));
  const deg = new Map<string, number>();
  for (const c of cells) {
    let d = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (set.has(`${c.gx + dx},${c.gy + dy}`)) d++;
    }
    deg.set(`${c.gx},${c.gy}`, d);
  }
  return deg;
}

export function computeOptimalMoves(level: LevelData): number {
  const parsed = parse(level);
  const N = parsed.cells.length;
  if (N <= 1) return 0;
  const deg = buildAdjacency(parsed.cells);
  let T = 0;
  for (const d of deg.values()) if (d === 1) T++;
  const startDeg = deg.get(`${parsed.startGx},${parsed.startGy}`) ?? 0;
  const startInDeadEnd = startDeg === 1;

  // Каждый тупик кроме одного "финального" требует возврата (+2 хода).
  // Если старт в тупике — он сам "съедает" один тупик бесплатно.
  const extraDeadEnds = Math.max(0, T - 1);
  const Sp = !startInDeadEnd && T > 0 ? 1 : 0;
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
