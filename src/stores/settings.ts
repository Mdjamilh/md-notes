import { defineStore } from "pinia";
import { ref, watch } from "vue";
import { DEFAULT_MODEL, DEFAULT_OLLAMA_URL } from "../lib/ollama";

export type Theme = "system" | "light" | "dark";
export type ViewMode = "split" | "edit" | "preview";

export interface Settings {
  theme: Theme;
  view: ViewMode;
  /** The local-AI feature is opt-in; nothing is ever sent while this is false. */
  aiEnabled: boolean;
  ollamaUrl: string;
  ollamaModel: string;
}

const KEY = "md-notes:settings";

export const DEFAULTS: Settings = {
  theme: "system",
  view: "split",
  aiEnabled: false,
  ollamaUrl: DEFAULT_OLLAMA_URL,
  ollamaModel: DEFAULT_MODEL,
};

/** Reads saved settings, keeping only known keys with the right types. */
export function readSettings(): Settings {
  let saved: Record<string, unknown> = {};
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(KEY) ?? "{}");
    if (parsed && typeof parsed === "object") saved = parsed as Record<string, unknown>;
  } catch {
    /* corrupt or blocked storage: fall back to defaults */
  }
  const pick = <K extends keyof Settings>(key: K, ok: (v: unknown) => boolean): Settings[K] =>
    ok(saved[key]) ? (saved[key] as Settings[K]) : DEFAULTS[key];
  const isString = (v: unknown) => typeof v === "string" && v.trim() !== "";
  return {
    theme: pick("theme", (v) => v === "system" || v === "light" || v === "dark"),
    view: pick("view", (v) => v === "split" || v === "edit" || v === "preview"),
    aiEnabled: pick("aiEnabled", (v) => typeof v === "boolean"),
    ollamaUrl: pick("ollamaUrl", isString),
    ollamaModel: pick("ollamaModel", isString),
  };
}

export const useSettingsStore = defineStore("settings", () => {
  const initial = readSettings();
  const theme = ref<Theme>(initial.theme);
  const view = ref<ViewMode>(initial.view);
  const aiEnabled = ref(initial.aiEnabled);
  const ollamaUrl = ref(initial.ollamaUrl);
  const ollamaModel = ref(initial.ollamaModel);

  watch(
    [theme, view, aiEnabled, ollamaUrl, ollamaModel],
    () => {
      const value: Settings = {
        theme: theme.value,
        view: view.value,
        aiEnabled: aiEnabled.value,
        ollamaUrl: ollamaUrl.value,
        ollamaModel: ollamaModel.value,
      };
      try {
        localStorage.setItem(KEY, JSON.stringify(value));
      } catch {
        /* settings just won't persist */
      }
    },
    { flush: "sync" },
  );

  /** Cycles between split, edit-only and preview-only. */
  function togglePreview(): void {
    view.value = view.value === "split" ? "edit" : view.value === "edit" ? "preview" : "split";
  }

  function resetAi(): void {
    ollamaUrl.value = DEFAULTS.ollamaUrl;
    ollamaModel.value = DEFAULTS.ollamaModel;
  }

  return { theme, view, aiEnabled, ollamaUrl, ollamaModel, togglePreview, resetAi };
});
