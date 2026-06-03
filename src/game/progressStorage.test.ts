import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockYsdkIsPlayerAuthorized,
  mockYsdkLoad,
  mockYsdkSave,
} = vi.hoisted(() => ({
  mockYsdkIsPlayerAuthorized: vi.fn(),
  mockYsdkLoad: vi.fn(),
  mockYsdkSave: vi.fn(),
}));

vi.mock("@/platform/yandexGames", () => ({
  ysdkIsPlayerAuthorized: mockYsdkIsPlayerAuthorized,
  ysdkLoad: mockYsdkLoad,
  ysdkSave: mockYsdkSave,
}));

import {
  PLAYER_PROGRESS_KEY,
  createDefaultProgress,
  loadPlayerProgress,
  savePlayerProgress,
} from "./progress";

describe("player progress storage routing", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    mockYsdkLoad.mockResolvedValue({});
    mockYsdkSave.mockResolvedValue(undefined);
  });

  it("merges local guest data into cloud data for authorized players", async () => {
    mockYsdkIsPlayerAuthorized.mockResolvedValue(true);
    const localProgress = {
      ...createDefaultProgress(),
      unlockedLevel: 4,
      completedLevels: [1, 2, 3],
      bestStarsByLevel: { 1: 3 },
      hasStarted: true,
    };
    localStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(localProgress));

    const progress = await loadPlayerProgress(5);

    expect(progress).toEqual(localProgress);
    expect(localStorage.getItem(PLAYER_PROGRESS_KEY)).toBeNull();
    expect(mockYsdkLoad).toHaveBeenCalledWith([PLAYER_PROGRESS_KEY]);
  });

  it("preserves local progress when authorized cloud load fails", async () => {
    mockYsdkIsPlayerAuthorized.mockResolvedValue(true);
    mockYsdkLoad.mockRejectedValue(new Error("cloud load failed"));
    const localProgress = {
      ...createDefaultProgress(),
      unlockedLevel: 3,
      completedLevels: [1, 2],
      hasStarted: true,
    };
    localStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(localProgress));

    const progress = await loadPlayerProgress(5);

    expect(progress).toEqual(localProgress);
    expect(JSON.parse(localStorage.getItem(PLAYER_PROGRESS_KEY) || "null")).toEqual(localProgress);
    expect(mockYsdkLoad).toHaveBeenCalledWith([PLAYER_PROGRESS_KEY]);
  });

  it("saves guest progress in local storage only", async () => {
    mockYsdkIsPlayerAuthorized.mockResolvedValue(false);
    const progress = { ...createDefaultProgress(), hasStarted: true };

    await savePlayerProgress(progress);

    expect(JSON.parse(localStorage.getItem(PLAYER_PROGRESS_KEY) || "null")).toEqual(progress);
    expect(mockYsdkSave).not.toHaveBeenCalled();
  });

  it("saves authorized progress in the cloud only", async () => {
    mockYsdkIsPlayerAuthorized.mockResolvedValue(true);
    const progress = { ...createDefaultProgress(), hasStarted: true };
    localStorage.setItem(PLAYER_PROGRESS_KEY, JSON.stringify(progress));

    await savePlayerProgress(progress);

    expect(localStorage.getItem(PLAYER_PROGRESS_KEY)).toBeNull();
    expect(mockYsdkSave).toHaveBeenCalledWith({ [PLAYER_PROGRESS_KEY]: progress });
  });

  it("preserves local progress when authorized cloud save fails", async () => {
    mockYsdkIsPlayerAuthorized.mockResolvedValue(true);
    mockYsdkSave.mockRejectedValue(new Error("cloud save failed"));
    const progress = { ...createDefaultProgress(), hasStarted: true };

    await savePlayerProgress(progress);

    expect(JSON.parse(localStorage.getItem(PLAYER_PROGRESS_KEY) || "null")).toEqual(progress);
    expect(mockYsdkSave).toHaveBeenCalledWith({ [PLAYER_PROGRESS_KEY]: progress });
  });
});
