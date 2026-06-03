import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let firstSceneRenderableCallback: (() => void) | null = null;
let onHopCountCallback: ((hops: number) => void) | null = null;
let onHopCallback: (() => void) | null = null;
let onWinCallback: ((hops: number) => void) | null = null;
let onLoseCallback: (() => void) | null = null;

const mockLoadPlayerProgress = vi.fn();
const mockMigrateGuestProgressToCloud = vi.fn();
const mockSavePlayerProgress = vi.fn().mockResolvedValue(undefined);
const mockYsdkReady = vi.fn().mockResolvedValue(undefined);
const mockYsdkGameplayStart = vi.fn().mockResolvedValue(undefined);
const mockYsdkGameplayStop = vi.fn().mockResolvedValue(undefined);
const mockYsdkShowAd = vi.fn().mockResolvedValue(undefined);
const mockYsdkShowRewardedAd = vi.fn().mockResolvedValue({ status: "closed" });
const mockYsdkIsPlayerAuthorized = vi.fn().mockResolvedValue(true);
const mockYsdkRequestAuthorization = vi.fn().mockResolvedValue(true);
const mockSubscribeToFullscreenAds = vi.fn(() => () => {});
const mockYsdkSetLeaderboardScore = vi.fn().mockResolvedValue(undefined);
const mockYsdkGetLeaderboardEntries = vi.fn().mockResolvedValue({ userRank: 0, entries: [] });
const mockGameAudio = {
  setMuted: vi.fn(),
  setEnvironmentHold: vi.fn(),
  playHop: vi.fn(),
  playPaint: vi.fn(),
  playWin: vi.fn(),
  playPerfectWin: vi.fn(),
  playLoss: vi.fn(),
  destroy: vi.fn().mockResolvedValue(undefined),
};
const mockDestroy = vi.fn();
const mockReset = vi.fn();
const mockSetLevel = vi.fn();
const mockSetMoveLimit = vi.fn();
const mockContinueAfterLoss = vi.fn().mockReturnValue(true);
const mockTriggerDir = vi.fn();
const mockPause = vi.fn();
const mockResume = vi.fn();

const renderFirstScene = async () => {
  await waitFor(() => {
    expect(firstSceneRenderableCallback).toEqual(expect.any(Function));
  });

  await act(async () => {
    firstSceneRenderableCallback?.();
  });
};

const startFromStartScreen = async (buttonName = "Продолжить") => {
  fireEvent.click(await screen.findByRole("button", { name: buttonName }));

  await waitFor(() => {
    expect(screen.queryByTestId("start-screen")).not.toBeInTheDocument();
  });
};

vi.mock("@/game/PixiGame", () => ({
  PixiGame: class {
    constructor(
      _host: HTMLDivElement,
      _level: unknown,
      callbacks: { onHopCount: (hops: number) => void; onHop: () => void; onWin: (hops: number) => void; onLose: () => void },
      options?: { onFirstSceneRenderable?: () => void },
    ) {
      onHopCountCallback = callbacks.onHopCount;
      onHopCallback = callbacks.onHop;
      onWinCallback = callbacks.onWin;
      onLoseCallback = callbacks.onLose;
      firstSceneRenderableCallback = options?.onFirstSceneRenderable ?? null;
    }

    destroy() {
      mockDestroy();
    }

    reset() {
      mockReset();
    }

    setLevel(level: unknown) {
      mockSetLevel(level);
    }

    setMoveLimit(limit: number | null) {
      mockSetMoveLimit(limit);
    }

    continueAfterLoss(limit: number) {
      return mockContinueAfterLoss(limit);
    }

    triggerDir(dir: unknown) {
      mockTriggerDir(dir);
    }

    canUndoLastMove() {
      return false;
    }

    undoLastMove() {
      return false;
    }

    pause() {
      mockPause();
    }

    resume() {
      mockResume();
    }
  },
}));

vi.mock("@/sdk/yandex", () => ({
  ysdkReady: mockYsdkReady,
  ysdkGameplayStart: mockYsdkGameplayStart,
  ysdkGameplayStop: mockYsdkGameplayStop,
  ysdkShowAd: mockYsdkShowAd,
  ysdkShowRewardedAd: mockYsdkShowRewardedAd,
  ysdkIsPlayerAuthorized: mockYsdkIsPlayerAuthorized,
  ysdkRequestAuthorization: mockYsdkRequestAuthorization,
  subscribeToFullscreenAds: mockSubscribeToFullscreenAds,
  ysdkSetLeaderboardScore: mockYsdkSetLeaderboardScore,
  ysdkGetLeaderboardEntries: mockYsdkGetLeaderboardEntries,
}));

vi.mock("@/game/audio", () => ({
  createGameAudio: vi.fn(() => mockGameAudio),
}));

vi.mock("@/game/progress", async () => {
  const actual = await vi.importActual<typeof import("@/game/progress")>("@/game/progress");
  return {
    ...actual,
    loadPlayerProgress: mockLoadPlayerProgress,
    migrateGuestProgressToCloud: mockMigrateGuestProgressToCloud,
    savePlayerProgress: mockSavePlayerProgress,
  };
});

describe("GameCanvas yandex lifecycle", () => {
  beforeEach(() => {
    vi.stubEnv("VITE_LEADERBOARD_BACKEND_URL", "");
    vi.clearAllMocks();
    firstSceneRenderableCallback = null;
    onHopCountCallback = null;
    onHopCallback = null;
    onWinCallback = null;
    onLoseCallback = null;
    mockLoadPlayerProgress.mockResolvedValue({
      version: 1,
      unlockedLevel: 1,
      completedLevels: [],
      bestStarsByLevel: {},
      bestTimeMsByLevel: {},
      hasStarted: true,
      tutorialComplete: true,
      audioMuted: false,
    });
    mockMigrateGuestProgressToCloud.mockImplementation((progress) => Promise.resolve(progress));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: undefined,
    });
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: undefined,
    });
  });

  it("waits for the first renderable scene before readying and syncs gameplay around overlays, visibility, and unmount", async () => {
    const { GameCanvas } = await import("./GameCanvas");
    const view = render(<GameCanvas />);

    await screen.findByText(/Уровень 1 \/ /);

    expect(mockYsdkReady).not.toHaveBeenCalled();
    expect(mockYsdkGameplayStart).not.toHaveBeenCalled();
    expect(mockYsdkGameplayStop).toHaveBeenCalledTimes(1);

    await renderFirstScene();

    await waitFor(() => {
      expect(mockYsdkReady).toHaveBeenCalledTimes(1);
    });
    expect(mockYsdkGameplayStart).not.toHaveBeenCalled();

    await startFromStartScreen();

    await waitFor(() => {
      expect(mockYsdkGameplayStart).toHaveBeenCalledTimes(1);
    });

    fireEvent.click(screen.getByRole("button", { name: /Уровень 1 \/ / }));
    await waitFor(() => {
      expect(mockYsdkGameplayStop).toHaveBeenCalledTimes(2);
    });

    fireEvent.click(screen.getByRole("button", { name: "Закрыть выбор уровня" }));
    await waitFor(() => {
      expect(mockYsdkGameplayStart).toHaveBeenCalledTimes(2);
    });

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => {
      expect(mockYsdkGameplayStop).toHaveBeenCalledTimes(3);
    });

    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    fireEvent(document, new Event("visibilitychange"));
    await waitFor(() => {
      expect(mockYsdkGameplayStart).toHaveBeenCalledTimes(3);
    });

    view.unmount();

    expect(mockDestroy).toHaveBeenCalledTimes(1);
    expect(mockYsdkGameplayStop).toHaveBeenCalledTimes(4);
  });

  it("keeps the mobile joystick hidden until the first scene is renderable", async () => {
    const { GameCanvas } = await import("./GameCanvas");
    render(<GameCanvas />);

    await screen.findByText(/Уровень 1 \/ /);

    expect(screen.queryByTestId("mobile-joystick")).not.toBeInTheDocument();

    await renderFirstScene();

    expect(screen.queryByTestId("mobile-joystick")).not.toBeInTheDocument();

    await startFromStartScreen();

    expect(await screen.findByTestId("mobile-joystick")).toBeInTheDocument();
  });

  it("shows a first-run start button and saves start before the tutorial plays", async () => {
    mockLoadPlayerProgress.mockResolvedValue({
      version: 1,
      unlockedLevel: 1,
      completedLevels: [],
      bestStarsByLevel: {},
      bestTimeMsByLevel: {},
      hasStarted: false,
      tutorialComplete: false,
      audioMuted: false,
    });

    const { GameCanvas } = await import("./GameCanvas");
    render(<GameCanvas />);

    expect(await screen.findByRole("button", { name: "Начать" })).toBeInTheDocument();

    await renderFirstScene();
    await startFromStartScreen("Начать");

    const savedProgress = mockSavePlayerProgress.mock.calls.at(-1)?.[0];
    expect(savedProgress.hasStarted).toBe(true);
    expect(savedProgress.tutorialComplete).toBe(false);
    expect(screen.getByText(/Свайпай, тапай по соседней плитке/)).toBeInTheDocument();
    expect(mockYsdkGameplayStart).not.toHaveBeenCalled();
  });

  it("does not show manual third-party authorization controls to guests", async () => {
    mockYsdkIsPlayerAuthorized.mockResolvedValueOnce(false);

    const { GameCanvas } = await import("./GameCanvas");
    render(<GameCanvas />);
    await screen.findByTestId("start-screen");
    expect(screen.queryByText(/Yandex|Яндекс/i)).not.toBeInTheDocument();
    expect(mockYsdkRequestAuthorization).not.toHaveBeenCalled();
    expect(mockMigrateGuestProgressToCloud).not.toHaveBeenCalled();
  });

  it("opens the leaderboard and renders loaded leaders", async () => {
    mockLoadPlayerProgress.mockResolvedValue({
      version: 1,
      unlockedLevel: 2,
      completedLevels: [1],
      bestStarsByLevel: { 1: 3 },
      bestTimeMsByLevel: { 1: 1240 },
      hasStarted: true,
      tutorialComplete: true,
      audioMuted: false,
    });
    mockYsdkGetLeaderboardEntries.mockResolvedValueOnce({
      userRank: 2,
      entries: [
        {
          rank: 1,
          score: 6,
          extraData: '{"completedLevels":2,"levelCount":25,"totalBestTimeMs":2800}',
          player: {
            publicName: "Ada",
            uniqueID: "ada",
            getAvatarSrc: () => "",
          },
        },
        {
          rank: 2,
          score: 3,
          extraData: '{"completedLevels":1,"levelCount":25,"totalBestTimeMs":1240}',
          player: {
            publicName: "You",
            uniqueID: "you",
            getAvatarSrc: () => "",
          },
        },
      ],
    });

    const { GameCanvas } = await import("./GameCanvas");
    render(<GameCanvas />);

    await screen.findByText(/Уровень 2 \/ /);
    expect(screen.getByText("Уровень 2")).toBeInTheDocument();
    await startFromStartScreen();

    fireEvent.click(screen.getByRole("button", { name: "Лидеры" }));

    expect(await screen.findByRole("dialog", { name: "Лидеры" })).toBeInTheDocument();
    expect(await screen.findByText("Ada")).toBeInTheDocument();
    expect(screen.getByText("You")).toBeInTheDocument();
    expect(screen.getByText("место 2")).toBeInTheDocument();
    expect(screen.getByText("1/25 уровней")).toBeInTheDocument();
  });

  it("keeps gameplay paused while the tutorial overlay is blocking", async () => {
    mockLoadPlayerProgress.mockResolvedValue({
      version: 1,
      unlockedLevel: 1,
      completedLevels: [],
      bestStarsByLevel: {},
      bestTimeMsByLevel: {},
      hasStarted: true,
      tutorialComplete: false,
      audioMuted: false,
    });

    const { GameCanvas } = await import("./GameCanvas");
    render(<GameCanvas />);

    await screen.findByText(/Уровень 1 \/ /);

    await renderFirstScene();

    await waitFor(() => {
      expect(mockYsdkReady).toHaveBeenCalledTimes(1);
    });

    await startFromStartScreen();

    expect(mockYsdkGameplayStart).not.toHaveBeenCalled();

    await act(async () => {
      onHopCountCallback?.(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Понятно" }));

    await waitFor(() => {
      expect(mockYsdkGameplayStart).toHaveBeenCalledTimes(1);
    });
  });

  it("requests a loss interstitial only after the player chooses restart", async () => {
    let finishAd!: () => void;
    mockYsdkShowAd.mockReturnValueOnce(new Promise<void>((resolve) => {
      finishAd = resolve;
    }));

    const { GameCanvas } = await import("./GameCanvas");
    render(<GameCanvas />);

    await screen.findByText(/Уровень 1 \/ /);
    await startFromStartScreen();

    await act(async () => {
      onLoseCallback?.();
    });

    const restartButton = await screen.findByRole("button", { name: "Перезапустить" });
    const levelSelectButton = screen.getByRole("button", { name: "К выбору уровней" });

    expect(mockYsdkShowAd).not.toHaveBeenCalled();
    fireEvent.click(restartButton);

    await waitFor(() => {
      expect(mockYsdkShowAd).toHaveBeenCalledTimes(1);
    });
    expect(restartButton).toBeDisabled();
    expect(levelSelectButton).toBeDisabled();

    await act(async () => {
      finishAd();
      await Promise.resolve();
    });

    await waitFor(() => {
      expect(mockReset).toHaveBeenCalledTimes(1);
    });
  });

  it("continues a lost attempt with ten additional moves after a rewarded view", async () => {
    mockYsdkShowRewardedAd.mockResolvedValueOnce({ status: "rewarded" });

    const { GameCanvas } = await import("./GameCanvas");
    render(<GameCanvas />);

    await screen.findByText(/Уровень 1 \/ /);
    await startFromStartScreen();

    await act(async () => {
      onLoseCallback?.();
    });

    fireEvent.click(await screen.findByRole("button", { name: /10 ходов/ }));

    await waitFor(() => {
      expect(mockYsdkShowRewardedAd).toHaveBeenCalledTimes(1);
      expect(mockContinueAfterLoss).toHaveBeenCalledWith(expect.any(Number));
      expect(screen.queryByText("Ходы закончились")).not.toBeInTheDocument();
    });
    expect(mockYsdkShowAd).not.toHaveBeenCalled();
  });

  it("ignores a late win callback after game over", async () => {
    const { GameCanvas } = await import("./GameCanvas");
    render(<GameCanvas />);

    await waitFor(() => {
      expect(onLoseCallback).toEqual(expect.any(Function));
      expect(onWinCallback).toEqual(expect.any(Function));
    });

    await act(async () => {
      onLoseCallback?.();
    });

    expect(mockGameAudio.playLoss).toHaveBeenCalledTimes(1);

    await act(async () => {
      onWinCallback?.(8);
    });

    expect(mockGameAudio.playWin).not.toHaveBeenCalled();
    expect(mockGameAudio.playPerfectWin).not.toHaveBeenCalled();
    expect(mockSavePlayerProgress).not.toHaveBeenCalled();
  });

  it("starts the level timer on the first hop and stores the completion time after a win", async () => {
    const { GameCanvas } = await import("./GameCanvas");
    render(<GameCanvas />);

    await screen.findByText(/Уровень 1 \/ /);
    await renderFirstScene();
    await startFromStartScreen();

    vi.useFakeTimers();
    try {
      await act(async () => {
        onHopCallback?.();
      });

      await act(async () => {
        vi.advanceTimersByTime(1240);
      });

      expect(screen.getByTitle("Время попытки")).toHaveTextContent("0:01.2");

      await act(async () => {
        onWinCallback?.(8);
      });

      const savedProgress = mockSavePlayerProgress.mock.calls.at(-1)?.[0];
      expect(savedProgress.bestTimeMsByLevel).toEqual({ 1: 1240 });
      expect(mockYsdkSetLeaderboardScore).toHaveBeenCalledWith(
        "crash_cubes_total_stars",
        3,
        expect.stringContaining('"totalStars":3'),
        undefined,
      );
      expect(screen.getByText("Уровень пройден!")).toBeInTheDocument();
      expect(screen.getByText(/Время: 0:01.2/)).toBeInTheDocument();
      expect(screen.getAllByText("Гонка получена").length).toBeGreaterThan(0);
    } finally {
      vi.useRealTimers();
    }
  });

  it("copies a shareable result link after a win", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });

    const { GameCanvas } = await import("./GameCanvas");
    const { SHARED_RESULT_QUERY_PARAM, decodeSharedResult } = await import("@/game/shareResult");
    render(<GameCanvas />);

    await screen.findByText(/Уровень 1 \/ /);
    await renderFirstScene();
    await startFromStartScreen();

    await act(async () => {
      onHopCountCallback?.(8);
      onWinCallback?.(8);
    });

    fireEvent.click(screen.getByRole("button", { name: "Поделиться результатом" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledTimes(1);
    });

    const copiedUrl = writeText.mock.calls[0][0] as string;
    const token = new URL(copiedUrl).searchParams.get(SHARED_RESULT_QUERY_PARAM);
    const result = decodeSharedResult(token);

    expect(result).toMatchObject({
      kind: "level",
      completedLevels: 1,
      totalStars: 3,
      level: {
        number: 1,
        stars: 3,
        hops: 8,
        optimalMoves: 8,
      },
    });
    expect(await screen.findByText("Ссылка скопирована")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Открыть результат" })).toHaveAttribute("href", copiedUrl);
  });

  it("pauses the level timer while the pause menu is open", async () => {
    const { GameCanvas } = await import("./GameCanvas");
    render(<GameCanvas />);

    await screen.findByText(/Уровень 1 \/ /);
    await renderFirstScene();
    await startFromStartScreen();

    vi.useFakeTimers();
    try {
      await act(async () => {
        onHopCallback?.();
      });

      await act(async () => {
        vi.advanceTimersByTime(1000);
      });

      expect(screen.getByTitle("Время попытки")).toHaveTextContent("0:01.0");

      await act(async () => {
        fireEvent.click(screen.getByRole("button", { name: "Пауза" }));
      });

      expect(screen.getByRole("heading", { name: "Пауза" })).toBeInTheDocument();

      await act(async () => {
        vi.advanceTimersByTime(2000);
      });

      expect(screen.getByTitle("Время попытки")).toHaveTextContent("0:01.0");

      await act(async () => {
        fireEvent.click(screen.getAllByRole("button", { name: /Продолжить/ })[0]);
      });

      await act(async () => {
        vi.advanceTimersByTime(500);
      });

      expect(screen.getByTitle("Время попытки")).toHaveTextContent("0:01.5");
    } finally {
      vi.useRealTimers();
    }
  });

  it("shows special feedback for a three-star win", async () => {
    const { GameCanvas } = await import("./GameCanvas");
    render(<GameCanvas />);

    await screen.findByText(/Уровень 1 \/ /);
    await startFromStartScreen();

    await act(async () => {
      onHopCountCallback?.(8);
      onWinCallback?.(8);
    });

    expect(mockGameAudio.playPerfectWin).toHaveBeenCalledTimes(1);
    expect(mockGameAudio.playWin).not.toHaveBeenCalled();
    expect(screen.getByTestId("perfect-celebration")).toBeInTheDocument();
    expect(screen.getByText("Идеально!")).toBeInTheDocument();
  });

  it("keeps regular win feedback for a non-perfect win", async () => {
    const { GameCanvas } = await import("./GameCanvas");
    render(<GameCanvas />);

    await screen.findByText(/Уровень 1 \/ /);
    await startFromStartScreen();

    await act(async () => {
      onHopCountCallback?.(12);
      onWinCallback?.(12);
    });

    expect(mockGameAudio.playWin).toHaveBeenCalledTimes(1);
    expect(mockGameAudio.playPerfectWin).not.toHaveBeenCalled();
    expect(screen.queryByTestId("perfect-celebration")).not.toBeInTheDocument();
  });

  it("plays hop sounds with the current chapter theme", async () => {
    mockLoadPlayerProgress.mockResolvedValue({
      version: 1,
      unlockedLevel: 6,
      completedLevels: [1, 2, 3, 4, 5],
      bestStarsByLevel: {},
      bestTimeMsByLevel: {},
      hasStarted: true,
      tutorialComplete: true,
      audioMuted: false,
    });

    const { GameCanvas } = await import("./GameCanvas");
    const view = render(<GameCanvas />);

    await screen.findByText(/Уровень 6 \/ /);
    await startFromStartScreen();

    await act(async () => {
      onHopCallback?.();
    });

    expect(mockGameAudio.playHop).toHaveBeenCalledWith("slime");
    view.unmount();
  });
});
