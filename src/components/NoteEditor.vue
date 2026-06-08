<script setup lang="ts">
import { computed, ref, watch } from "vue";
import { useMediaQuery } from "../composables/useMediaQuery";
import { deriveTitle, type Note } from "../lib/notes";
import { downloadNote } from "../lib/transfer";
import { useNotesStore } from "../stores/notes";
import { useSettingsStore, type ViewMode } from "../stores/settings";
import MarkdownPreview from "./MarkdownPreview.vue";
import SummaryPanel from "./SummaryPanel.vue";
import TagEditor from "./TagEditor.vue";

const props = defineProps<{ note: Note }>();
const emit = defineEmits<{ back: []; openSettings: [] }>();
const store = useNotesStore();
const settings = useSettingsStore();
const textarea = ref<HTMLTextAreaElement | null>(null);
const showSummary = ref(false);

/** Narrow screens have room for one pane, so "split" becomes a toggle. */
const narrow = useMediaQuery("(max-width: 760px)");
const mobilePane = ref<"edit" | "preview">("edit");

const view = computed<ViewMode>(() => (narrow.value && settings.view === "split" ? mobilePane.value : settings.view));
const modes: { value: ViewMode; label: string }[] = [
  { value: "edit", label: "Edit" },
  { value: "split", label: "Split" },
  { value: "preview", label: "Preview" },
];

const body = computed({
  get: () => props.note.body,
  set: (value: string) => store.update(props.note.id, { body: value }),
});

const title = computed(() => deriveTitle(props.note.body));

const saveLabel = computed(() => {
  switch (store.saveState) {
    case "saving":
      return "Saving…";
    case "saved":
      return "Saved";
    case "error":
      return "Not saved";
    default:
      return "";
  }
});

watch(
  () => props.note.id,
  () => {
    showSummary.value = false;
  },
);

function togglePreview(): void {
  if (narrow.value && settings.view === "split") {
    mobilePane.value = mobilePane.value === "edit" ? "preview" : "edit";
  } else {
    settings.togglePreview();
  }
}

async function remove(): Promise<void> {
  if (window.confirm(`Delete "${title.value}"? This cannot be undone.`)) await store.remove(props.note.id);
}

function insertSummary(summary: string): void {
  const sep = props.note.body.endsWith("\n") ? "\n" : "\n\n";
  store.update(props.note.id, { body: `${props.note.body}${sep}## Summary\n\n${summary}\n` });
  showSummary.value = false;
}

defineExpose({ togglePreview, focus: () => textarea.value?.focus() });
</script>

<template>
  <section class="editor" :aria-label="`Editing ${title}`">
    <div class="toolbar">
      <button type="button" class="btn btn-ghost back" @click="emit('back')">&larr; Notes</button>

      <div v-if="!narrow" class="segmented" role="group" aria-label="View">
        <button
          v-for="m in modes"
          :key="m.value"
          type="button"
          :aria-pressed="settings.view === m.value"
          @click="settings.view = m.value"
        >
          {{ m.label }}
        </button>
      </div>
      <button v-else type="button" class="btn" :aria-pressed="view === 'preview'" @click="togglePreview">
        {{ view === "preview" ? "Edit" : "Preview" }}
      </button>

      <span class="status" :class="store.saveState" role="status" :title="store.saveError ?? undefined">{{ saveLabel }}</span>

      <div class="actions">
        <button
          v-if="settings.aiEnabled"
          type="button"
          class="btn"
          :disabled="!note.body.trim()"
          title="Sends this note to the Ollama server on your own computer"
          @click="showSummary = true"
        >
          Summarize (local)
        </button>
        <button type="button" class="btn" title="Download as a .md file" @click="downloadNote(note)">Export</button>
        <button type="button" class="btn btn-danger" @click="remove">Delete</button>
      </div>
    </div>

    <p v-if="store.saveState === 'error'" class="save-error" role="alert">
      Changes could not be saved to browser storage: {{ store.saveError }}. Export the note to keep a copy.
    </p>

    <SummaryPanel
      v-if="showSummary"
      :note-id="note.id"
      :text="note.body"
      @insert="insertSummary"
      @close="showSummary = false"
    />

    <div class="panes" :class="`view-${view}`">
      <div v-show="view !== 'preview'" class="pane">
        <label for="editor" class="visually-hidden">Markdown</label>
        <textarea
          id="editor"
          ref="textarea"
          v-model="body"
          class="source"
          spellcheck="true"
          placeholder="Start writing Markdown. The first line becomes the title."
        ></textarea>
      </div>
      <div v-show="view !== 'edit'" class="pane preview" data-testid="preview">
        <MarkdownPreview v-if="note.body.trim()" :source="note.body" />
        <p v-else class="placeholder">Nothing to preview yet.</p>
      </div>
    </div>

    <TagEditor :tags="note.tags" @change="(tags) => store.update(note.id, { tags })" />
  </section>
</template>

<style scoped>
.editor {
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
  flex-wrap: wrap;
}

.back {
  display: none;
}

.segmented {
  display: inline-flex;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}

.segmented button {
  padding: 4px 12px;
  border: 0;
  background: var(--surface);
  cursor: pointer;
}

.segmented button + button {
  border-left: 1px solid var(--border);
}

.segmented button[aria-pressed="true"] {
  background: var(--accent-soft);
  font-weight: 600;
}

.status {
  font-size: 12px;
  color: var(--text-muted);
  min-width: 60px;
}

.status.error {
  color: var(--danger);
  font-weight: 600;
}

.actions {
  display: flex;
  gap: 8px;
  margin-left: auto;
}

.save-error {
  margin: 8px 16px 0;
  padding: 8px 12px;
  border-radius: var(--radius);
  background: var(--warning-bg);
  color: var(--warning-text);
}

.panes {
  flex: 1;
  display: grid;
  min-height: 0;
}

.view-split {
  grid-template-columns: 1fr 1fr;
}

.pane {
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

.view-split .pane + .pane {
  border-left: 1px solid var(--border);
}

.source {
  display: block;
  width: 100%;
  height: 100%;
  padding: 20px 24px;
  border: 0;
  resize: none;
  background: var(--bg);
  font: 14px/1.6 var(--font-mono);
  tab-size: 2;
}

.source:focus-visible {
  outline: none;
}

.preview {
  padding: 20px 28px;
  background: var(--surface);
}

.placeholder {
  color: var(--text-muted);
}

@media (max-width: 760px) {
  .back {
    display: inline-flex;
    padding-left: 4px;
  }

  .toolbar {
    padding: 6px 10px;
  }

  .actions {
    flex-wrap: wrap;
  }

  .source,
  .preview {
    padding: 14px 16px;
  }
}
</style>
