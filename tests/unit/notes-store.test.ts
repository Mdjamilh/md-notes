import { clear, createStore } from "idb-keyval";
import { createPinia, setActivePinia } from "pinia";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createNote } from "../../src/lib/notes";
import { loadNotes, saveNote } from "../../src/lib/storage";
import { AUTOSAVE_MS, useNotesStore } from "../../src/stores/notes";

const raw = createStore("md-notes", "notes");

async function freshStore() {
  setActivePinia(createPinia());
  const store = useNotesStore();
  await store.init();
  return store;
}

describe("notes store", () => {
  beforeEach(async () => {
    await clear(raw);
    localStorage.clear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("seeds a welcome note on the very first visit only", async () => {
    const first = await freshStore();
    expect(first.notes).toHaveLength(1);
    expect(first.selected?.body).toContain("Welcome to md-notes");

    await first.remove(first.notes[0]!.id);
    const second = await freshStore();
    expect(second.notes).toHaveLength(0);
    expect(second.selected).toBeNull();
  });

  it("loads existing notes and selects the newest", async () => {
    localStorage.setItem("md-notes:seeded", "1");
    await saveNote({ ...createNote("# Old"), updatedAt: 1 });
    await saveNote({ ...createNote("# New"), updatedAt: 2 });
    const store = await freshStore();
    expect(store.results.map((r) => r.title)).toEqual(["New", "Old"]);
    expect(store.selected?.body).toBe("# New");
  });

  it("creates a note, selects it and clears the search", async () => {
    const store = await freshStore();
    store.query = "welcome";
    const note = await store.create();
    expect(store.selectedId).toBe(note.id);
    expect(store.query).toBe("");
    expect((await loadNotes()).some((n) => n.id === note.id)).toBe(true);
  });

  it("autosaves edits after a pause, coalescing keystrokes", async () => {
    const store = await freshStore();
    const note = await store.create();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });

    store.update(note.id, { body: "# D" });
    store.update(note.id, { body: "# Draft" });
    expect(store.saveState).toBe("saving");
    expect((await loadNotes()).find((n) => n.id === note.id)?.body).toBe("");

    await vi.advanceTimersByTimeAsync(AUTOSAVE_MS + 10);
    vi.useRealTimers();
    await vi.waitFor(async () => {
      expect((await loadNotes()).find((n) => n.id === note.id)?.body).toBe("# Draft");
    });
    expect(store.saveState).toBe("saved");
  });

  it("flush writes pending edits immediately", async () => {
    const store = await freshStore();
    const note = await store.create();
    store.update(note.id, { body: "flushed", tags: ["A", "a", "b"] });
    await store.flush();
    expect((await loadNotes()).find((n) => n.id === note.id)).toMatchObject({ body: "flushed", tags: ["a", "b"] });
  });

  it("bumps updatedAt on edit so the note moves to the top", async () => {
    const store = await freshStore();
    const a = await store.create("# A");
    await store.create("# B");
    a.updatedAt = 0;
    store.update(a.id, { body: "# A2" });
    expect(store.results[0]?.note.id).toBe(a.id);
    await store.flush();
  });

  it("deletes a note, cancels its pending save and selects a neighbour", async () => {
    const store = await freshStore();
    const a = await store.create("# A");
    const b = await store.create("# B");
    store.update(b.id, { body: "# B edited" });
    await store.remove(b.id);
    expect(store.selectedId).toBe(a.id);
    await new Promise((r) => setTimeout(r, AUTOSAVE_MS + 50));
    expect((await loadNotes()).some((n) => n.id === b.id)).toBe(false);
  });

  it("searches through the query and exposes the parsed terms", async () => {
    const store = await freshStore();
    await store.create("# Recipes\npasta");
    store.query = "PASTA";
    expect(store.results.map((r) => r.title)).toEqual(["Recipes"]);
    expect(store.parsedQuery.terms).toEqual(["pasta"]);
  });

  it("counts tags and toggles tag filters in the query", async () => {
    const store = await freshStore();
    const n = await store.create("# Tagged");
    store.update(n.id, { tags: ["work", "getting-started"] });
    expect(store.tagCounts).toEqual([
      ["getting-started", 2],
      ["work", 1],
    ]);

    store.query = "foo";
    store.toggleTag("work");
    expect(store.query).toBe("foo tag:work");
    expect(store.results).toHaveLength(0);
    store.toggleTag("work");
    expect(store.query).toBe("foo");
    await store.flush();
  });

  it("adds imported notes and selects the first", async () => {
    const store = await freshStore();
    const imported = [createNote("# One"), createNote("# Two")];
    await store.addImported(imported);
    expect(store.selectedId).toBe(imported[0]!.id);
    expect(await loadNotes()).toHaveLength(3);
  });

  it("reports storage failures instead of throwing", async () => {
    const store = await freshStore();
    const note = await store.create();
    const spy = vi.spyOn(IDBObjectStore.prototype, "put").mockImplementation(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    store.update(note.id, { body: "too big" });
    await store.flush();
    expect(store.saveState).toBe("error");
    expect(store.saveError).toMatch(/Quota/);
    spy.mockRestore();
  });
});
