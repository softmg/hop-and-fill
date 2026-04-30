// Изометрическая проекция: grid (gx, gy) -> экран (screenX, screenY)
// Используем классический "diamond" iso со соотношением 2:1.

export const TILE_W = 96; // ширина ромба
export const TILE_H = 48; // высота ромба
export const TILE_DEPTH = 28; // высота "куба" плитки

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

export type Dir = "NE" | "SE" | "SW" | "NW";

// Маппинг кнопок на изо-направления.
// На экране: ↑ кажется "вверх-назад" — это NW (к камере = SE).
// Делаем интуитивный маппинг:
//  ↑ / W -> NW (к дальнему углу, вверх по экрану)
//  ↓ / S -> SE (к ближнему углу, вниз по экрану)
//  ← / A -> SW (влево по экрану)
//  → / D -> NE (вправо по экрану)
export function dirToDelta(dir: Dir): { dx: number; dy: number } {
  switch (dir) {
    case "NW": return { dx: -1, dy: -1 }; // обе grid-координаты уменьшаются => вверх по экрану
    case "SE": return { dx: 1, dy: 1 };
    case "NE": return { dx: 1, dy: -1 };
    case "SW": return { dx: -1, dy: 1 };
  }
}
