import type { ReactNode } from "react";
import { useEffect } from "react";
import { initializeTheme } from "../stores/theme_store";

interface ThemeProviderProps {
  children: ReactNode;
}

export function ThemeProvider({ children }: ThemeProviderProps) {
  useEffect(() => {
    initializeTheme();
  }, []);
  return children;
}
