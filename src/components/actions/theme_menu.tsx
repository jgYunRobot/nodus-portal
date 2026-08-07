import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Monitor, Moon, Sun } from "lucide-react";
import {
  setThemePreference,
  type ThemePreference,
  useThemePreference
} from "../../stores/theme_store";
import { Button } from "./button";
import styles from "./theme_menu.module.css";

const theme_options: Array<{ label: string; value: ThemePreference }> = [
  { label: "Black", value: "black" },
  { label: "Light", value: "light" },
  { label: "System", value: "system" }
];

export function ThemeMenu() {
  const preference = useThemePreference();
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <Button aria-label="Choose theme" tone="secondary">
          <ThemeIcon preference={preference} />
          Theme
        </Button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          className={styles.content}
          sideOffset={8}
        >
          <DropdownMenu.RadioGroup
            onValueChange={(value) =>
              setThemePreference(value as ThemePreference)
            }
            value={preference}
          >
            {theme_options.map((option) => (
              <DropdownMenu.RadioItem
                className={styles.item}
                key={option.value}
                value={option.value}
              >
                <DropdownMenu.ItemIndicator>✓</DropdownMenu.ItemIndicator>
                {option.label}
              </DropdownMenu.RadioItem>
            ))}
          </DropdownMenu.RadioGroup>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}

function ThemeIcon({ preference }: { preference: ThemePreference }) {
  if (preference === "black") return <Moon aria-hidden="true" size={18} />;
  if (preference === "light") return <Sun aria-hidden="true" size={18} />;
  return <Monitor aria-hidden="true" size={18} />;
}
