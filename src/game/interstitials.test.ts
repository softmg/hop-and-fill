import { describe, expect, it } from "vitest";
import { canRequestInterstitial, INTERSTITIAL_REQUEST_COOLDOWN_MS } from "./interstitials";

describe("interstitial scheduling", () => {
  it("allows the first terminal transition request", () => {
    expect(canRequestInterstitial(null, 1000)).toBe(true);
  });

  it("does not request an interstitial again before the client cooldown", () => {
    expect(canRequestInterstitial(1000, 1000 + INTERSTITIAL_REQUEST_COOLDOWN_MS - 1)).toBe(false);
  });

  it("allows a request once the client cooldown has elapsed", () => {
    expect(canRequestInterstitial(1000, 1000 + INTERSTITIAL_REQUEST_COOLDOWN_MS)).toBe(true);
  });
});
