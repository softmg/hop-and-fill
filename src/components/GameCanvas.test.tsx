import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { act } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let firstSceneRenderableCallback: (() => void) | null = null;
let onHopCountCallback: ((hops: number) => void) | null = null;

const mockLoadPlayerProgress = vi.fn();
const mockSavePlayerProgress = vi.fn().mockResolvedValue(undefined);
const mockYsdkReady = vi.fn().mockResolvedValue(undefined);
const mockYsdkGameplayStart = vi.fn().mockResolvedValue(undefined);
const mockYsdkGameplayStop = vi.fn().mockResolvedValue(undefined);
const mockDestroy = vi.fn();
const mockReset = vi.fn();
const mockSetLevel = vi.fn();
const mockSetMoveLimit = vi.fn();
const mockTriggerDir = vi.fn();

vi.mock("@/game/PixiGame", () => ({
  PixiGame: class {
    constructor(
      _host: HTMLDivElement,
      _level: unknown,
      callbacks: { onHopCount: (hops: number) => void },
      options?: { onFirstSceneRenderable?: () => void },
    ) {
      onHopCountCallback = callbacks.onHopCount;
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

    triggerDir(dir: unknown) {
      mockTriggerDir(dir);
    }
  },
}));

vi.mock("@/sdk/yandex", () => ({
  ysdkReady: mockYsdkReady,
  ysdkGameplayStart: mockYsdkGameplayStart,
  ysdkGameplayStop: mockYsdkGameplayStop,
}));

vi.mock("@/game/progress", async () => {
  const actual = await vi.importActual<typeof import("@/game/progress")>("@/game/progress");
  return {
    ...actual,
    loadPlayerProgress: mockLoadPlayerProgress,
    savePlayerProgress: mockSavePlayerProgress,
  };
});

describe("GameCanvas yandex lifecycle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firstSceneRenderableCallback = null;
    onHopCountCallback = null;
    mockLoadPlayerProgress.mockResolvedValue({
      version: 1,
      unlockedLevel: 1,
      completedLevels: [],
      bestStarsByLevel: {},
      tutorialComplete: true,
    });
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  afterEach(() => {
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
  });

  it("waits for the first renderable scene before readying and syncs gameplay around overlays, visibility, and unmount", async () => {
    const { GameCanvas } = await import("./GameCanvas");
    const view = render(<GameCanvas />);

    await screen.findByText(/Уровень 1 \/ /);

    expect(mockYsdkReady).not.toHaveBeenCalled();
    expect(mockYsdkGameplayStart).not.toHaveBeenCalled();
    expect(mockYsdkGameplayStop).toHaveBeenCalledTimes(1);

    await act(async () => {
      firstSceneRenderableCallback?.();
    });

    await waitFor(() => {
      expect(mockYsdkReady).toHaveBeenCalledTimes(1);
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

  it("keeps gameplay paused while the tutorial overlay is blocking", async () => {
    mockLoadPlayerProgress.mockResolvedValue({
      version: 1,
      unlockedLevel: 1,
      completedLevels: [],
      bestStarsByLevel: {},
      tutorialComplete: false,
    });

    const { GameCanvas } = await import("./GameCanvas");
    render(<GameCanvas />);

    await screen.findByText(/Уровень 1 \/ /);

    await act(async () => {
      firstSceneRenderableCallback?.();
    });

    await waitFor(() => {
      expect(mockYsdkReady).toHaveBeenCalledTimes(1);
    });
    expect(mockYsdkGameplayStart).not.toHaveBeenCalled();

    await act(async () => {
      onHopCountCallback?.(1);
    });

    fireEvent.click(screen.getByRole("button", { name: "Понятно" }));

    await waitFor(() => {
      expect(mockYsdkGameplayStart).toHaveBeenCalledTimes(1);
    });
  });
});
