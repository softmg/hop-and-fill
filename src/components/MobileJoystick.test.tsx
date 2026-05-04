import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MobileJoystick } from "./MobileJoystick";

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
  type: "pointerdown" | "pointermove" | "pointerup",
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
  it("emits one 8-way direction per push", () => {
    const onDirection = vi.fn();
    render(<MobileJoystick onDirection={onDirection} />);

    const joystick = screen.getByTestId("mobile-joystick");
    vi.spyOn(joystick, "getBoundingClientRect").mockReturnValue(joystickRect);

    dispatchPointer(joystick, "pointerdown", { pointerId: 1, clientX: 64, clientY: 64 });
    dispatchPointer(joystick, "pointermove", { pointerId: 1, clientX: 116, clientY: 64 });
    dispatchPointer(joystick, "pointermove", { pointerId: 1, clientX: 64, clientY: 116 });
    dispatchPointer(joystick, "pointerup", { pointerId: 1, clientX: 64, clientY: 116 });

    expect(onDirection).toHaveBeenCalledTimes(1);
    expect(onDirection).toHaveBeenLastCalledWith("NE");
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
