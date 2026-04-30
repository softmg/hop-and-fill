import type { LevelData } from "./Level";

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

// Карта степеней каждой проходимой клетки (число ортогональных соседей).
function buildDegreeMap(cells: ParsedLevel["cells"]) {
  const set = new Set(cells.map((c) => `${c.gx},${c.gy}`));
  const deg = new Map<string, number>();
  for (const c of cells) {
    let d = 0;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      if (set.has(`${c.gx + dx},${c.gy + dy}`)) d++;
    }
    deg.set(`${c.gx},${c.gy}`, d);
  }
  return { deg, set };
}

/**
 * BFS-поиск кратчайшего расстояния от стартовой клетки до ближайшего тупика.
 * Тупик — проходимая клетка ровно с одним ортогональным соседом.
 *
 * @returns Количество шагов до ближайшего тупика. 0, если тупиков нет
 *          или старт сам является тупиком.
 */
function getDistanceToNearestDeadEnd(
  cells: ParsedLevel["cells"],
  startGx: number,
  startGy: number,
): number {
  const { deg, set } = buildDegreeMap(cells);
  const startKey = `${startGx},${startGy}`;
  if (!set.has(startKey)) return 0;
  // Если в графе вообще нет тупиков — возвращаем 0 (например, замкнутое кольцо).
  let hasAnyDeadEnd = false;
  for (const d of deg.values()) if (d === 1) { hasAnyDeadEnd = true; break; }
  if (!hasAnyDeadEnd) return 0;

  // Стандартный BFS по 4 направлениям.
  const visited = new Set<string>([startKey]);
  const queue: Array<{ key: string; gx: number; gy: number; dist: number }> = [
    { key: startKey, gx: startGx, gy: startGy, dist: 0 },
  ];
  while (queue.length > 0) {
    const cur = queue.shift()!;
    if ((deg.get(cur.key) ?? 0) === 1) return cur.dist;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const nx = cur.gx + dx;
      const ny = cur.gy + dy;
      const nk = `${nx},${ny}`;
      if (!set.has(nk) || visited.has(nk)) continue;
      visited.add(nk);
      queue.push({ key: nk, gx: nx, gy: ny, dist: cur.dist + 1 });
    }
  }
  // На случай несвязного графа без достижимых тупиков.
  return 0;
}

export function computeOptimalMoves(level: LevelData): number {
  const parsed = parse(level);
  const N = parsed.cells.length;
  if (N <= 1) return 0;

  // Считаем общее число тупиков T по всему полю.
  const { deg } = buildDegreeMap(parsed.cells);
  let T = 0;
  for (const d of deg.values()) if (d === 1) T++;

  // Sp — динамическое пенальти старта через BFS до ближайшего тупика.
  const Sp = getDistanceToNearestDeadEnd(
    parsed.cells,
    parsed.startGx,
    parsed.startGy,
  );

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
