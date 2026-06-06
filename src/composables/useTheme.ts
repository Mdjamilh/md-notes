import { watchEffect } from "vue";
import { useSettingsStore } from "../stores/settings";

/** Mirrors the theme setting onto <html data-theme>; "system" removes it so CSS follows the OS. */
export function useTheme(): void {
  const settings = useSettingsStore();
  watchEffect(() => {
    const root = document.documentElement;
    if (settings.theme === "system") root.removeAttribute("data-theme");
    else root.dataset.theme = settings.theme;
  });
}
