import { onBeforeUnmount, onMounted } from "vue";

export type ShortcutAction = "new" | "search" | "togglePreview" | "save";

type KeyLike = Pick<KeyboardEvent, "key" | "code" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey"> & {
  target: EventTarget | null;
};

function isTyping(target: EventTarget | null): boolean {
  if (!target || !(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

/**
 * Maps a key event to an app action. Ctrl+N and Ctrl+P belong to the
 * browser (new window, print) and can't be overridden reliably, so the app
 * uses Alt for those. `code` is used for Alt shortcuts because on macOS
 * Option+N produces a different `key`.
 */
export function shortcutFor(e: KeyLike): ShortcutAction | null {
  const mod = e.ctrlKey || e.metaKey;
  if (e.altKey && !mod && !e.shiftKey) {
    if (e.code === "KeyN") return "new";
    if (e.code === "KeyP") return "togglePreview";
  }
  if (mod && !e.altKey && !e.shiftKey) {
    const key = e.key.toLowerCase();
    if (key === "k") return "search";
    if (key === "s") return "save";
  }
  if (e.key === "/" && !mod && !e.altKey && !isTyping(e.target)) return "search";
  return null;
}

export function useShortcuts(handlers: Record<ShortcutAction, () => void>): void {
  const onKey = (e: KeyboardEvent) => {
    if (e.isComposing || e.repeat) return;
    const action = shortcutFor(e);
    if (!action) return;
    e.preventDefault();
    handlers[action]();
  };
  onMounted(() => window.addEventListener("keydown", onKey));
  onBeforeUnmount(() => window.removeEventListener("keydown", onKey));
}
