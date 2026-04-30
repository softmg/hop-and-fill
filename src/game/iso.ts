// Изометрическая проекция: grid (gx, gy) -> экран (screenX, screenY)
// Используем классический "diamond" iso со соотношением 2:1.

// Соотношение TILE_H/TILE_W подобрано под пропорции верхнего ромба
// у спрайта плитки (≈ 765/1090 ≈ 0.70), чтобы плитки стыковались
// без ступенек по высоте.
export const TILE_W = 112;
export const TILE_H = 78; // 112 * 0.70
export const TILE_DEPTH = 28;

export function gridToScreen(gx: number, gy: number) {
  const x = (gx - gy) * (TILE_W / 2);
  const y = (gx + gy) * (TILE_H / 2);
  return { x, y };
}

// Обратная проекция: экранные координаты (в системе world, относительно (0,0))
// в дробные grid-координаты. Учитываем, что gridToScreen берёт центр верхней
// грани как (x, y + TILE_H/2). На вход подаём точку относительно того же origin.
export function screenToGrid(sx: number, sy: number) {
  // sy здесь — координата относительно той же базы, что и gridToScreen.y
  // Центр верхней грани плитки находится в (x, y + TILE_H/2), поэтому
  // для попадания "по верхней грани" удобнее работать с центром:
  const cy = sy - TILE_H / 2;
  const gx = (sx / (TILE_W / 2) + cy / (TILE_H / 2)) / 2;
  const gy = (cy / (TILE_H / 2) - sx / (TILE_W / 2)) / 2;
  return { gx, gy };
}

// zIndex для корректной сортировки спрайтов в изометрии:
// объекты "сзади" (меньшая сумма gx+gy) рисуются раньше.
export function isoZ(gx: number, gy: number, layer = 0) {
  return (gx + gy) * 100 + layer;
}

export type Dir = "NE" | "SE" | "SW" | "NW" | "N" | "E" | "S" | "W";

// Маппинг кнопок на изо-направления.
// На экране: ↑ кажется "вверх-назад" — это NW (к камере = SE).
// Делаем интуитивный маппинг:
//  ↑ / W -> NW (к дальнему углу, вверх по экрану)
//  ↓ / S -> SE (к ближнему углу, вниз по экрану)
//  ← / A -> SW (влево по экрану)
//  → / D -> NE (вправо по экрану)
export function dirToDelta(dir: Dir): { dx: number; dy: number } {
  switch (dir) {
    case "NW": return { dx: -1, dy: -1 }; // вверх по экрану
    case "SE": return { dx: 1, dy: 1 };   // вниз по экрану
    case "NE": return { dx: 1, dy: -1 };  // вправо по экрану
    case "SW": return { dx: -1, dy: 1 };  // влево по экрану
    // grid-ортогональные шаги (на экране выглядят как диагонали ромба)
    case "N":  return { dx: 0, dy: -1 };
    case "E":  return { dx: 1, dy: 0 };
    case "S":  return { dx: 0, dy: 1 };
    case "W":  return { dx: -1, dy: 0 };
  }
}
