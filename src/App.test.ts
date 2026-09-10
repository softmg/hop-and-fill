import { describe, expect, it } from "vitest";
import { getConfiguredBasename, getDirectoryBasename } from "./platform/routing";

describe("getDirectoryBasename", () => {
  it.each([
    ["https://example.com/games/hop-and-fill/", "/games/hop-and-fill"],
    ["https://example.com/games/hop-and-fill/index.html", "/games/hop-and-fill"],
  ])("derives a router basename from %s", (href, expected) => {
    expect(getDirectoryBasename(href)).toBe(expected);
  });
});

describe("getConfiguredBasename", () => {
  it.each([
    ["/games/hop-and-fill/", "/games/hop-and-fill"],
    ["/games/hop-and-fill", "/games/hop-and-fill"],
    ["/", "/"],
  ])("normalizes the configured base %s", (base, expected) => {
    expect(getConfiguredBasename(base)).toBe(expected);
  });

  it("ignores a location that is missing the trailing slash", () => {
    // Раньше basename выводился из адреса: /games/hop-and-fill без слэша
    // давал /games, и любой маршрут уходил на страницу «не найдено».
    expect(getDirectoryBasename("https://example.com/games/hop-and-fill")).toBe("/games");
    expect(getConfiguredBasename("/games/hop-and-fill/")).toBe("/games/hop-and-fill");
  });
});
