import { describe, expect, it, vi } from "vitest";

import { THEME_BOOTSTRAP_SCRIPT } from "./bootstrap";

import {
  applyThemePreference,
  parseThemePreference,
  resolveTheme,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  themeDataAttribute,
  type ResolvedTheme,
} from "./index";

describe("theme helpers", () => {
  it.each([
    ["system", "system"],
    ["light", "light"],
    ["dark", "dark"],
    ["unknown", "system"],
    [undefined, "system"],
  ] as const)("parses %s", (value, expected) => {
    expect(parseThemePreference(value)).toBe(expected);
  });

  it("resolves system, light, and dark preferences", () => {
    expect(resolveTheme("system", true)).toBe("dark");
    expect(resolveTheme("system", false)).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(resolveTheme("dark", false)).toBe("dark");
  });

  it.each([
    ["light", "light"],
    ["dark", "dark"],
    ["system", undefined],
    ["unknown", undefined],
    [undefined, undefined],
  ] as const)("maps cookie value %s to the initial data theme", (value, expected) => {
    expect(themeDataAttribute(value)).toBe(expected);
  });

  it.each([
    ["system", true, "dark"],
    ["light", true, "light"],
    ["dark", false, "dark"],
  ] as const)("stores %s in both stores and applies it immediately", (preference, prefersDark, expected) => {
    const stored = vi.fn();
    const cookie = vi.fn();
    const attribute = vi.fn<(theme: ResolvedTheme) => void>();
    const colorScheme = vi.fn<(theme: ResolvedTheme) => void>();

    expect(
      applyThemePreference(preference, {
        prefersDark,
        setLocalStorage: stored,
        setCookie: cookie,
        setThemeAttribute: attribute,
        setColorScheme: colorScheme,
      }),
    ).toBe(expected);
    expect(stored).toHaveBeenCalledWith(THEME_STORAGE_KEY, preference);
    expect(cookie).toHaveBeenCalledWith(preference);
    expect(attribute).toHaveBeenCalledWith(expected);
    expect(colorScheme).toHaveBeenCalledWith(expected);
  });

  it("keeps an explicit light cookie light on a dark-mode device", () => {
    expect(themeDataAttribute("light")).toBe("light");
    expect(resolveTheme("light", true)).toBe("light");
    expect(THEME_BOOTSTRAP_SCRIPT).toContain("cookie()||localStorage.getItem(k)");
  });

  it("uses stable storage names", () => {
    expect(THEME_STORAGE_KEY).toBe("runway-theme");
    expect(THEME_COOKIE_NAME).toBe("runway-theme");
  });
});
