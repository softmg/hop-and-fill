// Обёртка над Yandex Games SDK v2 с локальной заглушкой.
// На домене Яндекса подгружает реальный SDK; локально использует mock + localStorage.

interface YsdkPlayer {
  setData(data: Record<string, unknown>, flush?: boolean): Promise<void>;
  getData(keys?: string[]): Promise<Record<string, unknown>>;
}

interface YsdkFeatures {
  LoadingAPI?: { ready: () => void };
}

interface Ysdk {
  features: YsdkFeatures;
  adv: {
    showFullscreenAdv: (opts?: { callbacks?: Record<string, () => void> }) => void;
  };
  getPlayer: () => Promise<YsdkPlayer>;
}

declare global {
  interface Window {
    YaGames?: { init: (opts?: unknown) => Promise<Ysdk> };
  }
}

const STORAGE_KEY = "pogo-paint:player-data";

const mockPlayer: YsdkPlayer = {
  async setData(data) {
    const existing = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...existing, ...data }));
  },
  async getData(keys) {
    const data = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (!keys) return data;
    return Object.fromEntries(keys.map((k) => [k, data[k]]));
  },
};

const mockSdk: Ysdk = {
  features: { LoadingAPI: { ready: () => console.info("[ysdk-mock] LoadingAPI.ready()") } },
  adv: {
    showFullscreenAdv: (opts) => {
      console.info("[ysdk-mock] showFullscreenAdv");
      opts?.callbacks?.onClose?.();
    },
  },
  getPlayer: async () => mockPlayer,
};

let sdkPromise: Promise<Ysdk> | null = null;

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

export async function ysdkShowAd() {
  const sdk = await initYsdk();
  sdk.adv.showFullscreenAdv();
}

export async function ysdkSave(data: Record<string, unknown>) {
  const sdk = await initYsdk();
  const player = await sdk.getPlayer();
  await player.setData(data, true);
}

export async function ysdkLoad(keys?: string[]) {
  const sdk = await initYsdk();
  const player = await sdk.getPlayer();
  return player.getData(keys);
}
