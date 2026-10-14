export const THEME_STORAGE_KEY = "runway-theme";
export const THEME_COOKIE_NAME = "runway-theme";

export type ThemePreference = "system" | "light" | "dark";
export type ResolvedTheme = "light" | "dark";

export function parseThemePreference(value: unknown): ThemePreference {
  return value === "light" || value === "dark" || value === "system"
    ? value
    : "system";
}

export function resolveTheme(
  preference: ThemePreference,
  prefersDark: boolean,
): ResolvedTheme {
  return preference === "system"
    ? prefersDark
      ? "dark"
      : "light"
    : preference;
}

export type ThemeEnvironment = {
  prefersDark: boolean;
  setLocalStorage: (key: string, value: string) => void;
  setCookie: (value: string) => void;
  setThemeAttribute: (theme: ResolvedTheme) => void;
  setColorScheme: (theme: ResolvedTheme) => void;
};

export function applyThemePreference(
  preference: ThemePreference,
  environment: ThemeEnvironment,
): ResolvedTheme {
  const theme = resolveTheme(preference, environment.prefersDark);
  environment.setLocalStorage(THEME_STORAGE_KEY, preference);
  environment.setCookie(preference);
  environment.setThemeAttribute(theme);
  environment.setColorScheme(theme);
  return theme;
}
