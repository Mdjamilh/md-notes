import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";
import { shortcutFor, useShortcuts } from "../../src/composables/useShortcuts";

const base = { key: "", code: "", altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: null };

describe("shortcutFor", () => {
  it("maps Alt+N and Alt+P by physical key", () => {
    expect(shortcutFor({ ...base, key: "n", code: "KeyN", altKey: true })).toBe("new");
    // macOS Option+N yields a dead key, so `code` is what counts.
    expect(shortcutFor({ ...base, key: "Dead", code: "KeyN", altKey: true })).toBe("new");
    expect(shortcutFor({ ...base, key: "p", code: "KeyP", altKey: true })).toBe("togglePreview");
  });

  it("maps Ctrl or Cmd with K and S", () => {
    expect(shortcutFor({ ...base, key: "k", ctrlKey: true })).toBe("search");
    expect(shortcutFor({ ...base, key: "K", metaKey: true })).toBe("search");
    expect(shortcutFor({ ...base, key: "s", ctrlKey: true })).toBe("save");
  });

  it("uses / for search only when not typing", () => {
    expect(shortcutFor({ ...base, key: "/", target: document.body })).toBe("search");
    const textarea = document.createElement("textarea");
    expect(shortcutFor({ ...base, key: "/", target: textarea })).toBeNull();
  });

  it("ignores plain keys and other combinations", () => {
    expect(shortcutFor({ ...base, key: "n", code: "KeyN" })).toBeNull();
    expect(shortcutFor({ ...base, key: "n", code: "KeyN", ctrlKey: true })).toBeNull();
    expect(shortcutFor({ ...base, key: "s", ctrlKey: true, shiftKey: true })).toBeNull();
    expect(shortcutFor({ ...base, code: "KeyN", altKey: true, ctrlKey: true })).toBeNull();
  });
});

describe("useShortcuts", () => {
  it("calls the handler, prevents the default and cleans up on unmount", () => {
    const handlers = { new: vi.fn(), search: vi.fn(), togglePreview: vi.fn(), save: vi.fn() };
    const Host = defineComponent({
      setup() {
        useShortcuts(handlers);
        return () => h("div");
      },
    });
    const wrapper = mount(Host, { attachTo: document.body });

    const event = new KeyboardEvent("keydown", { key: "s", ctrlKey: true, cancelable: true });
    window.dispatchEvent(event);
    expect(handlers.save).toHaveBeenCalledOnce();
    expect(event.defaultPrevented).toBe(true);

    window.dispatchEvent(new KeyboardEvent("keydown", { key: "s", ctrlKey: true, repeat: true }));
    expect(handlers.save).toHaveBeenCalledOnce();

    wrapper.unmount();
    window.dispatchEvent(new KeyboardEvent("keydown", { key: "k", ctrlKey: true }));
    expect(handlers.search).not.toHaveBeenCalled();
  });
});
