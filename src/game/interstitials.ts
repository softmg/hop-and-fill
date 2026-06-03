export const INTERSTITIAL_REQUEST_COOLDOWN_MS = 70 * 1000;

export type InterstitialTrigger = "none" | "after-loss" | "after-win" | "restart";

/**
 * The SDK uses a flexible platform throttle. This client-side interval is a
 * conservative product limit so rapid level transitions do not issue requests.
 */
export function canRequestInterstitial(
  lastRequestedAtMs: number | null,
  requestedAtMs: number,
  cooldownMs = INTERSTITIAL_REQUEST_COOLDOWN_MS,
) {
  return lastRequestedAtMs === null || requestedAtMs - lastRequestedAtMs >= cooldownMs;
}
