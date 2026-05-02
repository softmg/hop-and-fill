import type { LevelData } from "../Level";
import type { TileTheme } from "../Tile";

export interface ChapterMeta {
  chapterIndex: number;
  startLevelIndex: number;
  endLevelIndex: number;
  theme: TileTheme;
  themeLabel: string;
}

export interface ChapterTransition {
  fromChapter: ChapterMeta;
  toChapter: ChapterMeta;
  nextLevelIndex: number;
}

const THEME_LABELS: Record<TileTheme, string> = {
  default: "Классика",
  slime: "Слайм",
  neon: "Неон",
  wood: "Дерево",
  paper: "Бумага",
};

export function getLevelTheme(level: LevelData): TileTheme {
  return level.theme ?? "default";
}

export function deriveChapters(levelData: LevelData[]): ChapterMeta[] {
  if (levelData.length === 0) return [];

  const chapters: ChapterMeta[] = [];
  let chapterStart = 0;
  let currentTheme = getLevelTheme(levelData[0]);

  for (let index = 1; index <= levelData.length; index++) {
    const nextTheme = index < levelData.length ? getLevelTheme(levelData[index]) : null;
    if (nextTheme === currentTheme) continue;

    chapters.push({
      chapterIndex: chapters.length + 1,
      startLevelIndex: chapterStart,
      endLevelIndex: index - 1,
      theme: currentTheme,
      themeLabel: THEME_LABELS[currentTheme],
    });

    chapterStart = index;
    currentTheme = nextTheme ?? "default";
  }

  return chapters;
}

export function getChapterForLevel(chapters: ChapterMeta[], levelIndex: number) {
  return chapters.find((chapter) => levelIndex >= chapter.startLevelIndex && levelIndex <= chapter.endLevelIndex) ?? null;
}

export function getChapterTransition(levelData: LevelData[], levelIndex: number): ChapterTransition | null {
  const nextLevelIndex = levelIndex + 1;
  if (nextLevelIndex >= levelData.length) return null;

  const chapters = deriveChapters(levelData);
  const fromChapter = getChapterForLevel(chapters, levelIndex);
  const toChapter = getChapterForLevel(chapters, nextLevelIndex);

  if (!fromChapter || !toChapter || fromChapter.chapterIndex === toChapter.chapterIndex) {
    return null;
  }

  return {
    fromChapter,
    toChapter,
    nextLevelIndex,
  };
}
