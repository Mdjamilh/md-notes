import { describe, expect, it, vi } from "vitest";
import { createNote } from "../../src/lib/notes";
import {
  downloadNote,
  fileNameFor,
  importFiles,
  MAX_IMPORT_BYTES,
  noteFromMarkdown,
  splitFrontMatter,
  toMarkdownFile,
} from "../../src/lib/transfer";

const created = Date.parse("2026-01-02T03:04:05.000Z");
const updated = Date.parse("2026-02-03T04:05:06.000Z");

describe("export", () => {
  it("writes front matter with tags and ISO timestamps", () => {
    const note = { ...createNote("# Hello\nworld", ["a", "b"], created), updatedAt: updated };
    expect(toMarkdownFile(note)).toBe(
      "---\ntags: [a, b]\ncreated: 2026-01-02T03:04:05.000Z\nupdated: 2026-02-03T04:05:06.000Z\n---\n\n# Hello\nworld\n",
    );
  });

  it("omits the tags line for untagged notes", () => {
    expect(toMarkdownFile(createNote("x", [], created))).not.toContain("tags:");
  });

  it("builds a safe file name from the title", () => {
    expect(fileNameFor(createNote("# Crème brûlée: v2/final?"))).toBe("creme-brulee-v2-final.md");
    expect(fileNameFor(createNote(""))).toBe("untitled.md");
    expect(fileNameFor(createNote("# ???"))).toBe("note.md");
  });

  it("downloads through an object URL that is revoked afterwards", () => {
    vi.useFakeTimers();
    const create = vi.fn(() => "blob:fake");
    const revoke = vi.fn();
    Object.assign(URL, { createObjectURL: create, revokeObjectURL: revoke });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});

    downloadNote(createNote("# Trip plan"));
    expect(click).toHaveBeenCalledOnce();
    const anchor = click.mock.contexts[0] as HTMLAnchorElement;
    expect(anchor.download).toBe("trip-plan.md");
    vi.runAllTimers();
    expect(revoke).toHaveBeenCalledWith("blob:fake");
    expect(document.querySelector("a[download]")).toBeNull();
    vi.useRealTimers();
  });
});

describe("import", () => {
  it("round-trips an exported note", () => {
    const original = { ...createNote("# Hello\n\nworld", ["x", "y"], created), updatedAt: updated };
    const back = noteFromMarkdown(toMarkdownFile(original), "hello.md");
    expect(back).toMatchObject({
      body: "# Hello\n\nworld\n",
      tags: ["x", "y"],
      createdAt: created,
      updatedAt: updated,
    });
    expect(back.id).not.toBe(original.id);
  });

  it("reads YAML list tags and quoted values", () => {
    const { meta, body } = splitFrontMatter('---\ntitle: "x"\ntags:\n  - Work\n  - "deep work"\ndate: 2026-01-02\n---\nBody');
    expect(meta.tags).toEqual(["work", "deep-work"]);
    expect(meta.created).toBe(Date.parse("2026-01-02"));
    expect(body).toBe("Body");
  });

  it("leaves files without front matter untouched", () => {
    const note = noteFromMarkdown("Just text\n---\nmore", "a.md", 5);
    expect(note.body).toBe("Just text\n---\nmore");
    expect(note).toMatchObject({ tags: [], createdAt: 5, updatedAt: 5 });
  });

  it("normalizes Windows line endings and a BOM", () => {
    expect(noteFromMarkdown("\uFEFF---\r\ntags: [a]\r\n---\r\nline1\r\nline2").body).toBe("line1\nline2");
  });

  it("uses the file name as the title of an empty file", () => {
    expect(noteFromMarkdown("", "Reading list.md").body).toBe("# Reading list\n");
  });

  it("ignores invalid dates", () => {
    const note = noteFromMarkdown("---\ncreated: someday\n---\nx", "x.md", 42);
    expect(note.createdAt).toBe(42);
  });

  it("imports good files and reports bad ones", async () => {
    const files = [
      new File(["# One"], "one.md"),
      new File(["two"], "two.markdown"),
      new File(["{}"], "data.json"),
      new File([new Uint8Array(MAX_IMPORT_BYTES + 1)], "huge.md"),
    ];
    const result = await importFiles(files, 7);
    expect(result.notes.map((n) => n.body)).toEqual(["# One", "two"]);
    expect(result.errors).toEqual([
      "data.json: only .md, .markdown and .txt files can be imported",
      "huge.md: larger than 1 MB",
    ]);
  });
});
