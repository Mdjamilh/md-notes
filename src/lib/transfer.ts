import { createNote, deriveTitle, normalizeTags, type Note, UNTITLED } from "./notes";

/** Anything larger is almost certainly not a hand-written note. */
export const MAX_IMPORT_BYTES = 1024 * 1024;
const ACCEPTED = /\.(md|markdown|txt)$/i;

/**
 * Serializes a note as Markdown with a small YAML front matter block holding
 * tags and timestamps, the convention Obsidian, Jekyll and Hugo all read.
 */
export function toMarkdownFile(note: Note): string {
  const lines = ["---"];
  if (note.tags.length) lines.push(`tags: [${note.tags.join(", ")}]`);
  lines.push(`created: ${new Date(note.createdAt).toISOString()}`);
  lines.push(`updated: ${new Date(note.updatedAt).toISOString()}`);
  lines.push("---");
  const body = note.body.endsWith("\n") ? note.body : `${note.body}\n`;
  return `${lines.join("\n")}\n\n${body}`;
}

export function fileNameFor(note: Note): string {
  const title = deriveTitle(note.body);
  const slug = (title === UNTITLED ? "untitled" : title)
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return `${slug || "note"}.md`;
}

interface FrontMatter {
  tags: string[];
  created?: number;
  updated?: number;
}

function parseDate(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const t = Date.parse(value.trim().replace(/^["']|["']$/g, ""));
  return Number.isNaN(t) ? undefined : t;
}

function parseTagValue(value: string): string[] {
  const inner = value.trim().replace(/^\[|\]$/g, "");
  return inner
    .split(",")
    .map((t) => t.trim().replace(/^["']|["']$/g, ""))
    .filter(Boolean);
}

/** Splits leading front matter from the body. Only the keys we use are read. */
export function splitFrontMatter(text: string): { meta: FrontMatter; body: string } {
  const meta: FrontMatter = { tags: [] };
  const m = /^---\n([\s\S]*?)\n---[ \t]*(?:\n|$)/.exec(text);
  if (!m) return { meta, body: text };

  const fields = new Map<string, string>();
  let listKey: string | null = null;
  const lists = new Map<string, string[]>();
  for (const line of m[1].split("\n")) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && listKey) {
      lists.get(listKey)?.push(item[1]);
      continue;
    }
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    const key = kv[1].toLowerCase();
    listKey = kv[2] === "" ? key : null;
    if (listKey) lists.set(key, []);
    else fields.set(key, kv[2]);
  }

  const tagList = lists.get("tags");
  const rawTags = tagList ?? (fields.has("tags") ? parseTagValue(fields.get("tags") ?? "") : []);
  meta.tags = normalizeTags(rawTags.map((t) => t.replace(/^["']|["']$/g, "")));
  meta.created = parseDate(fields.get("created") ?? fields.get("date"));
  meta.updated = parseDate(fields.get("updated") ?? fields.get("modified"));
  return { meta, body: text.slice(m[0].length).replace(/^\n+/, "") };
}

/** Turns the text of an imported file into a new note (with a fresh id). */
export function noteFromMarkdown(text: string, fileName = "", now = Date.now()): Note {
  const normalized = text.replace(/^﻿/, "").replace(/\r\n?/g, "\n");
  const { meta, body } = splitFrontMatter(normalized);
  const fallbackTitle = fileName.replace(ACCEPTED, "").trim();
  const finalBody = body.trim() === "" && fallbackTitle ? `# ${fallbackTitle}\n` : body;
  const note = createNote(finalBody, meta.tags, now);
  note.createdAt = meta.created ?? now;
  note.updatedAt = meta.updated ?? meta.created ?? now;
  return note;
}

export interface ImportResult {
  notes: Note[];
  errors: string[];
}

/** Reads user-picked files. Bad files are reported, not thrown, so one bad file doesn't block the rest. */
export async function importFiles(files: Iterable<File>, now = Date.now()): Promise<ImportResult> {
  const result: ImportResult = { notes: [], errors: [] };
  for (const file of files) {
    if (!ACCEPTED.test(file.name)) {
      result.errors.push(`${file.name}: only .md, .markdown and .txt files can be imported`);
      continue;
    }
    if (file.size > MAX_IMPORT_BYTES) {
      result.errors.push(`${file.name}: larger than 1 MB`);
      continue;
    }
    try {
      result.notes.push(noteFromMarkdown(await file.text(), file.name, now));
    } catch {
      result.errors.push(`${file.name}: could not be read`);
    }
  }
  return result;
}

/** Saves a note through a temporary object URL; nothing leaves the browser. */
export function downloadNote(note: Note): void {
  const blob = new Blob([toMarkdownFile(note)], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileNameFor(note);
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
