import { useSyncExternalStore } from "react";

export type ThemePreference = "black" | "light" | "system";
export type ResolvedTheme = "black" | "light";
export const THEME_STORAGE_KEY = "nodus_portal.theme.v1";

const listeners = new Set<() => void>();
let preference = readThemePreference();
let media_query: MediaQueryList | undefined;

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(
    subscribeTheme,
    getThemePreference,
    getThemePreference
  );
}

export function setThemePreference(next_preference: ThemePreference): void {
  preference = next_preference;
  window.localStorage.setItem(THEME_STORAGE_KEY, next_preference);
  applyTheme(next_preference);
  notifyListeners();
}

export function initializeTheme(): void {
  preference = readThemePreference();
  applyTheme(preference);
  ensureMediaSubscription();
}

export function resolveTheme(
  value: ThemePreference,
  system_is_dark: boolean
): ResolvedTheme {
  return value === "system" ? (system_is_dark ? "black" : "light") : value;
}

function subscribeTheme(listener: () => void): () => void {
  listeners.add(listener);
  ensureMediaSubscription();
  return () => listeners.delete(listener);
}

function getThemePreference(): ThemePreference {
  return preference;
}

function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "black";
  const stored_value = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored_value === "black" ||
    stored_value === "light" ||
    stored_value === "system"
    ? stored_value
    : "black";
}

function applyTheme(value: ThemePreference): void {
  const resolved_theme = resolveTheme(value, isSystemDark());
  document.documentElement.dataset.theme = resolved_theme;
  document.documentElement.style.colorScheme =
    resolved_theme === "black" ? "dark" : "light";
}

function ensureMediaSubscription(): void {
  if (typeof window === "undefined" || media_query !== undefined) return;
  media_query = window.matchMedia("(prefers-color-scheme: dark)");
  media_query.addEventListener("change", handleSystemThemeChange);
}

function handleSystemThemeChange(): void {
  if (preference === "system") {
    applyTheme(preference);
    notifyListeners();
  }
}

function isSystemDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  );
}

function notifyListeners(): void {
  for (const listener of listeners) listener();
}
