import { describe, expect, it } from "vitest";
import { getInitialLandingCount } from "./Tile";

describe("Tile fragile landing state", () => {
  it("counts the start occupancy only for a fragile start tile", () => {
    expect(getInitialLandingCount(true, "fragile")).toBe(1);
    expect(getInitialLandingCount(false, "fragile")).toBe(0);
    expect(getInitialLandingCount(true, "normal")).toBe(0);
  });
});
