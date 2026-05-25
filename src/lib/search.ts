import { deriveTitle, type Note } from "./notes";

export interface ParsedQuery {
  /** Free-text terms; every one must match somewhere in the note. */
  terms: string[];
  /** `tag:foo` filters; every one must be on the note. */
  tags: string[];
}

export interface SearchResult {
  note: Note;
  title: string;
  snippet: string;
  score: number;
}

/**
 * Splits a query into terms. Double quotes group a phrase ("next week"), and
 * `tag:name` (or `#name`) filters by tag instead of searching text.
 */
export function parseQuery(query: string): ParsedQuery {
  const terms: string[] = [];
  const tags: string[] = [];
  const re = /"([^"]*)"?|(\S+)/g;
  for (const m of query.matchAll(re)) {
    const phrase = m[1];
    if (phrase !== undefined) {
      const t = phrase.trim().toLowerCase();
      if (t) terms.push(t);
      continue;
    }
    const word = (m[2] ?? "").toLowerCase();
    const tag = /^(?:tag:|#)(.+)$/.exec(word);
    if (tag?.[1]) tags.push(tag[1]);
    else if (word !== "tag:" && word !== "#") terms.push(word);
  }
  return { terms: unique(terms), tags: unique(tags) };
}

function unique(xs: string[]): string[] {
  return [...new Set(xs)];
}

function countOccurrences(haystack: string, needle: string): number {
  let count = 0;
  let i = haystack.indexOf(needle);
  while (i !== -1) {
    count++;
    i = haystack.indexOf(needle, i + needle.length);
  }
  return count;
}

/**
 * Filters and ranks notes. Matching is case-insensitive substring search with
 * AND semantics: a note must contain every term. Title hits outrank tag hits,
 * which outrank body hits; ties go to the most recently edited note.
 */
export function searchNotes(notes: readonly Note[], query: string): SearchResult[] {
  const { terms, tags } = parseQuery(query);
  const results: SearchResult[] = [];

  for (const note of notes) {
    if (!tags.every((t) => note.tags.includes(t))) continue;
    const title = deriveTitle(note.body);
    const lowTitle = title.toLowerCase();
    const lowBody = note.body.toLowerCase();

    let score = 0;
    let matchedAll = true;
    for (const term of terms) {
      const inTitle = lowTitle.includes(term);
      const inTags = note.tags.some((t) => t.includes(term));
      const bodyHits = countOccurrences(lowBody, term);
      if (!inTitle && !inTags && bodyHits === 0) {
        matchedAll = false;
        break;
      }
      score += (inTitle ? 10 : 0) + (inTags ? 5 : 0) + Math.min(bodyHits, 5);
    }
    if (!matchedAll) continue;

    results.push({ note, title, snippet: makeSnippet(note.body, terms), score });
  }

  return results.sort((a, b) => b.score - a.score || b.note.updatedAt - a.note.updatedAt);
}

/**
 * A short one-line excerpt of the body. With search terms, the excerpt is
 * centred on the first match so the highlight is visible in the list.
 */
export function makeSnippet(body: string, terms: readonly string[], length = 120): string {
  const lines = body.split("\n");
  const firstContent = lines.findIndex((l) => l.trim() !== "");
  // Skip the line used as the title so the snippet adds information.
  const rest = lines.slice(firstContent + 1).join(" ");
  const flat = rest
    .replace(/[#>*_`~[\]()|-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!flat) return "";

  const low = flat.toLowerCase();
  let hit = -1;
  for (const term of terms) {
    const i = low.indexOf(term);
    if (i !== -1 && (hit === -1 || i < hit)) hit = i;
  }
  if (hit === -1 || flat.length <= length) {
    return flat.length > length ? `${flat.slice(0, length).trimEnd()}…` : flat;
  }

  const start = Math.max(0, hit - Math.floor(length / 3));
  const end = Math.min(flat.length, start + length);
  return `${start > 0 ? "…" : ""}${flat.slice(start, end).trim()}${end < flat.length ? "…" : ""}`;
}
