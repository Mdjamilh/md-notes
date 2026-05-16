export interface Segment {
  text: string;
  match: boolean;
}

export function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits text into matched and unmatched segments so the UI can wrap matches
 * in <mark> through normal template rendering. Nothing here produces HTML,
 * which keeps highlighting immune to injection from note content.
 */
export function highlight(text: string, terms: readonly string[]): Segment[] {
  const clean = [...new Set(terms.map((t) => t.trim()).filter(Boolean))];
  if (!text) return [];
  if (clean.length === 0) return [{ text, match: false }];

  // Longest first so "notebook" wins over "note" when both are terms.
  clean.sort((a, b) => b.length - a.length);
  const re = new RegExp(clean.map(escapeRegExp).join("|"), "giu");

  const segments: Segment[] = [];
  let last = 0;
  for (const m of text.matchAll(re)) {
    const start = m.index;
    if (start > last) segments.push({ text: text.slice(last, start), match: false });
    segments.push({ text: m[0], match: true });
    last = start + m[0].length;
  }
  if (last < text.length) segments.push({ text: text.slice(last), match: false });
  return segments;
}
