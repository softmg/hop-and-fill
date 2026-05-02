import type { Dir } from "@/game/iso";

export interface TutorialArrowHint {
  direction: Dir;
  rotationDeg: number;
  offset: {
    x: number;
    y: number;
  };
  pulseOffset: {
    x: number;
    y: number;
  };
}

const ROTATION_BY_DIRECTION: Record<Dir, number> = {
  NE: -90,
  SE: 0,
  SW: 90,
  NW: 180,
  N: -45,
  E: 45,
  S: 135,
  W: -135,
};

const OFFSET_BY_DIRECTION: Record<Dir, { x: number; y: number }> = {
  NE: { x: -40, y: 0 },
  SE: { x: 0, y: -40 },
  SW: { x: 40, y: 0 },
  NW: { x: 0, y: 40 },
  N: { x: -28, y: 28 },
  E: { x: -28, y: -28 },
  S: { x: 28, y: -28 },
  W: { x: 28, y: 28 },
};

const PULSE_OFFSET_BY_DIRECTION: Record<Dir, { x: number; y: number }> = {
  NE: { x: 12, y: 0 },
  SE: { x: 0, y: 12 },
  SW: { x: -12, y: 0 },
  NW: { x: 0, y: -12 },
  N: { x: -8, y: -8 },
  E: { x: 8, y: -8 },
  S: { x: 8, y: 8 },
  W: { x: -8, y: 8 },
};

export function getTutorialArrowHint(direction: Dir): TutorialArrowHint {
  return {
    direction,
    rotationDeg: ROTATION_BY_DIRECTION[direction],
    offset: OFFSET_BY_DIRECTION[direction],
    pulseOffset: PULSE_OFFSET_BY_DIRECTION[direction],
  };
}

export const FIRST_TUTORIAL_ARROW = getTutorialArrowHint("SE");
