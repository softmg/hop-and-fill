import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MOBILE_JOYSTICK_REPEAT_MS, MobileJoystick } from "./MobileJoystick";

const joystickRect = {
  x: 0,
  y: 0,
  left: 0,
  top: 0,
  right: 128,
  bottom: 128,
  width: 128,
  height: 128,
  toJSON: () => {},
};

const dispatchPointer = (
  target: HTMLElement,
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  init: { pointerId: number; clientX: number; clientY: number },
) => {
  const event = new Event(type, { bubbles: true, cancelable: true });
  Object.defineProperties(event, {
    pointerId: { value: init.pointerId },
    clientX: { value: init.clientX },
    clientY: { value: init.clientY },
  });
  fireEvent(target, event);
};

describe("MobileJoystick", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("emits immediately when the held pointer enters a direction", () => {
    const onDirection = vi.fn();
    render(<MobileJoystick onDirection={onDirection} />);

    const joystick = screen.getByTestId("mobile-joystick");
    vi.spyOn(joystick, "getBoundingClientRect").mockReturnValue(joystickRect);

    dispatchPointer(joystick, "pointerdown", { pointerId: 1, clientX: 64, clientY: 64 });
    expect(onDirection).not.toHaveBeenCalled();

    dispatchPointer(joystick, "pointermove", { pointerId: 1, clientX: 116, clientY: 64 });

    expect(onDirection).toHaveBeenCalledTimes(1);
    expect(onDirection).toHaveBeenLastCalledWith("NE");
  });

  it("repeats the held direction without additional pointer movement", () => {
    vi.useFakeTimers();
    const onDirection = vi.fn();
    render(<MobileJoystick onDirection={onDirection} />);

    const joystick = screen.getByTestId("mobile-joystick");
    vi.spyOn(joystick, "getBoundingClientRect").mockReturnValue(joystickRect);

    dispatchPointer(joystick, "pointerdown", { pointerId: 1, clientX: 116, clientY: 64 });
    expect(onDirection).toHaveBeenCalledTimes(1);

    act(() => {
      vi.advanceTimersByTime(MOBILE_JOYSTICK_REPEAT_MS * 3);
    });

    expect(onDirection).toHaveBeenCalledTimes(4);
    expect(onDirection).toHaveBeenLastCalledWith("NE");
  });

  it("uses the latest held direction for repeats after the vector changes", () => {
    vi.useFakeTimers();
    const onDirection = vi.fn();
    render(<MobileJoystick onDirection={onDirection} />);

    const joystick = screen.getByTestId("mobile-joystick");
    vi.spyOn(joystick, "getBoundingClientRect").mockReturnValue(joystickRect);

    dispatchPointer(joystick, "pointerdown", { pointerId: 1, clientX: 116, clientY: 64 });
    dispatchPointer(joystick, "pointermove", { pointerId: 1, clientX: 64, clientY: 116 });

    expect(onDirection).toHaveBeenCalledTimes(2);
    expect(onDirection).toHaveBeenLastCalledWith("SE");

    act(() => {
      vi.advanceTimersByTime(MOBILE_JOYSTICK_REPEAT_MS);
    });

    expect(onDirection).toHaveBeenCalledTimes(3);
    expect(onDirection).toHaveBeenLastCalledWith("SE");
  });

  it("stops repeating when the pointer returns to the dead zone", () => {
    vi.useFakeTimers();
    const onDirection = vi.fn();
    render(<MobileJoystick onDirection={onDirection} />);

    const joystick = screen.getByTestId("mobile-joystick");
    vi.spyOn(joystick, "getBoundingClientRect").mockReturnValue(joystickRect);

    dispatchPointer(joystick, "pointerdown", { pointerId: 1, clientX: 116, clientY: 64 });

    act(() => {
      vi.advanceTimersByTime(MOBILE_JOYSTICK_REPEAT_MS);
    });
    expect(onDirection).toHaveBeenCalledTimes(2);

    dispatchPointer(joystick, "pointermove", { pointerId: 1, clientX: 64, clientY: 64 });

    act(() => {
      vi.advanceTimersByTime(MOBILE_JOYSTICK_REPEAT_MS * 3);
    });

    expect(onDirection).toHaveBeenCalledTimes(2);
  });

  it.each(["pointerup", "pointercancel"] as const)("stops repeating on %s", (type) => {
    vi.useFakeTimers();
    const onDirection = vi.fn();
    render(<MobileJoystick onDirection={onDirection} />);

    const joystick = screen.getByTestId("mobile-joystick");
    vi.spyOn(joystick, "getBoundingClientRect").mockReturnValue(joystickRect);

    dispatchPointer(joystick, "pointerdown", { pointerId: 1, clientX: 116, clientY: 64 });

    act(() => {
      vi.advanceTimersByTime(MOBILE_JOYSTICK_REPEAT_MS);
    });
    expect(onDirection).toHaveBeenCalledTimes(2);

    dispatchPointer(joystick, type, { pointerId: 1, clientX: 116, clientY: 64 });

    act(() => {
      vi.advanceTimersByTime(MOBILE_JOYSTICK_REPEAT_MS * 3);
    });

    expect(onDirection).toHaveBeenCalledTimes(2);
  });

  it("does not emit while disabled", () => {
    const onDirection = vi.fn();
    render(<MobileJoystick disabled onDirection={onDirection} />);

    const joystick = screen.getByTestId("mobile-joystick");
    vi.spyOn(joystick, "getBoundingClientRect").mockReturnValue(joystickRect);

    dispatchPointer(joystick, "pointerdown", { pointerId: 1, clientX: 116, clientY: 64 });
    dispatchPointer(joystick, "pointerup", { pointerId: 1, clientX: 116, clientY: 64 });

    expect(onDirection).not.toHaveBeenCalled();
  });
});
