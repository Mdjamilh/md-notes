import { describe, expect, it } from "vitest";
import type { Note } from "../../src/lib/notes";
import { makeSnippet, parseQuery, searchNotes } from "../../src/lib/search";

function note(id: string, body: string, tags: string[] = [], updatedAt = 0): Note {
  return { id, body, tags, createdAt: 0, updatedAt };
}

const notes = [
  note("a", "# Groceries\nmilk, eggs and bread", ["home"], 1),
  note("b", "# Meeting notes\nDiscuss the grocery budget with the team", ["work"], 3),
  note("c", "# Ideas\nA note-taking app that works offline", ["work", "ideas"], 2),
];

describe("parseQuery", () => {
  it("splits terms, lower-cases them and drops duplicates", () => {
    expect(parseQuery("  Milk milk  EGGS ")).toEqual({ terms: ["milk", "eggs"], tags: [] });
  });

  it("keeps quoted phrases together", () => {
    expect(parseQuery('"grocery budget" team').terms).toEqual(["grocery budget", "team"]);
  });

  it("tolerates an unterminated quote", () => {
    expect(parseQuery('"half open').terms).toEqual(["half open"]);
  });

  it("extracts tag filters in both syntaxes", () => {
    expect(parseQuery("tag:Work #ideas app")).toEqual({ terms: ["app"], tags: ["work", "ideas"] });
  });

  it("ignores a bare tag: prefix", () => {
    expect(parseQuery("tag: #")).toEqual({ terms: [], tags: [] });
  });
});

describe("searchNotes", () => {
  it("returns everything newest first for an empty query", () => {
    expect(searchNotes(notes, "").map((r) => r.note.id)).toEqual(["b", "c", "a"]);
  });

  it("matches title and body case-insensitively", () => {
    expect(searchNotes(notes, "GROCER").map((r) => r.note.id)).toEqual(["a", "b"]);
  });

  it("ranks a title match above a body-only match", () => {
    const [first] = searchNotes(notes, "grocer");
    expect(first.note.id).toBe("a");
    expect(first.title).toBe("Groceries");
  });

  it("requires every term to match", () => {
    expect(searchNotes(notes, "grocery team").map((r) => r.note.id)).toEqual(["b"]);
    expect(searchNotes(notes, "grocery offline")).toEqual([]);
  });

  it("filters by tag", () => {
    expect(searchNotes(notes, "tag:work").map((r) => r.note.id)).toEqual(["b", "c"]);
    expect(searchNotes(notes, "#work offline").map((r) => r.note.id)).toEqual(["c"]);
    expect(searchNotes(notes, "tag:missing")).toEqual([]);
  });

  it("treats regex characters in queries literally", () => {
    const special = [note("x", "cost (approx.) $5.00 [tbd]")];
    expect(searchNotes(special, "(approx.)")).toHaveLength(1);
    expect(searchNotes(special, "$5.00")).toHaveLength(1);
    expect(searchNotes(special, ".*")).toHaveLength(0);
  });
});

describe("makeSnippet", () => {
  it("skips the title line and flattens Markdown", () => {
    expect(makeSnippet("# Title\n\n**Bold** and `code`\n- item", [])).toBe("Bold and code item");
  });

  it("centres a long snippet on the first match", () => {
    const body = `# T\n${"filler ".repeat(40)}needle ${"tail ".repeat(40)}`;
    const snippet = makeSnippet(body, ["needle"], 60);
    expect(snippet).toContain("needle");
    expect(snippet.startsWith("…")).toBe(true);
    expect(snippet.endsWith("…")).toBe(true);
  });

  it("is empty when there is only a title", () => {
    expect(makeSnippet("# Only a title", ["x"])).toBe("");
  });
});
