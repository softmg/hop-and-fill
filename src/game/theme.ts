// Читаем HSL из CSS-переменных и конвертируем в hex для PixiJS.
function readHsl(name: string): number {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
  if (!raw) return 0xff00ff;
  const [hStr, sStr, lStr] = raw.split(/\s+/);
  const h = parseFloat(hStr);
  const s = parseFloat(sStr) / 100;
  const l = parseFloat(lStr) / 100;
  return hslToHex(h, s, l);
}

function hslToHex(h: number, s: number, l: number): number {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r = 0, g = 0, b = 0;
  if (h < 60)       { r = c; g = x; b = 0; }
  else if (h < 120) { r = x; g = c; b = 0; }
  else if (h < 180) { r = 0; g = c; b = x; }
  else if (h < 240) { r = 0; g = x; b = c; }
  else if (h < 300) { r = x; g = 0; b = c; }
  else              { r = c; g = 0; b = x; }
  const R = Math.round((r + m) * 255);
  const G = Math.round((g + m) * 255);
  const B = Math.round((b + m) * 255);
  return (R << 16) | (G << 8) | B;
}

export const colors = () => ({
  skyTop: readHsl("--game-sky-top"),
  skyBottom: readHsl("--game-sky-bottom"),
  tileUnpaintedTop: readHsl("--tile-unpainted-top"),
  tileUnpaintedLeft: readHsl("--tile-unpainted-left"),
  tileUnpaintedRight: readHsl("--tile-unpainted-right"),
  tilePaintedTop: readHsl("--tile-painted-top"),
  tilePaintedLeft: readHsl("--tile-painted-left"),
  tilePaintedRight: readHsl("--tile-painted-right"),
  tileStartTop: readHsl("--tile-start-top"),
  tileStartLeft: readHsl("--tile-start-left"),
  tileStartRight: readHsl("--tile-start-right"),
  tileEdge: readHsl("--tile-edge"),
  playerBody: readHsl("--player-body"),
  playerStick: readHsl("--player-stick"),
  playerSpring: readHsl("--player-spring"),
  playerShadow: readHsl("--player-shadow"),
});

export type Palette = ReturnType<typeof colors>;
