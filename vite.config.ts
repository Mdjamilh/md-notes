import { readFileSync } from "node:fs";
import vue from "@vitejs/plugin-vue";
import { defineConfig } from "vite";

interface VercelConfig {
  headers: { source: string; headers: { key: string; value: string }[] }[];
}

/**
 * `vite preview` serves the same security headers as production (read from
 * vercel.json), so the Playwright run fails if the CSP blocks something.
 */
function productionHeaders(): Record<string, string> {
  const config = JSON.parse(readFileSync(new URL("./vercel.json", import.meta.url), "utf8")) as VercelConfig;
  const all = config.headers.find((h) => h.source === "/(.*)");
  return Object.fromEntries((all?.headers ?? []).map((h) => [h.key, h.value]));
}

export default defineConfig({
  plugins: [vue()],
  preview: { headers: productionHeaders() },
});
