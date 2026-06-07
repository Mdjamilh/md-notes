<script setup lang="ts">
import { onBeforeUnmount, ref, watch } from "vue";
import { OllamaError, normalizeBaseUrl, summarize } from "../lib/ollama";
import { useSettingsStore } from "../stores/settings";
import MarkdownPreview from "./MarkdownPreview.vue";

const props = defineProps<{ noteId: string; text: string }>();
const emit = defineEmits<{ insert: [summary: string]; close: [] }>();
const settings = useSettingsStore();

type State = { kind: "loading" } | { kind: "done"; summary: string } | { kind: "error"; message: string };
const state = ref<State>({ kind: "loading" });
let controller: AbortController | null = null;

function endpoint(): string {
  try {
    return normalizeBaseUrl(settings.ollamaUrl);
  } catch {
    return settings.ollamaUrl;
  }
}

async function run(): Promise<void> {
  controller?.abort();
  const own = new AbortController();
  controller = own;
  state.value = { kind: "loading" };
  try {
    const summary = await summarize({
      baseUrl: settings.ollamaUrl,
      model: settings.ollamaModel,
      text: props.text,
      signal: own.signal,
    });
    if (controller === own) state.value = { kind: "done", summary };
  } catch (err) {
    if (controller !== own) return;
    if (err instanceof OllamaError && err.kind === "aborted") {
      emit("close");
      return;
    }
    state.value = { kind: "error", message: err instanceof Error ? err.message : String(err) };
  }
}

function cancel(): void {
  controller?.abort();
}

// A summary belongs to one note; switching notes discards it.
watch(
  () => props.noteId,
  () => {
    controller?.abort();
    emit("close");
  },
);

onBeforeUnmount(() => controller?.abort());
void run();
</script>

<template>
  <section class="summary" aria-label="Local AI summary" aria-live="polite">
    <header>
      <strong>Summary</strong>
      <span class="where">from {{ settings.ollamaModel }} at {{ endpoint() }} (your machine)</span>
      <button type="button" class="btn btn-ghost close" aria-label="Close summary" @click="emit('close')">&times;</button>
    </header>

    <div v-if="state.kind === 'loading'" class="body">
      <p>Asking your local model. Small models usually answer in a few seconds.</p>
      <button type="button" class="btn" @click="cancel">Cancel</button>
    </div>

    <div v-else-if="state.kind === 'error'" class="body error" role="alert">
      <p>{{ state.message }}</p>
      <button type="button" class="btn" @click="run">Try again</button>
    </div>

    <div v-else class="body">
      <MarkdownPreview :source="state.summary" />
      <div class="actions">
        <button type="button" class="btn" @click="emit('insert', state.summary)">Insert into note</button>
        <button type="button" class="btn btn-ghost" @click="run">Regenerate</button>
      </div>
    </div>
  </section>
</template>

<style scoped>
.summary {
  margin: 12px 16px 0;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
}

header {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 6px 6px 12px;
  border-bottom: 1px solid var(--border);
}

.where {
  flex: 1;
  overflow: hidden;
  font-size: 12px;
  color: var(--text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.body {
  padding: 8px 12px 12px;
}

.body p {
  margin: 0 0 8px;
}

.error p {
  color: var(--danger);
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 8px;
}
</style>
