// Обёртка над Yandex Games SDK v2 с локальной заглушкой.
// На домене Яндекса подгружает реальный SDK; локально использует mock + localStorage.

interface YsdkPlayer {
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
  getData(keys?: string[]): Promise<Record<string, unknown>>;
  isAuthorized?: () => boolean;
}

interface YsdkFeatures {
  LoadingAPI?: { ready: () => void };
  GameplayAPI?: {
    start?: () => Promise<void> | void;
    stop?: () => Promise<void> | void;
  };
}

interface YsdkAdCallbacks {
  onClose?: () => void;
  onError?: (error: unknown) => void;
}

interface YsdkRewardedCallbacks extends YsdkAdCallbacks {
  onOpen?: () => void;
  onRewarded?: () => void;
}

export interface YsdkFullscreenAdCallbacks {
  onOpen?: () => void;
  onClose?: () => void;
  onError?: () => void;
}

export interface YsdkLeaderboardEntry {
  extraData?: string;
  rank: number;
  score: number;
  player: {
    publicName?: string;
    uniqueID?: string;
    getAvatarSrc?: (size?: "small" | "medium" | "large") => string;
    getAvatarSrcSet?: (size?: "small" | "medium" | "large") => string;
  };
}

export interface YsdkLeaderboardEntries {
  userRank?: number;
  entries: YsdkLeaderboardEntry[];
}

interface YsdkLeaderboards {
  setScore: (leaderboardName: string, score: number, extraData?: string) => Promise<void>;
  getEntries: (
    leaderboardName: string,
    options?: {
      includeUser?: boolean;
      quantityAround?: number;
      quantityTop?: number;
    },
  ) => Promise<YsdkLeaderboardEntries>;
}

interface Ysdk {
  features: YsdkFeatures;
  auth?: {
    openAuthDialog: () => Promise<void>;
  };
  adv: {
    showFullscreenAdv: (opts?: {
      callbacks?: Partial<Record<"onClose" | "onError" | "onOffline" | "onOpen", () => void>>;
    }) => void;
    showRewardedVideo?: (opts?: { callbacks?: YsdkRewardedCallbacks }) => void;
  };
  leaderboards?: YsdkLeaderboards;
  getPlayer: (opts?: { scopes?: boolean }) => Promise<YsdkPlayer>;
  isAvailableMethod?: (methodName: string) => Promise<boolean>;
}

declare global {
  interface Window {
    YaGames?: { init: (opts?: unknown) => Promise<Ysdk> };
  }
}

const STORAGE_KEY = "pogo-paint:player-data";
const MOCK_LEADERBOARD_KEY = "pogo-paint:leaderboards";
const MOCK_PLAYER_ID = "local-player";
const MOCK_PLAYER_NAME = "Вы";
const fullscreenAdListeners = new Set<(active: boolean) => void>();

function readMockData(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
}

function readMockLeaderboards(): Record<string, Array<{ uniqueID: string; publicName: string; score: number; extraData?: string }>> {
  try {
    return JSON.parse(localStorage.getItem(MOCK_LEADERBOARD_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeMockLeaderboards(data: ReturnType<typeof readMockLeaderboards>) {
  localStorage.setItem(MOCK_LEADERBOARD_KEY, JSON.stringify(data));
}

function toMockLeaderboardEntry(
  row: { uniqueID: string; publicName: string; score: number; extraData?: string },
  index: number,
): YsdkLeaderboardEntry {
  return {
    rank: index + 1,
    score: row.score,
    extraData: row.extraData,
    player: {
      publicName: row.publicName,
      uniqueID: row.uniqueID,
      getAvatarSrc: () => "",
      getAvatarSrcSet: () => "",
    },
  };
}

const mockPlayer: YsdkPlayer = {
  async setData(data) {
    const existing = readMockData();
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...data }));
  },
  async getData(keys) {
    const data = readMockData();
    if (!keys) return data;
    return Object.fromEntries(keys.map((k) => [k, data[k]]));
  },
  isAuthorized: () => true,
};

const mockSdk: Ysdk = {
  features: {
    LoadingAPI: { ready: () => console.info("[ysdk-mock] LoadingAPI.ready()") },
    GameplayAPI: {
      start: () => console.info("[ysdk-mock] GameplayAPI.start()"),
      stop: () => console.info("[ysdk-mock] GameplayAPI.stop()"),
    },
  },
  adv: {
    showFullscreenAdv: (opts) => {
      console.info("[ysdk-mock] showFullscreenAdv");
      opts?.callbacks?.onOpen?.();
      queueMicrotask(() => {
        opts?.callbacks?.onClose?.();
      });
    },
    showRewardedVideo: (opts) => {
      console.info("[ysdk-mock] showRewardedVideo");
      queueMicrotask(() => {
        opts?.callbacks?.onOpen?.();
        opts?.callbacks?.onRewarded?.();
        opts?.callbacks?.onClose?.();
      });
    },
  },
  leaderboards: {
    async setScore(leaderboardName, score, extraData) {
      console.info("[ysdk-mock] leaderboards.setScore", leaderboardName, score);
      const data = readMockLeaderboards();
      const rows = data[leaderboardName] ?? [];
      const existingIndex = rows.findIndex((row) => row.uniqueID === MOCK_PLAYER_ID);
      const existing = existingIndex >= 0 ? rows[existingIndex] : null;
      const nextRow = {
        uniqueID: MOCK_PLAYER_ID,
        publicName: MOCK_PLAYER_NAME,
        score: existing ? Math.max(existing.score, score) : score,
        extraData,
      };

      if (existingIndex >= 0) {
        rows[existingIndex] = nextRow;
      } else {
        rows.push(nextRow);
      }

      data[leaderboardName] = rows;
      writeMockLeaderboards(data);
    },
    async getEntries(leaderboardName, options) {
      console.info("[ysdk-mock] leaderboards.getEntries", leaderboardName);
      const quantityTop = Math.max(1, Math.min(20, options?.quantityTop ?? 5));
      const rows = [...(readMockLeaderboards()[leaderboardName] ?? [])].sort((a, b) => b.score - a.score);
      const entries = rows.map(toMockLeaderboardEntry);
      const userEntry = entries.find((entry) => entry.player.uniqueID === MOCK_PLAYER_ID);
      const topEntries = entries.slice(0, quantityTop);

      if (options?.includeUser && userEntry && !topEntries.some((entry) => entry.player.uniqueID === MOCK_PLAYER_ID)) {
        topEntries.push(userEntry);
      }

      return {
        userRank: userEntry?.rank ?? 0,
        entries: topEntries,
      };
    },
  },
  getPlayer: async () => mockPlayer,
  auth: {
    openAuthDialog: async () => undefined,
  },
  isAvailableMethod: async (methodName) => methodName.startsWith("leaderboards.") || methodName.startsWith("player."),
};

let sdkPromise: Promise<Ysdk> | null = null;
let gameplayTargetActive = false;
let gameplayCurrentActive: boolean | null = null;
let gameplaySyncPromise: Promise<void> | null = null;
let gameplaySyncQueued = false;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Failed to load Yandex SDK"));
    document.head.appendChild(s);
  });
}

export function initYsdk(): Promise<Ysdk> {
  if (sdkPromise) return sdkPromise;
  const isYandex = /yandex/i.test(location.hostname) || /games\.s3\.yandex/i.test(location.hostname);

  sdkPromise = (async () => {
    if (!isYandex) {
      console.info("[ysdk] локальная заглушка активна");
      return mockSdk;
    }
    try {
      await loadScript("https://yandex.ru/games/sdk/v2");
      if (!window.YaGames) throw new Error("YaGames не определён");
      return await window.YaGames.init();
    } catch (e) {
      console.warn("[ysdk] не удалось инициализировать, используем заглушку", e);
      return mockSdk;
    }
  })();

  return sdkPromise;
}

export async function ysdkReady() {
  const sdk = await initYsdk();
  sdk.features.LoadingAPI?.ready();
}

async function runGameplaySync(targetActive: boolean) {
  try {
    const sdk = await initYsdk();
    const gameplayApi = sdk.features.GameplayAPI;
    if (targetActive) {
      await gameplayApi?.start?.();
    } else {
      await gameplayApi?.stop?.();
    }
    gameplayCurrentActive = targetActive;
  } catch (error) {
    console.warn(`[ysdk] GameplayAPI.${targetActive ? "start" : "stop"} failed`, error);
  }
}

function queueGameplaySync() {
  gameplaySyncQueued = true;
  if (gameplaySyncPromise) return gameplaySyncPromise;

  gameplaySyncPromise = (async () => {
    try {
      while (gameplaySyncQueued) {
        gameplaySyncQueued = false;
        if (gameplayCurrentActive === gameplayTargetActive) continue;
        await runGameplaySync(gameplayTargetActive);
      }
    } catch (error) {
      console.warn("[ysdk] gameplay sync loop failed", error);
    }
  })().finally(() => {
    gameplaySyncQueued = false;
    gameplaySyncPromise = null;
  });

  return gameplaySyncPromise;
}

export function ysdkGameplayStart() {
  gameplayTargetActive = true;
  return queueGameplaySync();
}

export function ysdkGameplayStop() {
  gameplayTargetActive = false;
  return queueGameplaySync();
}

function notifyFullscreenAdState(active: boolean) {
  for (const listener of fullscreenAdListeners) {
    listener(active);
  }
}

export function subscribeToFullscreenAds(listener: (active: boolean) => void) {
  fullscreenAdListeners.add(listener);
  return () => {
    fullscreenAdListeners.delete(listener);
  };
}

export async function ysdkShowAd(callbacks?: YsdkFullscreenAdCallbacks) {
  const sdk = await initYsdk();
  await new Promise<void>((resolve) => {
    let active = false;
    let settled = false;
    const settle = (cb?: () => void) => {
      if (settled) return;
      settled = true;
      if (active) {
        active = false;
        notifyFullscreenAdState(false);
      }
      clearTimeout(fallbackTimer);
      cb?.();
      resolve();
    };

    const fallbackTimer = window.setTimeout(settle, 15000);

    try {
      sdk.adv.showFullscreenAdv({
        callbacks: {
          onOpen: () => {
            if (!active) {
              active = true;
              notifyFullscreenAdState(true);
            }
            callbacks?.onOpen?.();
          },
          onClose: () => settle(callbacks?.onClose),
          onError: () => settle(callbacks?.onError),
          onOffline: () => settle(callbacks?.onError),
        },
      });
    } catch (error) {
      console.warn("[ysdk] fullscreen ad failed", error);
      settle(callbacks?.onError);
    }
  });
}

export type RewardedAdResult =
  | { status: "rewarded" }
  | { status: "closed" }
  | { status: "error"; error: unknown };

export async function ysdkShowRewardedAd(): Promise<RewardedAdResult> {
  const sdk = await initYsdk();

  if (!sdk.adv.showRewardedVideo) {
    return { status: "error", error: new Error("Rewarded video API is unavailable") };
  }

  return new Promise((resolve) => {
    let rewarded = false;
    let settled = false;

    const settle = (result: RewardedAdResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    try {
      sdk.adv.showRewardedVideo({
        callbacks: {
          onRewarded: () => {
            rewarded = true;
          },
          onClose: () => {
            settle(rewarded ? { status: "rewarded" } : { status: "closed" });
          },
          onError: (error) => {
            settle({ status: "error", error });
          },
        },
      });
    } catch (error) {
      settle({ status: "error", error });
    }
  });
}

export async function ysdkSave(data: Record<string, unknown>) {
  const sdk = await initYsdk();
  const player = await sdk.getPlayer({ scopes: false });
  await player.setData(data, true);
}

export async function ysdkLoad(keys?: string[]) {
  const sdk = await initYsdk();
  const player = await sdk.getPlayer({ scopes: false });
  return player.getData(keys);
}

async function ysdkIsMethodAvailable(methodName: string) {
  const sdk = await initYsdk();
  if (!sdk.isAvailableMethod) return true;

  try {
    return await sdk.isAvailableMethod(methodName);
  } catch (error) {
    console.warn(`[ysdk] isAvailableMethod(${methodName}) failed`, error);
    return false;
  }
}

export async function ysdkRequestAuthorization() {
  const sdk = await initYsdk();
  let player = await sdk.getPlayer({ scopes: false });

  if (player.isAuthorized?.() !== false) {
    return true;
  }

  if (!sdk.auth?.openAuthDialog) {
    return false;
  }

  await sdk.auth.openAuthDialog();
  player = await sdk.getPlayer({ scopes: false });
  return player.isAuthorized?.() !== false;
}

export async function ysdkSetLeaderboardScore(
  leaderboardName: string,
  score: number,
  extraData?: string,
  options?: { requestAuthorization?: boolean },
) {
  const sdk = await initYsdk();

  if (options?.requestAuthorization) {
    const authorized = await ysdkRequestAuthorization();
    if (!authorized) {
      throw new Error("Yandex authorization is required to save leaderboard score");
    }
  }

  const available = await ysdkIsMethodAvailable("leaderboards.setScore");
  if (!available) {
    throw new Error("Yandex leaderboard score API is unavailable");
  }

  if (!sdk.leaderboards?.setScore) {
    throw new Error("Yandex leaderboards API is unavailable");
  }

  await sdk.leaderboards.setScore(leaderboardName, score, extraData);
}

export async function ysdkGetLeaderboardEntries(
  leaderboardName: string,
  options?: {
    includeUser?: boolean;
    quantityAround?: number;
    quantityTop?: number;
  },
) {
  const sdk = await initYsdk();
  const available = await ysdkIsMethodAvailable("leaderboards.getEntries");
  if (!available) {
    throw new Error("Yandex leaderboard entries API is unavailable");
  }

  if (!sdk.leaderboards?.getEntries) {
    throw new Error("Yandex leaderboards API is unavailable");
  }

  return sdk.leaderboards.getEntries(leaderboardName, options);
}
