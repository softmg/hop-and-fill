import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("ysdkShowRewardedAd", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    delete window.YaGames;
  });

  it("resolves rewarded in local mock mode", async () => {
    vi.stubGlobal("location", new URL("http://localhost:5173/"));

    const { ysdkShowRewardedAd } = await import("./yandex");

    await expect(ysdkShowRewardedAd()).resolves.toEqual({ status: "rewarded" });
  });

  it("resolves closed when the provider closes without reward", async () => {
    vi.stubGlobal("location", new URL("https://yandex.ru/games/"));

    window.YaGames = {
      init: vi.fn().mockResolvedValue({
        features: {},
        adv: {
          showFullscreenAdv: vi.fn(),
          showRewardedVideo: ({ callbacks }: { callbacks?: { onClose?: () => void } }) => {
            callbacks?.onClose?.();
          },
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

    await expect(ysdkShowRewardedAd()).resolves.toEqual({ status: "closed" });
  });
});
