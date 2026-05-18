import DOMPurify from "dompurify";
import { Marked } from "marked";

const marked = new Marked({ gfm: true, breaks: false, async: false });

let hooksInstalled = false;

function installHooks(): void {
  if (hooksInstalled) return;
  hooksInstalled = true;
  // Links in notes open in a new tab and never get a handle on this window.
  DOMPurify.addHook("afterSanitizeAttributes", (node) => {
    if (node.tagName === "A" && node.hasAttribute("href")) {
      node.setAttribute("target", "_blank");
      node.setAttribute("rel", "noopener noreferrer");
    }
  });
}

/**
 * Markdown to HTML that is safe to put in v-html. Marked passes raw HTML in
 * notes straight through, so everything is run through DOMPurify: scripts,
 * event handler attributes, javascript: URLs, iframes, forms and inline
 * styles are removed. Imported files are untrusted input, so this matters
 * even for a single-user app.
 */
export function renderMarkdown(source: string): string {
  installHooks();
  const html = marked.parse(source) as string;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "button", "select", "textarea"],
    FORBID_ATTR: ["style"],
  });
}
