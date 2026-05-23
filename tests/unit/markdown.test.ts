import { describe, expect, it } from "vitest";
import { renderMarkdown } from "../../src/lib/markdown";

/** Parses rendered HTML so assertions are about the DOM, not string shapes. */
function dom(markdown: string): HTMLElement {
  const el = document.createElement("div");
  el.innerHTML = renderMarkdown(markdown);
  return el;
}

function allAttributes(el: HTMLElement): string[] {
  return [...el.querySelectorAll("*")].flatMap((n) => [...n.attributes].map((a) => a.name));
}

describe("renderMarkdown", () => {
  it("renders common Markdown", () => {
    const el = dom("# Title\n\nSome **bold** and `code`.\n\n- one\n- two");
    expect(el.querySelector("h1")?.textContent).toBe("Title");
    expect(el.querySelector("strong")?.textContent).toBe("bold");
    expect(el.querySelectorAll("li")).toHaveLength(2);
  });

  it("renders GitHub-flavoured tables and task lists", () => {
    const el = dom("| a | b |\n|---|---|\n| 1 | 2 |\n\n- [x] done\n- [ ] todo");
    expect(el.querySelectorAll("td")).toHaveLength(2);
    const boxes = el.querySelectorAll<HTMLInputElement>("input[type=checkbox]");
    expect(boxes).toHaveLength(2);
    expect(boxes[0].checked).toBe(true);
  });
});

describe("sanitizing", () => {
  it("strips the onerror handler from <img src=x onerror=alert(1)>", () => {
    const html = renderMarkdown("<img src=x onerror=alert(1)>");
    expect(html).not.toMatch(/onerror/i);
    expect(html).not.toMatch(/alert/);
    // The harmless part of the tag survives.
    expect(dom("<img src=x onerror=alert(1)>").querySelector("img")?.getAttribute("src")).toBe("x");
  });

  it("removes script tags entirely", () => {
    const html = renderMarkdown("hello <script>alert(1)</script> world");
    expect(html).not.toMatch(/<script/i);
    expect(html).not.toContain("alert(1)");
  });

  it.each([
    ["inline handler", '<a href="#" onclick="alert(1)">x</a>'],
    ["svg onload", '<svg onload="alert(1)"><circle r="1"/></svg>'],
    ["body onload", '<body onload="alert(1)">'],
    ["details ontoggle", '<details open ontoggle="alert(1)"><summary>s</summary></details>'],
  ])("drops event handler attributes (%s)", (_name, input) => {
    const attrs = allAttributes(dom(input));
    expect(attrs.filter((a) => a.startsWith("on"))).toEqual([]);
  });

  it("neutralizes javascript: links written in Markdown and HTML", () => {
    const el = dom('[click](javascript:alert(1))\n\n<a href="javascript:alert(1)">raw</a>');
    for (const a of el.querySelectorAll("a")) {
      expect(a.getAttribute("href") ?? "").not.toMatch(/javascript:/i);
    }
  });

  it("removes iframes, forms, styles and inline style attributes", () => {
    const el = dom(
      '<iframe src="https://evil.example"></iframe><form action="/x"><input name="p"></form>' +
        '<style>body{display:none}</style><p style="position:fixed">styled</p>',
    );
    expect(el.querySelector("iframe, form, style")).toBeNull();
    expect(el.querySelector("p")?.hasAttribute("style")).toBe(false);
  });

  it("opens links in a new tab without an opener", () => {
    const a = dom("[site](https://example.com)").querySelector("a");
    expect(a?.getAttribute("href")).toBe("https://example.com");
    expect(a?.getAttribute("target")).toBe("_blank");
    expect(a?.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("keeps code blocks as text", () => {
    const el = dom("```html\n<img src=x onerror=alert(1)>\n```");
    expect(el.querySelector("code")?.textContent).toContain("<img src=x onerror=alert(1)>");
    expect(el.querySelector("img")).toBeNull();
  });
});
