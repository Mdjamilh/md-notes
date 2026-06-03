import { defineStore } from "pinia";
import { computed, ref } from "vue";
import { createNote, normalizeTags, type Note } from "../lib/notes";
import { parseQuery, searchNotes } from "../lib/search";
import { loadNotes, removeNote, saveNote, saveNotes } from "../lib/storage";
import { WELCOME_NOTE, WELCOME_TAGS } from "../lib/welcome";

export const AUTOSAVE_MS = 400;
const SEEDED_KEY = "md-notes:seeded";

export type SaveState = "idle" | "saving" | "saved" | "error";

function readFlag(key: string): boolean {
  try {
    return localStorage.getItem(key) === "1";
  } catch {
    return false;
  }
}

function writeFlag(key: string): void {
  try {
    localStorage.setItem(key, "1");
  } catch {
    /* private mode: the welcome note may show again, which is harmless */
  }
}

export const useNotesStore = defineStore("notes", () => {
  const notes = ref<Note[]>([]);
  const selectedId = ref<string | null>(null);
  const query = ref("");
  const loaded = ref(false);
  const saveState = ref<SaveState>("idle");
  const saveError = ref<string | null>(null);
  const timers = new Map<string, ReturnType<typeof setTimeout>>();

  const results = computed(() => searchNotes(notes.value, query.value));
  const parsedQuery = computed(() => parseQuery(query.value));
  const selected = computed(() => notes.value.find((n) => n.id === selectedId.value) ?? null);

  /** Every tag in use with its note count, most used first. */
  const tagCounts = computed(() => {
    const counts = new Map<string, number>();
    for (const n of notes.value) for (const t of n.tags) counts.set(t, (counts.get(t) ?? 0) + 1);
    return [...counts].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  });

  async function persist(task: () => Promise<void>): Promise<void> {
    saveState.value = "saving";
    try {
      await task();
      saveState.value = timers.size > 0 ? "saving" : "saved";
      saveError.value = null;
    } catch (err) {
      saveState.value = "error";
      saveError.value = err instanceof Error ? err.message : String(err);
    }
  }

  async function init(): Promise<void> {
    if (loaded.value) return;
    try {
      notes.value = await loadNotes();
    } catch (err) {
      saveState.value = "error";
      saveError.value = `Could not open browser storage: ${err instanceof Error ? err.message : String(err)}`;
    }
    if (notes.value.length === 0 && !readFlag(SEEDED_KEY)) {
      const welcome = createNote(WELCOME_NOTE, WELCOME_TAGS);
      notes.value.push(welcome);
      await persist(() => saveNote(welcome));
    }
    writeFlag(SEEDED_KEY);
    selectedId.value = results.value[0]?.note.id ?? null;
    loaded.value = true;
  }

  async function create(body = ""): Promise<Note> {
    const note = createNote(body);
    notes.value.unshift(note);
    selectedId.value = note.id;
    // A new note should be visible even while a search is active.
    query.value = "";
    await persist(() => saveNote(note));
    return note;
  }

  function find(id: string): Note | undefined {
    return notes.value.find((n) => n.id === id);
  }

  async function saveNow(id: string): Promise<void> {
    const timer = timers.get(id);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(id);
    const note = find(id);
    if (note) await persist(() => saveNote(note));
  }

  /** Applies an edit immediately in memory and writes it to IndexedDB after a short pause. */
  function update(id: string, patch: Partial<Pick<Note, "body" | "tags">>): void {
    const note = find(id);
    if (!note) return;
    if (patch.body !== undefined) note.body = patch.body;
    if (patch.tags !== undefined) note.tags = normalizeTags(patch.tags);
    note.updatedAt = Date.now();

    const existing = timers.get(id);
    if (existing !== undefined) clearTimeout(existing);
    saveState.value = "saving";
    timers.set(
      id,
      setTimeout(() => void saveNow(id), AUTOSAVE_MS),
    );
  }

  /** Writes every pending edit now (used for Ctrl+S and before the page hides). */
  async function flush(): Promise<void> {
    await Promise.all([...timers.keys()].map((id) => saveNow(id)));
  }

  async function remove(id: string): Promise<void> {
    const timer = timers.get(id);
    if (timer !== undefined) clearTimeout(timer);
    timers.delete(id);

    const visible = results.value.map((r) => r.note.id);
    const index = notes.value.findIndex((n) => n.id === id);
    if (index === -1) return;
    notes.value.splice(index, 1);
    if (selectedId.value === id) {
      const pos = visible.indexOf(id);
      const next = visible[pos + 1] ?? visible[pos - 1];
      selectedId.value = next && next !== id ? next : (notes.value[0]?.id ?? null);
    }
    await persist(() => removeNote(id));
  }

  async function addImported(imported: Note[]): Promise<void> {
    if (imported.length === 0) return;
    notes.value.push(...imported);
    query.value = "";
    selectedId.value = imported[0]?.id ?? selectedId.value;
    await persist(() => saveNotes(imported));
  }

  function select(id: string | null): void {
    selectedId.value = id;
  }

  /** Adds or removes a `tag:name` filter in the search box. */
  function toggleTag(tag: string): void {
    const token = `tag:${tag}`;
    const parts = query.value.split(/\s+/).filter(Boolean);
    const isThisTag = (p: string) => [token, `#${tag}`].includes(p.toLowerCase());
    query.value = (parts.some(isThisTag) ? parts.filter((p) => !isThisTag(p)) : [...parts, token]).join(" ");
  }

  return {
    notes,
    selectedId,
    query,
    loaded,
    saveState,
    saveError,
    results,
    parsedQuery,
    selected,
    tagCounts,
    init,
    create,
    update,
    flush,
    remove,
    addImported,
    select,
    toggleTag,
  };
});
