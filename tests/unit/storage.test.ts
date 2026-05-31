import { clear as clearStore, createStore, set } from "idb-keyval";
import { beforeEach, describe, expect, it } from "vitest";
import { reactive } from "vue";
import { createNote } from "../../src/lib/notes";
import { loadNotes, removeNote, saveNote, saveNotes } from "../../src/lib/storage";

const raw = createStore("md-notes", "notes");
const clear = () => clearStore(raw);

describe("storage", () => {
  beforeEach(clear);

  it("saves, loads and deletes notes", async () => {
    const a = createNote("# A", ["x"]);
    const b = createNote("# B");
    await saveNote(a);
    await saveNotes([b]);
    expect((await loadNotes()).map((n) => n.id).sort()).toEqual([a.id, b.id].sort());

    await removeNote(a.id);
    expect((await loadNotes()).map((n) => n.id)).toEqual([b.id]);
  });

  it("overwrites a note saved twice", async () => {
    const a = createNote("v1");
    await saveNote(a);
    await saveNote({ ...a, body: "v2" });
    const all = await loadNotes();
    expect(all).toHaveLength(1);
    expect(all[0]?.body).toBe("v2");
  });

  it("stores Vue reactive objects as plain data", async () => {
    const note = reactive(createNote("reactive", ["t"]));
    await expect(saveNote(note)).resolves.toBeUndefined();
    expect((await loadNotes())[0]).toEqual({ ...note, tags: ["t"] });
  });

  it("skips malformed records instead of failing", async () => {
    await saveNote(createNote("good"));
    await set("junk", { id: 1, body: null }, raw);
    const all = await loadNotes();
    expect(all.map((n) => n.body)).toEqual(["good"]);
  });
});
