import type { LevelData } from "../Level";

// Уровни головоломки. Используем 4 направления (диагонали grid: NW/NE/SE/SW),
// которые на экране выглядят как стрелки вверх/вправо/вниз/влево.
// Соседями считаются клетки с шагом ±1 по одной из осей grid.

// Хелпер: построить rows нужного размера, заполнить пустотой
const empty = (w: number, h: number) =>
  Array.from({ length: h }, () => ".".repeat(w));

const setCell = (rows: string[], x: number, y: number, ch: string) => {
  const r = rows[y];
  rows[y] = r.slice(0, x) + ch + r.slice(x + 1);
};

// 1. Квадрат 3x3, старт в углу
function buildLevel1(): LevelData {
  const rows = empty(3, 3);
  for (let y = 0; y < 3; y++) for (let x = 0; x < 3; x++) setCell(rows, x, y, "X");
  setCell(rows, 0, 2, "S");
  return { name: "Разминка", rows };
}

// 2. L-образная фигура (ширина 2)
function buildLevel2(): LevelData {
  const rows = empty(4, 4);
  // вертикальная часть слева (2 ширина, 4 высота)
  for (let y = 0; y < 4; y++) for (let x = 0; x < 2; x++) setCell(rows, x, y, "X");
  // горизонтальная часть снизу
  for (let x = 0; x < 4; x++) for (let y = 2; y < 4; y++) setCell(rows, x, y, "X");
  setCell(rows, 0, 0, "S");
  return { name: "Уголок", rows };
}

// 3. T-образная фигура с настоящими тупиками
function buildLevel3(): LevelData {
  const rows = empty(5, 4);
  // верхняя горизонталь (шапка T)
  for (let x = 0; x < 5; x++) setCell(rows, x, 0, "X");
  // ножка T (центральная вертикаль)
  for (let y = 1; y < 4; y++) setCell(rows, 2, y, "X");
  setCell(rows, 2, 3, "S"); // старт у основания
  return { name: "Развилка", rows };
}

// 4. Кольцо 4x4 с пустотой 2x2 в центре
function buildLevel4(): LevelData {
  const rows = empty(4, 4);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < 4; x++) {
      const inHole = x >= 1 && x <= 2 && y >= 1 && y <= 2;
      if (!inHole) setCell(rows, x, y, "X");
    }
  }
  setCell(rows, 0, 0, "S");
  return { name: "Кольцо", rows };
}

// 5. Крест: центральный квадрат + 4 луча
function buildLevel5(): LevelData {
  const rows = empty(7, 7);
  // центральный 1x1 — клетка (3,3); лучи длиной 3 в каждую сторону
  for (let i = 0; i <= 3; i++) {
    setCell(rows, 3, 3 - i, "X"); // вверх
    setCell(rows, 3, 3 + i, "X"); // вниз
    setCell(rows, 3 - i, 3, "X"); // влево
    setCell(rows, 3 + i, 3, "X"); // вправо
  }
  setCell(rows, 3, 3, "S");
  return { name: "Звезда", rows };
}

export const levels: LevelData[] = [
  buildLevel1(),
  buildLevel2(),
  buildLevel3(),
  buildLevel4(),
  buildLevel5(),
];
