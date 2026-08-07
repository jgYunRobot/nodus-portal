import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ThemeMenu } from "../components/actions/theme_menu";
import { THEME_STORAGE_KEY } from "../stores/theme_store";
import { ThemeProvider } from "./theme_provider";

describe("ThemeProvider", () => {
  beforeEach(() => {
    window.localStorage.clear();
    document.documentElement.dataset.theme = "black";
    vi.stubGlobal("matchMedia", () => ({
      matches: true,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn()
    }));
  });

  it("defaults to black and persists an accessible theme choice", async () => {
    const user = userEvent.setup();
    render(
      <ThemeProvider>
        <ThemeMenu />
      </ThemeProvider>
    );
    expect(document.documentElement.dataset.theme).toBe("black");
    await user.click(screen.getByRole("button", { name: "Choose theme" }));
    await user.click(
      await screen.findByRole("menuitemradio", { name: "Light" })
    );
    expect(document.documentElement.dataset.theme).toBe("light");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("light");
  });
});
