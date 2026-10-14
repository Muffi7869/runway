"use client";

import { useSyncExternalStore } from "react";

import {
  applyThemePreference,
  parseThemePreference,
  THEME_COOKIE_NAME,
  THEME_STORAGE_KEY,
  type ThemePreference,
} from "../lib/theme";

import { SegmentedControl } from "./ui/segmented-control";

const OPTIONS = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
] as const;

const THEME_CHANGE_EVENT = "runway-theme-change";

function subscribe(onChange: () => void) {
  window.addEventListener("storage", onChange);
  window.addEventListener(THEME_CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onChange);
    window.removeEventListener(THEME_CHANGE_EVENT, onChange);
  };
}

function getPreference() {
  const cookie = document.cookie
    .split("; ")
    .find((part) => part.startsWith(`${THEME_COOKIE_NAME}=`));
  let stored: string | null = null;
  try {
    stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  } catch {
    // The cookie remains the fallback when storage is unavailable.
  }
  return parseThemePreference(
    stored ?? (cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : null),
  );
}

function setPreference(preference: ThemePreference) {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  applyThemePreference(preference, {
    prefersDark: media.matches,
    setLocalStorage: (key, value) => window.localStorage.setItem(key, value),
    setCookie: (value) => {
      document.cookie = `${THEME_COOKIE_NAME}=${value}; path=/; max-age=31536000; SameSite=Lax`;
    },
    setThemeAttribute: (theme) => {
      document.documentElement.dataset.theme = theme;
    },
    setColorScheme: (theme) => {
      document.documentElement.style.colorScheme = theme;
    },
  });
}

export function ThemeControl({ className }: { className?: string }) {
  const preference = useSyncExternalStore(
    subscribe,
    getPreference,
    () => "system" as const,
  );

  function select(next: ThemePreference) {
    setPreference(next);
    window.dispatchEvent(new Event(THEME_CHANGE_EVENT));
  }

  return (
    <SegmentedControl
      ariaLabel="Theme"
      className={className}
      onValueChange={select}
      options={OPTIONS}
      value={preference}
    />
  );
}
