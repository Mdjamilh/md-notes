import { describe, expect, it } from "vitest";
import { createNote, deriveTitle, normalizeTags, parseTagInput, UNTITLED } from "../../src/lib/notes";

describe("deriveTitle", () => {
  it("uses the first non-empty line without heading markers", () => {
    expect(deriveTitle("\n\n# Shopping list\n- milk")).toBe("Shopping list");
  });

  it("strips list, quote and emphasis markers", () => {
    expect(deriveTitle("- **Buy** _milk_")).toBe("Buy milk");
    expect(deriveTitle("> a quote")).toBe("a quote");
    expect(deriveTitle("1. first")).toBe("first");
  });

  it("falls back to a placeholder for empty notes", () => {
    expect(deriveTitle("   \n  ")).toBe(UNTITLED);
    expect(deriveTitle("#")).toBe("#");
  });

  it("truncates very long titles", () => {
    const title = deriveTitle("a".repeat(200));
    expect(title).toHaveLength(80);
    expect(title.endsWith("…")).toBe(true);
  });
});

describe("tags", () => {
  it("normalizes case, whitespace, hashes and duplicates", () => {
    expect(normalizeTags([" Work ", "#ideas", "work", "", "deep work"])).toEqual([
      "work",
      "ideas",
      "deep-work",
    ]);
  });

  it("parses comma or space separated input", () => {
    expect(parseTagInput("work, #ideas later,,")).toEqual(["work", "ideas", "later"]);
  });
});

describe("createNote", () => {
  it("creates a note with unique ids and equal timestamps", () => {
    const a = createNote("hi", ["X"], 1000);
    const b = createNote();
    expect(a).toMatchObject({ body: "hi", tags: ["x"], createdAt: 1000, updatedAt: 1000 });
    expect(a.id).not.toBe(b.id);
  });
});
