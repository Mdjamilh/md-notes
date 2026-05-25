import { createStore, del, entries, set, setMany, type UseStore } from "idb-keyval";
import type { Note } from "./notes";

/**
 * Notes live in IndexedDB in the user's browser, one record per note keyed
 * by id. Nothing is sent to a server. The store is created lazily so tests
 * (and SSR-style imports) don't open a database at module load.
 */
let store: UseStore | null = null;

function db(): UseStore {
  store ??= createStore("md-notes", "notes");
  return store;
}

function isNote(value: unknown): value is Note {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return (
    typeof v.id === "string" &&
    typeof v.body === "string" &&
    Array.isArray(v.tags) &&
    typeof v.createdAt === "number" &&
    typeof v.updatedAt === "number"
  );
}

export async function loadNotes(): Promise<Note[]> {
  const rows = await entries<string, unknown>(db());
  // Skip anything malformed rather than failing to open the whole app.
  return rows.map(([, v]) => v).filter(isNote);
}

/** Vue reactive proxies can't be structured-cloned, so plain copies are stored. */
function plain(note: Note): Note {
  return { ...note, tags: [...note.tags] };
}

export async function saveNote(note: Note): Promise<void> {
  await set(note.id, plain(note), db());
}

export async function saveNotes(notes: readonly Note[]): Promise<void> {
  await setMany(
    notes.map((n) => [n.id, plain(n)]),
    db(),
  );
}

export async function removeNote(id: string): Promise<void> {
  await del(id, db());
}
