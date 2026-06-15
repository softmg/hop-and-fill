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
  onClose?: (wasShown: boolean) => void;
  onError?: (error: unknown) => void;
}

export interface YsdkRewardedCallbacks extends YsdkAdCallbacks {
  onOpen?: () => void;
  onRewarded?: () => void;
}

export interface YsdkFullscreenAdCallbacks {
  onOpen?: () => void;
  onClose?: (wasShown: boolean) => void;
  onError?: () => void;
}

interface Ysdk {
  environment?: {
    i18n?: {
      lang?: string;
    };
  };
  features: YsdkFeatures;
  auth?: {
    openAuthDialog: () => Promise<void>;
  };
  adv: {
    showFullscreenAdv: (opts?: {
      callbacks?: {
        onOpen?: () => void;
        onClose?: (wasShown: boolean) => void;
        onError?: (error: unknown) => void;
        onOffline?: () => void;
      };
    }) => void;
    showRewardedVideo?: (opts?: { callbacks?: YsdkRewardedCallbacks }) => void;
  };
  getPlayer: (opts?: { scopes?: boolean }) => Promise<YsdkPlayer>;
  isAvailableMethod?: (methodName: string) => Promise<boolean>;
}

declare global {
  interface Window {
    __yandexSdkScriptReady?: Promise<void>;
    initSDK?: () => void;
    YaGames?: { init: (opts?: unknown) => Promise<Ysdk> };
  }
}

const STORAGE_KEY = "pogo-paint:player-data";
const SDK_READY_TIMEOUT_MS = 3000;
const fullscreenAdListeners = new Set<(active: boolean) => void>();

function getMockLanguage() {
  const queryLanguage = new URLSearchParams(location.search).get("lang");
  return queryLanguage || navigator.language || "ru";
}

/** Returns true only for local development hosts where SDK mocks are intentional. */
function canUseLocalMockSdk() {
  return (
    location.protocol === "file:" ||
    location.hostname === "localhost" ||
    location.hostname === "127.0.0.1" ||
    location.hostname === "::1"
  );
}

function readMockData(): Record<string, unknown> {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch {
    return {};
  }
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
  environment: {
    i18n: {
      lang: getMockLanguage(),
    },
  },
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
        opts?.callbacks?.onClose?.(true);
      });
    },
    showRewardedVideo: (opts) => {
      console.info("[ysdk-mock] showRewardedVideo");
      queueMicrotask(() => {
        opts?.callbacks?.onOpen?.();
        opts?.callbacks?.onRewarded?.();
        opts?.callbacks?.onClose?.(true);
      });
    },
  },
  getPlayer: async () => mockPlayer,
  auth: {
    openAuthDialog: async () => undefined,
  },
  isAvailableMethod: async (methodName) => methodName.startsWith("player."),
};

let sdkPromise: Promise<Ysdk> | null = null;
let playerPromise: Promise<YsdkPlayer> | null = null;
let gameplayTargetActive = false;
let gameplayCurrentActive: boolean | null = null;
let gameplaySyncPromise: Promise<void> | null = null;
let gameplaySyncQueued = false;

/**
 * Waits for the platform SDK loader without letting a stalled request block rendering forever.
 */
async function waitForSdkLoader() {
  const ready = window.__yandexSdkScriptReady;
  if (!ready) return;

  await Promise.race([
    ready.catch(() => undefined),
    new Promise<void>((resolve) => {
      window.setTimeout(resolve, SDK_READY_TIMEOUT_MS);
    }),
  ]);
}

/** Initializes the platform SDK once and falls back to local mocks outside the hosted environment. */
export function initYsdk(): Promise<Ysdk> {
  if (sdkPromise) return sdkPromise;
  sdkPromise = (async () => {
    await waitForSdkLoader();

    if (!window.YaGames && canUseLocalMockSdk()) {
      console.info("[ysdk] локальная заглушка активна");
      return mockSdk;
    }
    try {
      if (!window.YaGames) throw new Error("YaGames не определён");
      return await window.YaGames.init();
    } catch (e) {
      if (!canUseLocalMockSdk()) throw e;
      console.warn("[ysdk] не удалось инициализировать, используем заглушку", e);
      return mockSdk;
    }
  })();

  return sdkPromise;
}

/** Notifies the platform that the game is interactive. */
export async function ysdkReady() {
  const sdk = await initYsdk();
  sdk.features.LoadingAPI?.ready();
}

export type GameLanguage = "ru" | "en";

/** Reads the platform locale and maps unsupported languages to English. */
export async function ysdkGetLanguage(): Promise<GameLanguage> {
  const sdk = await initYsdk();
  return sdk.environment?.i18n?.lang === "ru" ? "ru" : "en";
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

/** Requests platform gameplay-active state and serializes the SDK transition. */
export function ysdkGameplayStart() {
  gameplayTargetActive = true;
  return queueGameplaySync();
}

/** Requests platform gameplay-inactive state and serializes the SDK transition. */
export function ysdkGameplayStop() {
  gameplayTargetActive = false;
  return queueGameplaySync();
}

function notifyFullscreenAdState(active: boolean) {
  for (const listener of fullscreenAdListeners) {
    listener(active);
  }
}

/** Subscribes to fullscreen ad activity so gameplay and audio can pause around ads. */
export function subscribeToFullscreenAds(listener: (active: boolean) => void) {
  fullscreenAdListeners.add(listener);
  return () => {
    fullscreenAdListeners.delete(listener);
  };
}

/** Shows a fullscreen ad and always settles after provider callbacks or a timeout. */
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
          onClose: (wasShown) => settle(() => callbacks?.onClose?.(wasShown)),
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

/** Shows a rewarded ad using the platform callback contract. */
export async function ysdkShowRewardedAd(callbacks?: YsdkRewardedCallbacks) {
  const sdk = await initYsdk();

  if (!sdk.adv.showRewardedVideo) {
    callbacks?.onError?.(new Error("Rewarded video API is unavailable"));
    return;
  }

  try {
    sdk.adv.showRewardedVideo({ callbacks });
  } catch (error) {
    callbacks?.onError?.(error);
  }
}

async function getYsdkPlayer() {
  if (playerPromise) return playerPromise;

  playerPromise = initYsdk()
    .then((sdk) => sdk.getPlayer({ scopes: false }))
    .catch((error) => {
      playerPromise = null;
      throw error;
    });

  return playerPromise;
}

/** Persists player data through the platform player storage API. */
export async function ysdkSave(data: Record<string, unknown>) {
  const player = await getYsdkPlayer();
  await player.setData(data, true);
}

/** Loads player data from the platform player storage API. */
export async function ysdkLoad(keys?: string[]) {
  const player = await getYsdkPlayer();
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

/** Requests platform authorization when available and refreshes the cached player object. */
export async function ysdkRequestAuthorization() {
  const sdk = await initYsdk();
  let player = await getYsdkPlayer();

  if (player.isAuthorized?.() !== false) {
    return true;
  }

  if (!sdk.auth?.openAuthDialog) {
    return false;
  }

  await sdk.auth.openAuthDialog();
  playerPromise = null;
  player = await sdk.getPlayer({ scopes: false });
  playerPromise = Promise.resolve(player);
  return player.isAuthorized?.() !== false;
}

/** Reports whether the cached platform player is already externally authorized. */
export async function ysdkIsPlayerAuthorized() {
  const player = await getYsdkPlayer();
  return player.isAuthorized?.() !== false;
}

