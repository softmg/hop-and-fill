import { describe, expect, it } from "vitest";
import { FIRST_TUTORIAL_ARROW, getTutorialArrowHint } from "./tutorialArrow";

describe("tutorial arrow hints", () => {
  it("uses a player-facing down move for the first tutorial prompt", () => {
    expect(FIRST_TUTORIAL_ARROW).toEqual({
      direction: "SE",
      rotationDeg: 0,
      offset: { x: 0, y: -40 },
      pulseOffset: { x: 0, y: 12 },
    });
  });

  it("keeps arrow rotations aligned with screen-facing movement directions", () => {
    expect(getTutorialArrowHint("NW").rotationDeg).toBe(180);
    expect(getTutorialArrowHint("NE").rotationDeg).toBe(-90);
    expect(getTutorialArrowHint("SW").rotationDeg).toBe(90);
  });

  it("animates the pulse along the configured movement direction", () => {
    expect(getTutorialArrowHint("SE").pulseOffset).toEqual({ x: 0, y: 12 });
    expect(getTutorialArrowHint("NE").pulseOffset).toEqual({ x: 12, y: 0 });
    expect(getTutorialArrowHint("NW").pulseOffset).toEqual({ x: 0, y: -12 });
  });
});
