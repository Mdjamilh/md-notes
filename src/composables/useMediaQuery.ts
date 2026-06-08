import { onBeforeUnmount, ref, type Ref } from "vue";

/** Reactive `matchMedia`; false where the API is missing (tests, old browsers). */
export function useMediaQuery(query: string): Ref<boolean> {
  const matches = ref(false);
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return matches;
  const mql = window.matchMedia(query);
  matches.value = mql.matches;
  const onChange = (e: MediaQueryListEvent) => (matches.value = e.matches);
  mql.addEventListener("change", onChange);
  onBeforeUnmount(() => mql.removeEventListener("change", onChange));
  return matches;
}
