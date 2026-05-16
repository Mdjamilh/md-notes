import { describe, expect, it } from "vitest";
import { escapeRegExp, highlight } from "../../src/lib/highlight";

const marked = (text: string, terms: string[]) =>
  highlight(text, terms)
    .map((s) => (s.match ? `[${s.text}]` : s.text))
    .join("");

describe("highlight", () => {
  it("marks every case-insensitive occurrence and keeps original casing", () => {
    expect(marked("Note, note, NOTE", ["note"])).toBe("[Note], [note], [NOTE]");
  });

  it("returns a single unmatched segment without terms", () => {
    expect(highlight("plain", [])).toEqual([{ text: "plain", match: false }]);
    expect(highlight("plain", ["  "])).toEqual([{ text: "plain", match: false }]);
  });

  it("returns nothing for empty text", () => {
    expect(highlight("", ["a"])).toEqual([]);
  });

  it("prefers the longest overlapping term", () => {
    expect(marked("notebook", ["note", "notebook"])).toBe("[notebook]");
  });

  it("handles several terms and regex characters literally", () => {
    expect(marked("a+b = (c) and a.b", ["a+b", "(c)", "a.b"])).toBe("[a+b] = [(c)] and [a.b]");
    expect(marked("axb", ["a.b"])).toBe("axb");
  });

  it("never turns text into markup", () => {
    const segments = highlight("<img src=x onerror=alert(1)>", ["img"]);
    expect(segments.map((s) => s.text).join("")).toBe("<img src=x onerror=alert(1)>");
  });

  it("works with non-ASCII text", () => {
    expect(marked("Crème brûlée", ["brûlée"])).toBe("Crème [brûlée]");
  });
});

describe("escapeRegExp", () => {
  it("escapes every special character", () => {
    const special = ".*+?^${}()|[]\\";
    expect(new RegExp(escapeRegExp(special)).test(special)).toBe(true);
  });
});
