/**
 * Optional summaries from an Ollama server the user runs on their own
 * machine. The browser calls it directly; there is no backend in between, and
 * nothing is sent unless the user turns the feature on and clicks the button.
 */

export const DEFAULT_OLLAMA_URL = "http://localhost:11434";
export const DEFAULT_MODEL = "llama3.2";
const TIMEOUT_MS = 120_000;
/** Long notes are cut so a small local model stays fast. */
export const MAX_INPUT_CHARS = 12_000;

export type OllamaErrorKind = "invalid-url" | "unreachable" | "model-missing" | "server" | "timeout" | "aborted";

export class OllamaError extends Error {
  readonly kind: OllamaErrorKind;

  constructor(kind: OllamaErrorKind, message: string) {
    super(message);
    this.kind = kind;
    this.name = "OllamaError";
  }
}

/** Accepts "localhost:11434" or a full URL; returns a clean base URL or throws. */
export function normalizeBaseUrl(input: string): string {
  const raw = input.trim();
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(raw) ? raw : `http://${raw}`;
  let url: URL;
  try {
    url = new URL(withScheme);
  } catch {
    throw new OllamaError("invalid-url", `"${input}" is not a valid URL.`);
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new OllamaError("invalid-url", "The Ollama URL must start with http:// or https://.");
  }
  return `${url.origin}${url.pathname.replace(/\/+$/, "")}`;
}

export function buildPrompt(note: string): string {
  const text = note.length > MAX_INPUT_CHARS ? `${note.slice(0, MAX_INPUT_CHARS)}\n[truncated]` : note;
  return [
    "Summarize the following Markdown note in 2 to 4 short bullet points.",
    "Reply with the bullet points only, in the language of the note.",
    "",
    "<note>",
    text,
    "</note>",
  ].join("\n");
}

interface SummarizeOptions {
  baseUrl: string;
  model: string;
  text: string;
  signal?: AbortSignal;
  fetchImpl?: typeof fetch;
}

function unreachable(baseUrl: string): OllamaError {
  return new OllamaError(
    "unreachable",
    `Could not reach Ollama at ${baseUrl}. Make sure it is running ("ollama serve") and that ` +
      "OLLAMA_ORIGINS allows this site. The public demo cannot reach your machine unless you set this up.",
  );
}

export async function summarize({ baseUrl, model, text, signal, fetchImpl = fetch }: SummarizeOptions): Promise<string> {
  const base = normalizeBaseUrl(baseUrl);
  if (!text.trim()) throw new OllamaError("server", "This note is empty, so there is nothing to summarize.");

  const timeout = AbortSignal.timeout(TIMEOUT_MS);
  const combined = signal ? AbortSignal.any([signal, timeout]) : timeout;

  let res: Response;
  try {
    res = await fetchImpl(`${base}/api/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ model: model.trim() || DEFAULT_MODEL, prompt: buildPrompt(text), stream: false }),
      signal: combined,
    });
  } catch {
    if (signal?.aborted) throw new OllamaError("aborted", "Summary cancelled.");
    if (timeout.aborted) throw new OllamaError("timeout", "Ollama took too long to answer.");
    throw unreachable(base);
  }

  if (res.status === 404) {
    throw new OllamaError(
      "model-missing",
      `Ollama does not have the model "${model}". Run "ollama pull ${model}" and try again.`,
    );
  }
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: unknown };
      if (typeof body.error === "string") detail = `: ${body.error}`;
    } catch {
      /* not JSON */
    }
    throw new OllamaError("server", `Ollama returned HTTP ${res.status}${detail}`);
  }

  let data: { response?: unknown };
  try {
    data = (await res.json()) as { response?: unknown };
  } catch {
    throw new OllamaError("server", "Ollama sent a response that is not JSON.");
  }
  if (typeof data.response !== "string" || !data.response.trim()) {
    throw new OllamaError("server", "Ollama returned an empty summary.");
  }
  return data.response.trim();
}

/** Lists installed models; used by the settings "Test connection" button. */
export async function listModels(baseUrl: string, fetchImpl: typeof fetch = fetch): Promise<string[]> {
  const base = normalizeBaseUrl(baseUrl);
  let res: Response;
  try {
    res = await fetchImpl(`${base}/api/tags`, { signal: AbortSignal.timeout(5000) });
  } catch {
    throw unreachable(base);
  }
  if (!res.ok) throw new OllamaError("server", `Ollama returned HTTP ${res.status}`);
  const data = (await res.json().catch(() => ({}))) as { models?: { name?: unknown }[] };
  return (data.models ?? []).map((m) => m.name).filter((n): n is string => typeof n === "string");
}
