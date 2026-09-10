import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ysdkShowRewardedAd", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete window.YaGames;
    vi.unstubAllEnvs();
  });

  it("uses a guest-only adapter without Yandex SDK in web mode", async () => {
    vi.stubEnv("MODE", "web");
    vi.stubGlobal("location", new URL("https://example.com/games/hop-and-fill/"));

    const {
      initYsdk,
      isRewardedAdAvailable,
      ysdkIsPlayerAuthorized,
      ysdkShowAd,
      ysdkShowRewardedAd,
    } = await import("./yandex");
    const onClose = vi.fn();
    const onError = vi.fn();

    await expect(initYsdk()).resolves.toBeDefined();
    await expect(ysdkIsPlayerAuthorized()).resolves.toBe(false);
    await ysdkShowAd({ onClose });
    await Promise.resolve();
    await ysdkShowRewardedAd({ onError });

    expect(window.YaGames).toBeUndefined();
    expect(onClose).toHaveBeenCalledWith(false);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(isRewardedAdAvailable()).toBe(false);
  });

  it("resolves rewarded in local mock mode", async () => {
    vi.stubGlobal("location", new URL("http://localhost:5173/"));

    const { ysdkShowRewardedAd } = await import("./yandex");
    const onRewarded = vi.fn();

    await ysdkShowRewardedAd({ onRewarded });
    await Promise.resolve();

    expect(onRewarded).toHaveBeenCalledTimes(1);
  });

  it("passes callbacks to the provider rewarded API", async () => {
    vi.stubGlobal("location", new URL("https://yandex.ru/games/"));
    const showRewardedVideo = vi.fn(({ callbacks }: { callbacks?: { onClose?: () => void } }) => {
      callbacks?.onClose?.();
    });

    window.YaGames = {
      init: vi.fn().mockResolvedValue({
        features: {},
        adv: {
          showFullscreenAdv: vi.fn(),
          showRewardedVideo,
        },
        getPlayer: vi.fn(),
      }),
    };

    vi.spyOn(document.head, "appendChild").mockImplementation((node: Node) => {
      const script = node as HTMLScriptElement;
      queueMicrotask(() => script.onload?.(new Event("load")));
      return node;
    });

    const { ysdkShowRewardedAd } = await import("./yandex");
    const onClose = vi.fn();

    await ysdkShowRewardedAd({ onClose });

    expect(showRewardedVideo).toHaveBeenCalledWith({
      callbacks: expect.objectContaining({ onClose }),
    });
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
