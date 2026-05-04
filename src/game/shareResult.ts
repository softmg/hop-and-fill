import {
  getMaxRaces,
  getTotalRaces,
  getTotalStars,
  type PlayerProgress,
} from "./progress";

export const SHARED_RESULT_QUERY_PARAM = "result";

export type SharedResultKind = "level" | "final" | "progress";

export interface SharedLevelResult {
  number: number;
  name: string;
  stars: 1 | 2 | 3;
  hops: number;
  optimalMoves: number;
  timeMs: number | null;
}

export interface SharedResult {
  version: 1;
  kind: SharedResultKind;
  completedLevels: number;
  levelCount: number;
  totalStars: number;
  maxStars: number;
  totalRaces: number;
  maxRaces: number;
  totalBestTimeMs: number | null;
  level: SharedLevelResult | null;
}

export type SharedResultContext =
  | {
      kind: "level";
      levelNumber: number;
      levelName: string;
      stars: 1 | 2 | 3;
      hops: number;
      optimalMoves: number;
      timeMs: number | null;
    }
  | { kind: "final" }
  | { kind: "progress" };

function getTotalBestTimeMs(progress: PlayerProgress) {
  const times = Object.values(progress.bestTimeMsByLevel).filter((timeMs) => Number.isFinite(timeMs) && timeMs > 0);
  if (times.length === 0) return null;

  return times.reduce((sum, timeMs) => sum + Math.trunc(timeMs), 0);
}

function clampInteger(value: unknown, min: number, max: number) {
  const numberValue = Number(value);
  if (!Number.isFinite(numberValue)) return null;

  const integerValue = Math.trunc(numberValue);
  if (integerValue < min || integerValue > max) return null;

  return integerValue;
}

function clampOptionalPositiveInteger(value: unknown) {
  if (value === null || value === undefined) return null;

  const numberValue = Number(value);
  if (!Number.isFinite(numberValue) || numberValue <= 0) return null;

  return Math.trunc(numberValue);
}

function sanitizeKind(value: unknown): SharedResultKind | null {
  return value === "level" || value === "final" || value === "progress" ? value : null;
}

function sanitizeLevel(value: unknown, levelCount: number): SharedLevelResult | null {
  if (!value || typeof value !== "object") return null;

  const data = value as Partial<SharedLevelResult>;
  const number = clampInteger(data.number, 1, levelCount);
  const stars = clampInteger(data.stars, 1, 3);
  const hops = clampInteger(data.hops, 0, 9999);
  const optimalMoves = clampInteger(data.optimalMoves, 0, 9999);
  const name = typeof data.name === "string" ? data.name.trim().slice(0, 80) : "";

  if (number === null || stars === null || hops === null || optimalMoves === null || name.length === 0) {
    return null;
  }

  return {
    number,
    name,
    stars: stars as 1 | 2 | 3,
    hops,
    optimalMoves,
    timeMs: clampOptionalPositiveInteger(data.timeMs),
  };
}

function encodeBase64Url(value: string) {
  const bytes = new TextEncoder().encode(value);
  let binary = "";

  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }

  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string) {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) return null;

  try {
    const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), "=");
    const binary = atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));

    return new TextDecoder().decode(bytes);
  } catch {
    return null;
  }
}

export function createSharedResult(
  progress: PlayerProgress,
  levelCount: number,
  context: SharedResultContext = { kind: "progress" },
): SharedResult {
  const safeLevelCount = Math.max(1, Math.trunc(levelCount));
  const maxStars = safeLevelCount * 3;
  const maxRaces = getMaxRaces(safeLevelCount);
  const totalStars = Math.min(maxStars, getTotalStars(progress));
  const totalRaces = Math.min(maxRaces, getTotalRaces(progress, safeLevelCount));
  const completedLevels = Math.min(safeLevelCount, progress.completedLevels.length);

  const level =
    context.kind === "level"
      ? {
          number: Math.min(safeLevelCount, Math.max(1, Math.trunc(context.levelNumber))),
          name: context.levelName.trim().slice(0, 80) || `Уровень ${context.levelNumber}`,
          stars: context.stars,
          hops: Math.max(0, Math.trunc(context.hops)),
          optimalMoves: Math.max(0, Math.trunc(context.optimalMoves)),
          timeMs: clampOptionalPositiveInteger(context.timeMs),
        }
      : null;

  return {
    version: 1,
    kind: context.kind,
    completedLevels,
    levelCount: safeLevelCount,
    totalStars,
    maxStars,
    totalRaces,
    maxRaces,
    totalBestTimeMs: getTotalBestTimeMs(progress),
    level,
  };
}

export function encodeSharedResult(result: SharedResult) {
  return encodeBase64Url(JSON.stringify(result));
}

export function decodeSharedResult(token: string | null | undefined): SharedResult | null {
  if (!token) return null;

  const json = decodeBase64Url(token);
  if (json === null) return null;

  try {
    const data = JSON.parse(json) as Partial<SharedResult>;
    if (!data || typeof data !== "object" || data.version !== 1) return null;

    const levelCount = clampInteger(data.levelCount, 1, 999);
    if (levelCount === null) return null;

    const maxStars = clampInteger(data.maxStars, 0, levelCount * 3);
    const totalStars = clampInteger(data.totalStars, 0, maxStars ?? levelCount * 3);
    const completedLevels = clampInteger(data.completedLevels, 0, levelCount);
    const maxRaces = clampInteger(data.maxRaces, 0, levelCount);
    const totalRaces = clampInteger(data.totalRaces, 0, maxRaces ?? levelCount);
    const kind = sanitizeKind(data.kind);

    if (
      maxStars === null ||
      totalStars === null ||
      completedLevels === null ||
      maxRaces === null ||
      totalRaces === null ||
      kind === null
    ) {
      return null;
    }

    return {
      version: 1,
      kind,
      completedLevels,
      levelCount,
      totalStars,
      maxStars,
      totalRaces,
      maxRaces,
      totalBestTimeMs: clampOptionalPositiveInteger(data.totalBestTimeMs),
      level: sanitizeLevel(data.level, levelCount),
    };
  } catch {
    return null;
  }
}

export function buildSharedResultUrl(result: SharedResult, href = window.location.href) {
  const url = new URL(href);
  url.search = "";
  url.hash = "";
  url.searchParams.set(SHARED_RESULT_QUERY_PARAM, encodeSharedResult(result));

  return url.toString();
}
