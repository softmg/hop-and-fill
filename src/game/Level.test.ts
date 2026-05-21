import { describe, expect, it } from "vitest";
import { resolveTeleportDestination, type TeleportPair } from "./Level";

describe("resolveTeleportDestination", () => {
  it("resolves both directions for a unique teleport endpoint", () => {
    const pairs: TeleportPair[] = [
      { from: { gx: 0, gy: 1 }, to: { gx: 4, gy: 3 } },
    ];

    expect(resolveTeleportDestination(pairs, 0, 1)).toEqual({ gx: 4, gy: 3 });
    expect(resolveTeleportDestination(pairs, 4, 3)).toEqual({ gx: 0, gy: 1 });
  });

  it("rejects endpoints reused by multiple teleport pairs", () => {
    const pairs: TeleportPair[] = [
      { from: { gx: 0, gy: 1 }, to: { gx: 4, gy: 3 } },
      { from: { gx: 0, gy: 1 }, to: { gx: 2, gy: 5 } },
    ];

    expect(resolveTeleportDestination(pairs, 0, 1)).toBeNull();
  });
});
