export interface Note {
  id: string;
  /** Raw Markdown. The title is derived from it, so there is one source of truth. */
  body: string;
  tags: string[];
  createdAt: number;
  updatedAt: number;
}

export const UNTITLED = "Untitled note";

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createNote(body = "", tags: string[] = [], now = Date.now()): Note {
  return { id: newId(), body, tags: normalizeTags(tags), createdAt: now, updatedAt: now };
}

/**
 * The title is the first non-empty line with Markdown heading, emphasis and
 * list markers stripped, so "# Shopping list" shows as "Shopping list".
 */
export function deriveTitle(body: string): string {
  for (const raw of body.split("\n")) {
    const line = raw
      .replace(/^\s{0,3}(#{1,6}\s+|>\s*|[-*+]\s+|\d+[.)]\s+)/, "")
      .replace(/[*_`~]+/g, "")
      .trim();
    if (line) return line.length > 80 ? `${line.slice(0, 79)}…` : line;
  }
  return UNTITLED;
}

/** Lower-cases, trims, strips a leading "#", drops empties and duplicates. */
export function normalizeTags(tags: Iterable<string>): string[] {
  const out = new Set<string>();
  for (const t of tags) {
    const clean = t.trim().replace(/^#+/, "").toLowerCase().replace(/\s+/g, "-");
    if (clean) out.add(clean);
  }
  return [...out];
}

/** Parses "work, ideas #later" style input into tags. */
export function parseTagInput(input: string): string[] {
  return normalizeTags(input.split(/[,\s]+/));
}
