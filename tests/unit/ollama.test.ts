import { describe, expect, it, vi } from "vitest";
import { buildPrompt, listModels, MAX_INPUT_CHARS, normalizeBaseUrl, OllamaError, summarize } from "../../src/lib/ollama";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

async function kindOf(p: Promise<unknown>): Promise<string> {
  try {
    await p;
    return "resolved";
  } catch (e) {
    return e instanceof OllamaError ? e.kind : `other: ${String(e)}`;
  }
}

describe("normalizeBaseUrl", () => {
  it("adds a scheme and drops trailing slashes", () => {
    expect(normalizeBaseUrl("localhost:11434")).toBe("http://localhost:11434");
    expect(normalizeBaseUrl(" http://127.0.0.1:11434/ ")).toBe("http://127.0.0.1:11434");
    expect(normalizeBaseUrl("https://box.lan/ollama//")).toBe("https://box.lan/ollama");
  });

  it("rejects non-http schemes and garbage", () => {
    expect(() => normalizeBaseUrl("javascript:alert(1)")).toThrow(OllamaError);
    expect(() => normalizeBaseUrl("file:///etc/passwd")).toThrow(/http/);
    expect(() => normalizeBaseUrl("http://")).toThrow(OllamaError);
  });
});

describe("buildPrompt", () => {
  it("wraps the note and truncates very long input", () => {
    const prompt = buildPrompt("x".repeat(MAX_INPUT_CHARS + 50));
    expect(prompt).toContain("<note>");
    expect(prompt).toContain("[truncated]");
    expect(prompt.length).toBeLessThan(MAX_INPUT_CHARS + 400);
  });
});

describe("summarize", () => {
  it("posts a non-streaming generate request and returns the text", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ response: "  - point one\n" }));
    const out = await summarize({ baseUrl: "localhost:11434/", model: "llama3.2", text: "# Note", fetchImpl });
    expect(out).toBe("- point one");

    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("http://localhost:11434/api/generate");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toMatchObject({ model: "llama3.2", stream: false });
  });

  it("reports an unreachable server instead of a raw TypeError", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    const p = summarize({ baseUrl: "http://localhost:11434", model: "m", text: "x", fetchImpl });
    await expect(p).rejects.toThrow(/Could not reach Ollama at http:\/\/localhost:11434/);
    expect(await kindOf(summarize({ baseUrl: "http://localhost:11434", model: "m", text: "x", fetchImpl }))).toBe(
      "unreachable",
    );
  });

  it("explains a missing model", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "model not found" }, 404));
    const p = summarize({ baseUrl: "http://h:1", model: "tiny", text: "x", fetchImpl });
    await expect(p).rejects.toThrow('ollama pull tiny');
  });

  it("includes the server's error message for other failures", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ error: "out of memory" }, 500));
    await expect(summarize({ baseUrl: "http://h:1", model: "m", text: "x", fetchImpl })).rejects.toThrow(
      "Ollama returned HTTP 500: out of memory",
    );
  });

  it("rejects malformed and empty responses", async () => {
    const notJson = vi.fn(async () => new Response("<html>", { status: 200 }));
    expect(await kindOf(summarize({ baseUrl: "http://h:1", model: "m", text: "x", fetchImpl: notJson }))).toBe("server");
    const empty = vi.fn(async () => jsonResponse({ response: "  " }));
    await expect(summarize({ baseUrl: "http://h:1", model: "m", text: "x", fetchImpl: empty })).rejects.toThrow(/empty/);
  });

  it("does not call the server for an empty note or a bad URL", async () => {
    const fetchImpl = vi.fn();
    expect(await kindOf(summarize({ baseUrl: "http://h:1", model: "m", text: "  ", fetchImpl }))).toBe("server");
    expect(await kindOf(summarize({ baseUrl: "ftp://h", model: "m", text: "x", fetchImpl }))).toBe("invalid-url");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("distinguishes a user cancel", async () => {
    const controller = new AbortController();
    const fetchImpl = vi.fn(async (_url: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      controller.abort();
      throw init?.signal?.reason ?? new DOMException("aborted", "AbortError");
    });
    const p = summarize({ baseUrl: "http://h:1", model: "m", text: "x", signal: controller.signal, fetchImpl });
    expect(await kindOf(p)).toBe("aborted");
  });
});

describe("listModels", () => {
  it("returns installed model names", async () => {
    const fetchImpl = vi.fn(async () => jsonResponse({ models: [{ name: "llama3.2:latest" }, { name: 3 }] }));
    expect(await listModels("http://localhost:11434", fetchImpl)).toEqual(["llama3.2:latest"]);
  });

  it("reports an unreachable server", async () => {
    const fetchImpl = vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    });
    expect(await kindOf(listModels("http://localhost:11434", fetchImpl))).toBe("unreachable");
  });
});
