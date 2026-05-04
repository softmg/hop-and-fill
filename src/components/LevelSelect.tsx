import type { CSSProperties } from "react";
import { CarFront, CheckCircle2, Clock3, Lock, Star, Trophy, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { LevelData } from "@/game/Level";
import type { TileTheme } from "@/game/Tile";
import { deriveChapters, type ChapterMeta } from "@/game/levels/chapters";
import {
  getBestStars,
  getBestTimeMs,
  getMaxRaces,
  getRaceTimeLimitMs,
  getTotalRaces,
  getTotalStars,
  hasRaceAward,
  isLevelUnlocked,
  type PlayerProgress,
} from "@/game/progress";
import { formatDurationMs } from "@/game/time";
import plushMascot from "@/assets/player.webp";
import slimeMascot from "@/assets/player-slime.webp";
import neonMascot from "@/assets/player-neon.webp";
import woodMascot from "@/assets/player-wood.webp";
import paperMascot from "@/assets/player-paper.webp";
import plushBg from "@/assets/parallax-bg.webp";
import slimeBg from "@/assets/parallax-bg-slime.webp";
import neonBg from "@/assets/parallax-bg-neon.webp";
import woodBg from "@/assets/parallax-bg-wood.webp";
import paperBg from "@/assets/parallax-bg-paper.webp";
import paperCastle from "@/assets/paper-castle.webp";

interface LevelSelectProps {
  open: boolean;
  levels: LevelData[];
  progress: PlayerProgress;
  currentLevelIndex: number;
  onClose: () => void;
  onSelectLevel: (levelIndex: number) => void;
}

const emptyStars = [0, 1, 2];

interface Point {
  x: number;
  y: number;
}

interface RoadChip extends Point {
  fill: string;
  opacity: number;
  radius: number;
}

interface MapBox {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

interface ChapterVisual {
  accent: string;
  accentSoft: string;
  background: string;
  backgroundPosition: string;
  mascot: string;
  surface: string;
}

type CssVars = CSSProperties & Record<`--${string}`, string>;
type TimeBadgePlacement = "right" | "left" | "right-up" | "right-down" | "left-up" | "left-down" | "above" | "below";

const MAP_MIN_WIDTH_REM = 72;
const MAP_MIN_HEIGHT_REM = 38;
const LEVEL_NODE_SIZE_REM = 4.35;
const TIME_BADGE_WIDTH_REM = 5.25;
const TIME_BADGE_HEIGHT_REM = 1.75;
const TIME_BADGE_GAP_REM = 0.42;
const TIME_BADGE_SIDE_STACK_GAP_REM = 0.25;

const toMapXPct = (rem: number) => (rem / MAP_MIN_WIDTH_REM) * 100;
const toMapYPct = (rem: number) => (rem / MAP_MIN_HEIGHT_REM) * 100;

const CHAPTER_VISUALS: Record<TileTheme, ChapterVisual> = {
  default: {
    accent: "#f2ad58",
    accentSoft: "rgba(242, 173, 88, 0.28)",
    background: plushBg,
    backgroundPosition: "center",
    mascot: plushMascot,
    surface: [
      "radial-gradient(circle at 24% 22%, rgba(255, 220, 150, 0.28), transparent 32%)",
      "radial-gradient(circle at 74% 78%, rgba(205, 106, 66, 0.18), transparent 28%)",
      "repeating-linear-gradient(38deg, rgba(255, 240, 204, 0.13) 0 2px, transparent 2px 9px)",
      "repeating-linear-gradient(128deg, rgba(128, 66, 40, 0.1) 0 1px, transparent 1px 11px)",
      "linear-gradient(180deg, rgba(19, 9, 6, 0.06), rgba(20, 10, 6, 0.44))",
    ].join(", "),
  },
  slime: {
    accent: "#a9e766",
    accentSoft: "rgba(169, 231, 102, 0.28)",
    background: slimeBg,
    backgroundPosition: "7% center",
    mascot: slimeMascot,
    surface: [
      "radial-gradient(circle at 20% 28%, rgba(145, 255, 34, 0.38), transparent 28%)",
      "radial-gradient(circle at 76% 72%, rgba(45, 205, 33, 0.3), transparent 34%)",
      "radial-gradient(circle at 42% 58%, rgba(218, 255, 97, 0.12) 0 7%, transparent 8%)",
      "repeating-radial-gradient(circle at 28% 76%, rgba(202, 255, 77, 0.12) 0 1px, transparent 1px 13px)",
      "linear-gradient(180deg, rgba(8, 42, 8, 0.1), rgba(7, 34, 5, 0.48))",
    ].join(", "),
  },
  neon: {
    accent: "#5db7ff",
    accentSoft: "rgba(93, 183, 255, 0.3)",
    background: neonBg,
    backgroundPosition: "center",
    mascot: neonMascot,
    surface: [
      "radial-gradient(circle at 43% 50%, rgba(255, 39, 201, 0.24), transparent 30%)",
      "radial-gradient(circle at 72% 22%, rgba(75, 222, 255, 0.18), transparent 22%)",
      "repeating-linear-gradient(90deg, rgba(93, 183, 255, 0.16) 0 1px, transparent 1px 24px)",
      "repeating-linear-gradient(0deg, rgba(255, 39, 201, 0.11) 0 1px, transparent 1px 20px)",
      "linear-gradient(135deg, transparent 0 46%, rgba(91, 213, 255, 0.15) 47% 48%, transparent 49% 100%)",
      "linear-gradient(180deg, rgba(6, 13, 35, 0.1), rgba(3, 5, 16, 0.56))",
    ].join(", "),
  },
  wood: {
    accent: "#df9b59",
    accentSoft: "rgba(223, 155, 89, 0.28)",
    background: woodBg,
    backgroundPosition: "center",
    mascot: woodMascot,
    surface: [
      "radial-gradient(circle at 62% 34%, rgba(239, 181, 91, 0.18), transparent 34%)",
      "radial-gradient(ellipse at 30% 54%, transparent 0 15%, rgba(255, 180, 88, 0.12) 16% 17%, transparent 18% 100%)",
      "radial-gradient(ellipse at 72% 62%, transparent 0 18%, rgba(95, 42, 18, 0.16) 19% 20%, transparent 21% 100%)",
      "repeating-linear-gradient(8deg, rgba(255, 192, 104, 0.13) 0 2px, rgba(77, 36, 15, 0.1) 2px 5px, transparent 5px 15px)",
      "repeating-linear-gradient(92deg, rgba(37, 18, 8, 0.16) 0 1px, transparent 1px 38px)",
      "linear-gradient(180deg, rgba(41, 21, 10, 0.08), rgba(42, 22, 10, 0.5))",
    ].join(", "),
  },
  paper: {
    accent: "#f1c572",
    accentSoft: "rgba(241, 197, 114, 0.3)",
    background: paperBg,
    backgroundPosition: "74% 52%",
    mascot: paperMascot,
    surface:
      "radial-gradient(circle at 58% 32%, rgba(255, 225, 164, 0.14), transparent 36%), linear-gradient(180deg, rgba(57, 35, 18, 0.04), rgba(44, 27, 14, 0.42))",
  },
};

const CURRENT_CHARACTER_HEIGHTS: Record<TileTheme, string> = {
  default: "12%",
  slime: "10%",
  neon: "14%",
  wood: "13%",
  paper: "11%",
};

const CHAPTER_NODE_POINTS: readonly (readonly Point[])[] = [
  [
    { x: 8, y: 68 },
    { x: 14, y: 54 },
    { x: 11, y: 41 },
    { x: 16, y: 28 },
    { x: 22, y: 18 },
  ],
  [
    { x: 30, y: 20 },
    { x: 27, y: 34 },
    { x: 31, y: 48 },
    { x: 31, y: 62 },
    { x: 36, y: 75 },
  ],
  [
    { x: 44, y: 72 },
    { x: 50, y: 62 },
    { x: 52, y: 48 },
    { x: 49, y: 34 },
    { x: 55, y: 21 },
  ],
  [
    { x: 65, y: 20 },
    { x: 70, y: 34 },
    { x: 69, y: 48 },
    { x: 66, y: 62 },
    { x: 70, y: 75 },
  ],
  [
    { x: 80, y: 76 },
    { x: 86, y: 64 },
    { x: 90, y: 51 },
    { x: 90, y: 40 },
    { x: 88.5, y: 31 },
  ],
] as const;

function getChapterVisual(theme: TileTheme) {
  return CHAPTER_VISUALS[theme] ?? CHAPTER_VISUALS.default;
}

function getChapterTheme(chapter: ChapterMeta | null): TileTheme {
  return chapter?.theme ?? "default";
}

function getChapterForLevel(chapters: ChapterMeta[], levelIndex: number) {
  return chapters.find((chapter) => levelIndex >= chapter.startLevelIndex && levelIndex <= chapter.endLevelIndex) ?? null;
}

function getLevelPoint(chapter: ChapterMeta | null, levelIndex: number): Point {
  if (!chapter) {
    return { x: 8 + (levelIndex % 5) * 6, y: 52 };
  }

  const chapterSlot = Math.max(0, Math.min(CHAPTER_NODE_POINTS.length - 1, chapter.chapterIndex - 1));
  const points = CHAPTER_NODE_POINTS[chapterSlot];
  const levelOffset = levelIndex - chapter.startLevelIndex;
  if (points[levelOffset]) return points[levelOffset];

  const levelCount = Math.max(1, chapter.endLevelIndex - chapter.startLevelIndex + 1);
  const xStart = 7 + chapterSlot * 18.5;
  const xEnd = xStart + 13;
  const progress = levelCount <= 1 ? 0 : levelOffset / (levelCount - 1);
  return {
    x: xStart + (xEnd - xStart) * progress,
    y: 68 - 48 * progress + Math.sin(progress * Math.PI * 3) * 10,
  };
}

function formatSvgCoord(value: number) {
  return Number(value.toFixed(2)).toString();
}

function getRoutePath(points: Point[]) {
  if (points.length === 0) return "";
  if (points.length === 1) return `M ${formatSvgCoord(points[0].x)} ${formatSvgCoord(points[0].y)}`;

  const path = [`M ${formatSvgCoord(points[0].x)} ${formatSvgCoord(points[0].y)}`];

  for (let index = 0; index < points.length - 1; index++) {
    const previous = points[index - 1] ?? points[index];
    const current = points[index];
    const next = points[index + 1];
    const afterNext = points[index + 2] ?? next;
    const controlA = {
      x: current.x + (next.x - previous.x) / 6,
      y: current.y + (next.y - previous.y) / 6,
    };
    const controlB = {
      x: next.x - (afterNext.x - current.x) / 6,
      y: next.y - (afterNext.y - current.y) / 6,
    };

    path.push(
      [
        "C",
        formatSvgCoord(controlA.x),
        formatSvgCoord(controlA.y),
        formatSvgCoord(controlB.x),
        formatSvgCoord(controlB.y),
        formatSvgCoord(next.x),
        formatSvgCoord(next.y),
      ].join(" "),
    );
  }

  return path.join(" ");
}

function getRoadChips(points: Point[]) {
  const chips: RoadChip[] = [];

  for (let segmentIndex = 0; segmentIndex < points.length - 1; segmentIndex++) {
    const start = points[segmentIndex];
    const end = points[segmentIndex + 1];
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const length = Math.hypot(dx, dy);
    if (length <= 0) continue;

    const normalX = -dy / length;
    const normalY = dx / length;
    const steps = Math.max(2, Math.floor(length / 2.55));

    for (let step = 1; step <= steps; step++) {
      const progress = step / (steps + 1);
      const seed = Math.sin((segmentIndex + 1) * 12.9898 + step * 78.233) * 43758.5453;
      const noise = seed - Math.floor(seed);
      const side = step % 3 === 0 ? 0 : step % 2 === 0 ? -1 : 1;
      const offset = side * (0.55 + noise * 1.1);

      chips.push({
        x: start.x + dx * progress + normalX * offset,
        y: start.y + dy * progress + normalY * offset,
        radius: 0.08 + noise * 0.11,
        opacity: 0.18 + noise * 0.2,
        fill: noise > 0.56 ? "#f7d796" : "#76512e",
      });
    }
  }

  return chips;
}

function mapBoxesIntersect(a: MapBox, b: MapBox) {
  return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function isMapBoxInBounds(box: MapBox) {
  return box.left >= 0 && box.right <= 100 && box.top >= 0 && box.bottom <= 100;
}

function getLevelNodeBox(point: Point): MapBox {
  const halfWidth = toMapXPct(LEVEL_NODE_SIZE_REM) / 2;
  const halfHeight = toMapYPct(LEVEL_NODE_SIZE_REM) / 2;
  return {
    left: point.x - halfWidth,
    right: point.x + halfWidth,
    top: point.y - halfHeight,
    bottom: point.y + halfHeight,
  };
}

function getTimeBadgeBox(point: Point, placement: TimeBadgePlacement): MapBox {
  const nodeHalfWidth = toMapXPct(LEVEL_NODE_SIZE_REM) / 2;
  const nodeHalfHeight = toMapYPct(LEVEL_NODE_SIZE_REM) / 2;
  const badgeWidth = toMapXPct(TIME_BADGE_WIDTH_REM);
  const badgeHeight = toMapYPct(TIME_BADGE_HEIGHT_REM);
  const gapX = toMapXPct(TIME_BADGE_GAP_REM);
  const gapY = toMapYPct(TIME_BADGE_GAP_REM);
  const sideStackGapY = toMapYPct(TIME_BADGE_SIDE_STACK_GAP_REM);

  if (placement === "right" || placement === "right-up" || placement === "right-down") {
    const left = point.x + nodeHalfWidth + gapX;
    const top =
      placement === "right-up"
        ? point.y - sideStackGapY - badgeHeight
        : placement === "right-down"
          ? point.y + sideStackGapY
          : point.y - badgeHeight / 2;
    return { left, right: left + badgeWidth, top, bottom: top + badgeHeight };
  }

  if (placement === "left" || placement === "left-up" || placement === "left-down") {
    const right = point.x - nodeHalfWidth - gapX;
    const top =
      placement === "left-up"
        ? point.y - sideStackGapY - badgeHeight
        : placement === "left-down"
          ? point.y + sideStackGapY
          : point.y - badgeHeight / 2;
    return { left: right - badgeWidth, right, top, bottom: top + badgeHeight };
  }

  const left = point.x - badgeWidth / 2;
  const top = placement === "above" ? point.y - nodeHalfHeight - gapY - badgeHeight : point.y + nodeHalfHeight + gapY;
  return { left, right: left + badgeWidth, top, bottom: top + badgeHeight };
}

function getTimeBadgeCandidateOrder(point: Point): TimeBadgePlacement[] {
  const preferredSide: TimeBadgePlacement = point.x > 83 ? "left" : "right";
  const oppositeSide: TimeBadgePlacement = preferredSide === "right" ? "left" : "right";
  const vertical: TimeBadgePlacement[] = point.y > 62 ? ["above", "below"] : ["below", "above"];

  return [
    preferredSide,
    oppositeSide,
    `${preferredSide}-up` as TimeBadgePlacement,
    `${preferredSide}-down` as TimeBadgePlacement,
    `${oppositeSide}-up` as TimeBadgePlacement,
    `${oppositeSide}-down` as TimeBadgePlacement,
    ...vertical,
  ];
}

function getTimeBadgePlacements(nodes: Array<{ point: Point; bestTimeMs: number | null }>) {
  const nodeBoxes = nodes.map((node) => getLevelNodeBox(node.point));
  const placedBadgeBoxes: MapBox[] = [];
  const placements: Record<number, TimeBadgePlacement> = {};

  nodes.forEach((node, index) => {
    if (node.bestTimeMs === null) return;

    const placement =
      getTimeBadgeCandidateOrder(node.point).find((candidate) => {
        const badgeBox = getTimeBadgeBox(node.point, candidate);
        const hitsNode = nodeBoxes.some((nodeBox, nodeIndex) => nodeIndex !== index && mapBoxesIntersect(badgeBox, nodeBox));
        const hitsBadge = placedBadgeBoxes.some((placedBox) => mapBoxesIntersect(badgeBox, placedBox));
        return isMapBoxInBounds(badgeBox) && !hitsNode && !hitsBadge;
      }) ?? (node.point.x > 83 ? "left" : "right");

    placements[index] = placement;
    placedBadgeBoxes.push(getTimeBadgeBox(node.point, placement));
  });

  return placements;
}

function getTimeBadgePlacementClass(placement: TimeBadgePlacement) {
  switch (placement) {
    case "left":
      return "right-[calc(100%+0.42rem)] top-1/2 -translate-y-1/2 before:-right-[0.58rem] before:top-1/2 before:-translate-y-1/2";
    case "right-up":
      return "left-[calc(100%+0.42rem)] bottom-1/2 mb-1 before:-left-[0.58rem] before:bottom-0 before:translate-y-1/2";
    case "right-down":
      return "left-[calc(100%+0.42rem)] top-1/2 mt-1 before:-left-[0.58rem] before:top-0 before:-translate-y-1/2";
    case "left-up":
      return "right-[calc(100%+0.42rem)] bottom-1/2 mb-1 before:-right-[0.58rem] before:bottom-0 before:translate-y-1/2";
    case "left-down":
      return "right-[calc(100%+0.42rem)] top-1/2 mt-1 before:-right-[0.58rem] before:top-0 before:-translate-y-1/2";
    case "above":
      return "bottom-[calc(100%+0.42rem)] left-1/2 -translate-x-1/2 before:left-1/2 before:-bottom-[0.58rem] before:-translate-x-1/2";
    case "below":
      return "left-1/2 top-[calc(100%+0.42rem)] -translate-x-1/2 before:left-1/2 before:-top-[0.58rem] before:-translate-x-1/2";
    case "right":
    default:
      return "left-[calc(100%+0.42rem)] top-1/2 -translate-y-1/2 before:-left-[0.58rem] before:top-1/2 before:-translate-y-1/2";
  }
}

function getChapterUnlockedLevelIndex(progress: PlayerProgress, chapter: ChapterMeta) {
  for (let index = chapter.startLevelIndex; index <= chapter.endLevelIndex; index++) {
    if (isLevelUnlocked(progress, index)) return index;
  }
  return null;
}

function getChapterLevelIndexes(chapter: ChapterMeta) {
  return Array.from(
    { length: chapter.endLevelIndex - chapter.startLevelIndex + 1 },
    (_, offset) => chapter.startLevelIndex + offset,
  );
}

export const LevelSelect = ({
  open,
  levels,
  progress,
  currentLevelIndex,
  onClose,
  onSelectLevel,
}: LevelSelectProps) => {
  if (!open) return null;

  const chapters = deriveChapters(levels);
  const totalStars = getTotalStars(progress);
  const maxStars = levels.length * 3;
  const totalRaces = getTotalRaces(progress, levels.length);
  const maxRaces = getMaxRaces(levels.length);
  const completedCount = progress.completedLevels.length;
  const levelNodes = levels.map((level, index) => {
    const chapter = getChapterForLevel(chapters, index);
    const stars = getBestStars(progress, index);
    const bestTimeMs = getBestTimeMs(progress, index);
    const raceTimeLimitMs = getRaceTimeLimitMs(index);
    const raceEarned = hasRaceAward(progress, index);
    const unlocked = isLevelUnlocked(progress, index);
    const completed = progress.completedLevels.includes(index + 1);

    return {
      level,
      index,
      chapter,
      point: getLevelPoint(chapter, index),
      stars,
      bestTimeMs,
      raceTimeLimitMs,
      raceEarned,
      unlocked,
      completed,
      selected: currentLevelIndex === index,
    };
  });
  const routePointList = levelNodes.map((node) => node.point);
  const routePath = getRoutePath(routePointList);
  const roadChips = getRoadChips(routePointList);
  const timeBadgePlacements = getTimeBadgePlacements(levelNodes);
  const currentChapter = getChapterForLevel(chapters, currentLevelIndex);
  const currentLevelNode = levelNodes[currentLevelIndex];
  const currentTheme = getChapterTheme(currentLevelNode?.chapter ?? currentChapter);
  const currentVisual = getChapterVisual(currentTheme);
  const currentCharacterStyle: CssVars | null = currentLevelNode
    ? {
        left: `${currentLevelNode.point.x}%`,
        top: `${currentLevelNode.point.y}%`,
        height: CURRENT_CHARACTER_HEIGHTS[currentTheme],
        "--current-character-glow": currentVisual.accentSoft,
      }
    : null;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#110c08]/88 px-2 py-2 backdrop-blur-md sm:px-4 sm:py-4">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="level-select-title"
        className="flex h-[min(94svh,60rem)] w-full max-w-[112rem] flex-col overflow-hidden rounded-lg border border-[#c9945c]/45 bg-[#140d08] text-white shadow-2xl"
      >
        <div className="relative z-20 flex items-center justify-between gap-3 border-b border-[#e3b26c]/25 bg-black/28 px-3 py-2.5 sm:px-5 sm:py-3">
          <div className="flex min-w-0 items-center gap-2">
            <div className="inline-flex items-center gap-1.5 rounded-md border border-[#d2a260]/45 bg-black/45 px-2.5 py-1 text-sm font-bold text-[#ffe3a2] shadow-[0_0_18px_rgba(233,168,86,0.22)] sm:text-base">
              <Star className="h-4 w-4 fill-[#ffcc45] text-[#ffcc45]" aria-hidden />
              <span className="tabular-nums">
                {totalStars}/{maxStars}
              </span>
            </div>
            {maxRaces > 0 && (
              <div className="inline-flex items-center gap-1.5 rounded-md border border-cyan-200/35 bg-black/42 px-2.5 py-1 text-sm font-bold text-cyan-100 shadow-[0_0_18px_rgba(125,211,252,0.16)] sm:text-base">
                <CarFront className="h-4 w-4 text-cyan-200" aria-hidden />
                <span className="tabular-nums">
                  {totalRaces}/{maxRaces}
                </span>
              </div>
            )}
            <div className="hidden items-center gap-1.5 rounded-md border border-[#d2a260]/35 bg-black/35 px-2.5 py-1 text-sm font-semibold text-[#f5d49b] sm:inline-flex">
              <Trophy className="h-4 w-4 text-[#ffcc45]" aria-hidden />
              <span className="tabular-nums">
                {completedCount}/{levels.length}
              </span>
            </div>
          </div>

          <div className="min-w-0 text-center">
            <h2
              id="level-select-title"
              className="truncate text-2xl font-black leading-none text-white [text-shadow:0_3px_12px_rgba(0,0,0,0.9)] sm:text-4xl"
            >
              Карта уровней
            </h2>
            {currentChapter && (
              <div className="mt-1 hidden text-xs font-semibold text-[#f0cf9b]/80 sm:block">
                Глава {currentChapter.chapterIndex} · {currentChapter.themeLabel}
              </div>
            )}
          </div>

          <Button
            type="button"
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-10 w-10 shrink-0 border border-[#d2a260]/45 bg-black/45 text-[#f4d8a4] hover:bg-[#26170d] hover:text-white"
            aria-label="Закрыть выбор уровня"
          >
            <X className="h-5 w-5" aria-hidden />
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto bg-[radial-gradient(circle_at_50%_0%,rgba(255,202,111,0.22),transparent_34%),linear-gradient(180deg,#1a1009,#070503)]">
          <div className="relative mx-auto h-full min-h-[38rem] min-w-[72rem] overflow-hidden">
            <div
              className="absolute inset-0"
              style={{
                backgroundImage:
                  "radial-gradient(circle at 12% 20%, rgba(255, 195, 88, 0.22), transparent 18%), radial-gradient(circle at 88% 80%, rgba(78, 164, 108, 0.16), transparent 24%), repeating-linear-gradient(100deg, rgba(255, 225, 174, 0.04) 0 2px, transparent 2px 16px), linear-gradient(135deg, #2b190c 0%, #130c08 46%, #090604 100%)",
              }}
            />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_42%,rgba(0,0,0,0.58)_100%)]" />

            {chapters.map((chapter, chapterIndex) => {
              const visual = getChapterVisual(chapter.theme);
              const left = 1 + chapterIndex * (98 / Math.max(1, chapters.length));
              const width = 98 / Math.max(1, chapters.length) - 0.8;
              const style: CssVars = {
                left: `${left}%`,
                width: `${width}%`,
                "--chapter-accent": visual.accent,
                "--chapter-soft": visual.accentSoft,
                backgroundImage: `${visual.surface}, url(${visual.background})`,
                backgroundPosition: `center, ${visual.backgroundPosition}`,
                backgroundRepeat: "no-repeat, no-repeat",
                backgroundSize: "cover, cover",
              };

              return (
                <div
                  key={chapter.chapterIndex}
                  className="absolute top-[4%] h-[78%] overflow-hidden rounded-lg border border-white/10 bg-black/35 bg-cover bg-center shadow-[inset_0_0_48px_rgba(0,0,0,0.5)]"
                  style={style}
                >
                  <div className="absolute inset-0 bg-gradient-to-b from-black/12 via-transparent to-black/52" />
                  <div
                    className="absolute left-3 top-3 rounded-md border bg-black/45 px-2 py-1 text-xs font-black text-white/90 backdrop-blur"
                    style={{ borderColor: visual.accentSoft }}
                  >
                    Глава {chapter.chapterIndex}
                  </div>
                  {chapter.theme === "neon" && (
                    <div className="absolute left-1/2 top-[45%] h-28 w-28 -translate-x-1/2 rounded-full bg-[#ff28d0]/20 blur-xl" />
                  )}
                  {chapter.theme === "paper" && (
                    <img
                      src={paperCastle}
                      alt=""
                      className="pointer-events-none absolute left-1/2 top-[4%] h-[40%] w-[76%] -translate-x-1/2 object-contain opacity-95 drop-shadow-[0_18px_24px_rgba(58,35,16,0.45)]"
                      aria-hidden
                    />
                  )}
                </div>
              );
            })}

            <svg
              className="absolute inset-0 z-10 h-full w-full overflow-visible"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              aria-hidden
            >
              <defs>
                <filter id="level-road-shadow" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="0.9" stdDeviation="0.7" floodColor="#080401" floodOpacity="0.7" />
                </filter>
                <filter id="level-road-raise" x="-10%" y="-10%" width="120%" height="120%">
                  <feDropShadow dx="0" dy="-0.35" stdDeviation="0.25" floodColor="#ffe0a3" floodOpacity="0.35" />
                  <feDropShadow dx="0" dy="0.55" stdDeviation="0.45" floodColor="#2b1507" floodOpacity="0.72" />
                </filter>
              </defs>
              <path
                d={routePath}
                fill="none"
                filter="url(#level-road-shadow)"
                stroke="rgba(20,10,4,0.94)"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="6.8"
              />
              <path
                d={routePath}
                fill="none"
                stroke="#5e3b1e"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="5.55"
              />
              <path
                d={routePath}
                fill="none"
                filter="url(#level-road-raise)"
                stroke="#b9793f"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="4.45"
              />
              <path
                d={routePath}
                fill="none"
                stroke="#dfb16d"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3.35"
              />
              <path
                d={routePath}
                fill="none"
                stroke="#f7dba2"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.12"
                opacity="0.82"
              />
              <path
                d={routePath}
                fill="none"
                stroke="rgba(91,55,28,0.38)"
                strokeDasharray="0.18 1.45"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="3"
              />
              {roadChips.map((chip, index) => (
                <circle
                  key={`road-chip-${index}`}
                  cx={formatSvgCoord(chip.x)}
                  cy={formatSvgCoord(chip.y)}
                  r={formatSvgCoord(chip.radius)}
                  fill={chip.fill}
                  opacity={formatSvgCoord(chip.opacity)}
                />
              ))}
            </svg>

            {levelNodes.map((node) => {
              const levelNumber = node.index + 1;
              const theme = getChapterTheme(node.chapter);
              const visual = getChapterVisual(theme);
              const bestTimeLabel = node.bestTimeMs === null ? null : formatDurationMs(node.bestTimeMs);
              const raceTargetLabel = node.raceTimeLimitMs === null ? null : formatDurationMs(node.raceTimeLimitMs);
              const timeBadgePlacement = timeBadgePlacements[node.index] ?? "right";
              const nodeStyle: CssVars = {
                left: `${node.point.x}%`,
                top: `${node.point.y}%`,
                "--node-accent": visual.accent,
                "--node-soft": visual.accentSoft,
                background: node.unlocked
                  ? "radial-gradient(circle at 36% 24%, rgba(255,255,255,0.45), transparent 20%), linear-gradient(155deg, rgba(61,44,24,0.96), rgba(11,9,8,0.98))"
                  : "linear-gradient(155deg, rgba(54,49,44,0.96), rgba(12,12,12,0.98))",
                borderColor: node.selected ? visual.accent : node.unlocked ? "rgba(255, 224, 169, 0.72)" : "rgba(255,255,255,0.22)",
                boxShadow: node.selected
                  ? `0 0 0 3px ${visual.accentSoft}, 0 0 34px ${visual.accentSoft}, 0 12px 24px rgba(0,0,0,0.7)`
                  : node.unlocked
                    ? "0 12px 22px rgba(0,0,0,0.68), inset 0 0 0 1px rgba(255,255,255,0.13)"
                    : "0 10px 18px rgba(0,0,0,0.55)",
              };

              return (
                <button
                  key={`${levelNumber}-${node.level.name}`}
                  type="button"
                  disabled={!node.unlocked}
                  onClick={() => onSelectLevel(node.index)}
                  className={cn(
                    "absolute z-20 flex h-[4.35rem] w-[4.35rem] -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border-[3px] text-center text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd875]",
                    "disabled:cursor-not-allowed disabled:opacity-65",
                    node.unlocked && "hover:scale-105",
                    node.selected && "animate-pulse",
                  )}
                  style={nodeStyle}
                  aria-label={`Уровень ${levelNumber}: ${node.level.name}. ${node.stars} из 3 звезд${bestTimeLabel ? `. Лучшее время ${bestTimeLabel}` : ""}${node.raceEarned ? ". Гонка получена" : raceTargetLabel ? `. Гонка за ${raceTargetLabel}` : ""}`}
                  title={`${node.level.name}${bestTimeLabel ? ` · ${bestTimeLabel}` : ""}${node.raceEarned ? " · гонка получена" : raceTargetLabel ? ` · гонка за ${raceTargetLabel}` : ""}`}
                >
                  <span className="flex h-8 items-center justify-center text-2xl font-black leading-none [text-shadow:0_2px_6px_rgba(0,0,0,0.9)]">
                    {node.unlocked ? levelNumber : <Lock className="h-5 w-5 text-white/65" aria-hidden />}
                  </span>
                  <span className="mt-0.5 flex items-center justify-center gap-0.5" aria-hidden>
                    {emptyStars.map((slot) => (
                      <Star
                        key={slot}
                        className={cn(
                          "h-3.5 w-3.5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]",
                          node.stars > slot ? "fill-[#ffcc45] text-[#ffcc45]" : "fill-black/35 text-white/25",
                        )}
                      />
                    ))}
                  </span>
                  {node.completed && (
                    <CheckCircle2
                      className="absolute -right-1 -top-1 h-5 w-5 rounded-full bg-black text-emerald-300"
                      aria-hidden
                    />
                  )}
                  {node.raceEarned && (
                    <CarFront
                      className="absolute -left-1 -top-1 h-5 w-5 rounded-full border border-cyan-200/60 bg-black p-0.5 text-cyan-200 shadow-[0_0_12px_rgba(125,211,252,0.5)]"
                      aria-hidden
                    />
                  )}
                  {bestTimeLabel && (
                    <span
                      className={cn(
                        "pointer-events-none absolute flex h-7 w-[5.25rem] items-center justify-center gap-1.5 rounded-md border bg-[linear-gradient(180deg,rgba(42,28,15,0.98),rgba(11,8,5,0.96))] px-2 text-[0.72rem] font-black leading-none text-[#ffe5ac] tabular-nums shadow-[0_8px_18px_rgba(0,0,0,0.55)] backdrop-blur",
                        "before:absolute before:h-1.5 before:w-1.5 before:rounded-full before:border before:border-[#ffe1a3]/70 before:bg-[#160d06]",
                        getTimeBadgePlacementClass(timeBadgePlacement),
                      )}
                      style={{
                        borderColor: visual.accent,
                        boxShadow: `0 0 0 1px rgba(0,0,0,0.36), 0 8px 18px rgba(0,0,0,0.58), 0 0 20px ${visual.accentSoft}`,
                      }}
                      aria-hidden
                    >
                      <Clock3 className="h-3.5 w-3.5 text-[#ffd36f] drop-shadow-[0_0_6px_rgba(255,204,69,0.42)]" />
                      <span>{bestTimeLabel}</span>
                    </span>
                  )}
                </button>
              );
            })}

            {currentCharacterStyle && (
              <img
                src={currentVisual.mascot}
                alt=""
                className="pointer-events-none absolute z-30 w-auto -translate-x-1/2 -translate-y-[72%] object-contain drop-shadow-[0_18px_22px_rgba(0,0,0,0.72)]"
                style={currentCharacterStyle}
                draggable={false}
              />
            )}

            <div className="absolute bottom-[2.5%] left-[2.5%] right-[2.5%] z-40 grid grid-cols-5 gap-3">
              {chapters.map((chapter) => {
                const visual = getChapterVisual(chapter.theme);
                const levelIndexes = getChapterLevelIndexes(chapter);
                const chapterStars = levelIndexes.reduce((sum, levelIndex) => sum + getBestStars(progress, levelIndex), 0);
                const chapterMaxStars = levelIndexes.length * 3;
                const chapterRaceMax = levelIndexes.filter((levelIndex) => getRaceTimeLimitMs(levelIndex) !== null).length;
                const chapterRaces = levelIndexes.filter((levelIndex) => hasRaceAward(progress, levelIndex)).length;
                const unlockedLevelIndex = getChapterUnlockedLevelIndex(progress, chapter);
                const unlocked = unlockedLevelIndex !== null;
                const active = currentLevelIndex >= chapter.startLevelIndex && currentLevelIndex <= chapter.endLevelIndex;
                const completed = levelIndexes.every((levelIndex) => progress.completedLevels.includes(levelIndex + 1));
                const chapterStyle: CssVars = {
                  "--chapter-accent": visual.accent,
                  "--chapter-soft": visual.accentSoft,
                  borderColor: active ? visual.accent : "rgba(220, 164, 92, 0.45)",
                  boxShadow: active ? `0 0 0 1px ${visual.accentSoft}, 0 0 28px ${visual.accentSoft}` : undefined,
                };

                return (
                  <button
                    key={chapter.chapterIndex}
                    type="button"
                    disabled={!unlocked}
                    onClick={() => unlockedLevelIndex !== null && onSelectLevel(unlockedLevelIndex)}
                    className={cn(
                      "relative min-h-[6.9rem] overflow-hidden rounded-lg border bg-black/62 p-2.5 text-left backdrop-blur transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd875]",
                      unlocked ? "hover:-translate-y-0.5 hover:bg-black/72" : "cursor-not-allowed opacity-62",
                    )}
                    style={chapterStyle}
                  >
                    <div className="absolute inset-0 opacity-20" style={{ backgroundImage: visual.surface }} />
                    <div className="relative">
                      <div className="min-w-0">
                        <div className="text-lg font-black leading-tight text-[#ffd291]">
                          Глава {chapter.chapterIndex}
                        </div>
                        <div className="mt-1 line-clamp-2 text-sm font-semibold leading-tight text-white">
                          {chapter.themeLabel}
                        </div>
                      </div>
                    </div>
                    <div className="relative mt-2 flex items-center justify-between gap-2 text-xs font-semibold text-white/75">
                      <div className="inline-flex items-center gap-2">
                        <span className="inline-flex items-center gap-1 text-[#ffe0a8]">
                          <Star className="h-3.5 w-3.5 fill-[#ffcc45] text-[#ffcc45]" aria-hidden />
                          {chapterStars}/{chapterMaxStars}
                        </span>
                        {chapterRaceMax > 0 && (
                          <span className="inline-flex items-center gap-1 text-cyan-100">
                            <CarFront className="h-3.5 w-3.5 text-cyan-200" aria-hidden />
                            {chapterRaces}/{chapterRaceMax}
                          </span>
                        )}
                      </div>
                      <span className="tabular-nums">
                        {chapter.startLevelIndex + 1}-{chapter.endLevelIndex + 1}
                      </span>
                    </div>
                    <div className="relative mt-1.5 text-[0.72rem] font-medium leading-tight text-white/66">
                      {completed
                        ? "Глава пройдена"
                        : unlocked
                          ? active
                            ? "Текущая глава"
                            : "Перейти к открытому уровню"
                          : `Откроется после уровня ${chapter.startLevelIndex}`}
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="pointer-events-none absolute left-1/2 top-[44%] z-10 h-36 w-36 -translate-x-1/2 rounded-full border border-[#63c7ff]/35 bg-[#111b39]/55 shadow-[0_0_45px_rgba(87,173,255,0.35)]">
              <div className="absolute inset-4 rounded-full border border-[#ff4dda]/35 bg-[radial-gradient(circle,rgba(255,42,202,0.55),rgba(44,112,255,0.1)_46%,transparent_68%)]" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
