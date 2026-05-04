import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BOARD_COMBO_DEBOUNCE_MS, Input, screenVectorToDir } from "./Input";

describe("Input keyboard combinations", () => {
  let host: HTMLDivElement;
  let input: Input;
  let handler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    host = document.createElement("div");
    document.body.appendChild(host);
    handler = vi.fn();
    input = new Input(host, handler);
  });

  afterEach(() => {
    input.destroy();
    host.remove();
    vi.useRealTimers();
  });

  it("delays single WASD movement so a diagonal combo can form", () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w", cancelable: true }));

    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(BOARD_COMBO_DEBOUNCE_MS - 1);
    expect(handler).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith("N");
  });

  it("emits WA as one diagonal move when the second key lands inside the debounce window", () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "w", cancelable: true }));
    vi.advanceTimersByTime(BOARD_COMBO_DEBOUNCE_MS - 1);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "a", cancelable: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith("NW");

    vi.advanceTimersByTime(BOARD_COMBO_DEBOUNCE_MS);
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("flushes a quick single-key tap on key release", () => {
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "d", cancelable: true }));
    vi.advanceTimersByTime(BOARD_COMBO_DEBOUNCE_MS / 2);

    window.dispatchEvent(new KeyboardEvent("keyup", { key: "d", cancelable: true }));

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenLastCalledWith("E");

    vi.advanceTimersByTime(BOARD_COMBO_DEBOUNCE_MS);
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

describe("screenVectorToDir", () => {
  it.each([
    [48, 0, "NE"],
    [48, 48, "E"],
    [0, 48, "SE"],
    [-48, 48, "S"],
    [-48, 0, "SW"],
    [-48, -48, "W"],
    [0, -48, "NW"],
    [48, -48, "N"],
  ] as const)("maps screen vector %i,%i to %s", (dx, dy, dir) => {
    expect(screenVectorToDir(dx, dy)).toBe(dir);
  });

  it("ignores small touch movement inside the dead zone", () => {
    expect(screenVectorToDir(8, 8)).toBeNull();
  });
});
