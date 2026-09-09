import { describe, expect, it } from "vitest";
import { getDirectoryBasename } from "./platform/routing";

describe("getDirectoryBasename", () => {
  it.each([
    ["https://example.com/games/hop-and-fill/", "/games/hop-and-fill"],
    ["https://example.com/games/hop-and-fill/index.html", "/games/hop-and-fill"],
  ])("derives a router basename from %s", (href, expected) => {
    expect(getDirectoryBasename(href)).toBe(expected);
  });
});
