import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function mockYandexHost() {
  vi.stubGlobal("location", new URL("https://games.s3.yandex.net/app"));
  vi.spyOn(document.head, "appendChild").mockImplementation((node) => {
    const script = node as HTMLScriptElement;
    queueMicrotask(() => {
      script.onload?.(new Event("load"));
    });
    return node;
  });
}

describe("yandex sdk gameplay lifecycle", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    if (typeof Storage !== "undefined" && window.localStorage instanceof Storage) {
      window.localStorage.clear();
    }
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete window.YaGames;
  });

  it("calls GameplayAPI.start() and GameplayAPI.stop() successfully", async () => {
    mockYandexHost();
    const start = vi.fn().mockResolvedValue(undefined);
    const stop = vi.fn().mockResolvedValue(undefined);
    window.YaGames = {
      init: vi.fn().mockResolvedValue({
        features: {
          LoadingAPI: { ready: vi.fn() },
          GameplayAPI: { start, stop },
        },
        adv: { showFullscreenAdv: vi.fn() },
        getPlayer: vi.fn(),
      }),
    };

    const { ysdkGameplayStart, ysdkGameplayStop } = await import("./yandex");

    await ysdkGameplayStart();
    await ysdkGameplayStop();

    expect(start).toHaveBeenCalledTimes(1);
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("recovers from a thrown gameplay sync call and still runs later transitions", async () => {
    mockYandexHost();
    const start = vi
      .fn()
      .mockRejectedValueOnce(new Error("start failed"))
      .mockResolvedValue(undefined);
    const stop = vi.fn().mockResolvedValue(undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    window.YaGames = {
      init: vi.fn().mockResolvedValue({
        features: {
          LoadingAPI: { ready: vi.fn() },
          GameplayAPI: { start, stop },
        },
        adv: { showFullscreenAdv: vi.fn() },
        getPlayer: vi.fn(),
      }),
    };

    const { ysdkGameplayStart, ysdkGameplayStop } = await import("./yandex");

    await expect(ysdkGameplayStart()).resolves.toBeUndefined();
    await expect(ysdkGameplayStop()).resolves.toBeUndefined();
    await expect(ysdkGameplayStart()).resolves.toBeUndefined();

    expect(start).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("retries the same gameplay target after a failed sync", async () => {
    mockYandexHost();
    const start = vi
      .fn()
      .mockRejectedValueOnce(new Error("start failed"))
      .mockResolvedValue(undefined);
    const stop = vi.fn().mockResolvedValue(undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    window.YaGames = {
      init: vi.fn().mockResolvedValue({
        features: {
          LoadingAPI: { ready: vi.fn() },
          GameplayAPI: { start, stop },
        },
        adv: { showFullscreenAdv: vi.fn() },
        getPlayer: vi.fn(),
      }),
    };

    const { ysdkGameplayStart } = await import("./yandex");

    await expect(ysdkGameplayStart()).resolves.toBeUndefined();
    await expect(ysdkGameplayStart()).resolves.toBeUndefined();

    expect(start).toHaveBeenCalledTimes(2);
    expect(stop).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("recovers from a failed stop call and still processes later transitions", async () => {
    mockYandexHost();
    const start = vi.fn().mockResolvedValue(undefined);
    const stop = vi
      .fn()
      .mockRejectedValueOnce(new Error("stop failed"))
      .mockResolvedValue(undefined);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    window.YaGames = {
      init: vi.fn().mockResolvedValue({
        features: {
          LoadingAPI: { ready: vi.fn() },
          GameplayAPI: { start, stop },
        },
        adv: { showFullscreenAdv: vi.fn() },
        getPlayer: vi.fn(),
      }),
    };

    const { ysdkGameplayStart, ysdkGameplayStop } = await import("./yandex");

    await expect(ysdkGameplayStart()).resolves.toBeUndefined();
    await expect(ysdkGameplayStop()).resolves.toBeUndefined();
    await expect(ysdkGameplayStop()).resolves.toBeUndefined();
    await expect(ysdkGameplayStart()).resolves.toBeUndefined();

    expect(start).toHaveBeenCalledTimes(2);
    expect(stop).toHaveBeenCalledTimes(2);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("keeps the local mock path non-throwing outside Yandex", async () => {
    vi.stubGlobal("location", new URL("https://localhost:4173"));
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    const { ysdkGameplayStart, ysdkGameplayStop } = await import("./yandex");

    await expect(ysdkGameplayStart()).resolves.toBeUndefined();
    await expect(ysdkGameplayStop()).resolves.toBeUndefined();

    expect(info).toHaveBeenCalledWith("[ysdk] локальная заглушка активна");
    expect(info).toHaveBeenCalledWith("[ysdk-mock] GameplayAPI.start()");
    expect(info).toHaveBeenCalledWith("[ysdk-mock] GameplayAPI.stop()");
  });
});
