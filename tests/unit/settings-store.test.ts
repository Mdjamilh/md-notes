import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it } from "vitest";
import { DEFAULTS, readSettings, useSettingsStore } from "../../src/stores/settings";

describe("settings", () => {
  beforeEach(() => {
    localStorage.clear();
    setActivePinia(createPinia());
  });

  it("starts with local AI turned off", () => {
    expect(readSettings()).toEqual(DEFAULTS);
    expect(useSettingsStore().aiEnabled).toBe(false);
    expect(DEFAULTS.ollamaUrl).toBe("http://localhost:11434");
    expect(DEFAULTS.ollamaModel).toBe("llama3.2");
  });

  it("persists changes to localStorage", () => {
    const s = useSettingsStore();
    s.theme = "dark";
    s.aiEnabled = true;
    s.ollamaModel = "qwen3";
    expect(readSettings()).toMatchObject({ theme: "dark", aiEnabled: true, ollamaModel: "qwen3" });
  });

  it("ignores corrupt or wrongly typed saved values", () => {
    localStorage.setItem("md-notes:settings", "{not json");
    expect(readSettings()).toEqual(DEFAULTS);
    localStorage.setItem("md-notes:settings", JSON.stringify({ theme: "neon", aiEnabled: "yes", ollamaUrl: " " }));
    expect(readSettings()).toEqual(DEFAULTS);
  });

  it("cycles the view mode", () => {
    const s = useSettingsStore();
    const seen = [s.view];
    for (let i = 0; i < 3; i++) {
      s.togglePreview();
      seen.push(s.view);
    }
    expect(seen).toEqual(["split", "edit", "preview", "split"]);
  });

  it("resets the AI endpoint to the defaults", () => {
    const s = useSettingsStore();
    s.ollamaUrl = "http://elsewhere:1";
    s.resetAi();
    expect(s.ollamaUrl).toBe(DEFAULTS.ollamaUrl);
  });
});
