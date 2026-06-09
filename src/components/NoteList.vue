<script setup lang="ts">
import { ref } from "vue";
import { useNotesStore } from "../stores/notes";
import HighlightedText from "./HighlightedText.vue";

const emit = defineEmits<{ open: [id: string]; import: [files: File[]] }>();
const store = useNotesStore();
const searchInput = ref<HTMLInputElement | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium" });
const timeFormat = new Intl.DateTimeFormat(undefined, { timeStyle: "short" });

function when(ts: number): string {
  const d = new Date(ts);
  return d.toDateString() === new Date().toDateString() ? timeFormat.format(d) : dateFormat.format(d);
}

function onFiles(e: Event): void {
  const input = e.target as HTMLInputElement;
  const files = [...(input.files ?? [])];
  input.value = ""; // allow picking the same file again
  if (files.length) emit("import", files);
}

function isActiveTag(tag: string): boolean {
  return store.parsedQuery.tags.includes(tag);
}

defineExpose({
  focusSearch: () => {
    searchInput.value?.focus();
    searchInput.value?.select();
  },
});
</script>

<template>
  <aside class="sidebar" aria-label="Notes">
    <div class="search">
      <label for="search" class="visually-hidden">Search notes</label>
      <input
        id="search"
        ref="searchInput"
        v-model="store.query"
        class="input"
        type="search"
        placeholder="Search notes"
        autocomplete="off"
        spellcheck="false"
        @keydown.esc="store.query = ''"
      />
    </div>

    <div v-if="store.tagCounts.length" class="tags" role="group" aria-label="Filter by tag">
      <button
        v-for="[tag, count] in store.tagCounts"
        :key="tag"
        type="button"
        class="tag"
        :class="{ active: isActiveTag(tag) }"
        :aria-pressed="isActiveTag(tag)"
        @click="store.toggleTag(tag)"
      >
        #{{ tag }} <span class="count">{{ count }}</span>
      </button>
    </div>

    <p class="summary" aria-live="polite">
      <template v-if="store.query.trim()">{{ store.results.length }} of {{ store.notes.length }} notes match</template>
      <template v-else>{{ store.notes.length }} {{ store.notes.length === 1 ? "note" : "notes" }}</template>
    </p>

    <ul class="list">
      <li v-for="r in store.results" :key="r.note.id">
        <button
          type="button"
          class="item"
          :class="{ selected: r.note.id === store.selectedId }"
          :aria-current="r.note.id === store.selectedId ? 'true' : undefined"
          @click="emit('open', r.note.id)"
        >
          <span class="title"><HighlightedText :text="r.title" :terms="store.parsedQuery.terms" /></span>
          <span v-if="r.snippet" class="snippet"><HighlightedText :text="r.snippet" :terms="store.parsedQuery.terms" /></span>
          <span class="meta">
            <time :datetime="new Date(r.note.updatedAt).toISOString()">{{ when(r.note.updatedAt) }}</time>
            <span v-for="t in r.note.tags" :key="t" class="meta-tag">#{{ t }}</span>
          </span>
        </button>
      </li>
    </ul>

    <p v-if="store.loaded && store.results.length === 0" class="empty">
      <template v-if="store.notes.length">No notes match "{{ store.query.trim() }}".</template>
      <template v-else>No notes yet. Create one or import a .md file.</template>
    </p>

    <div class="footer">
      <button type="button" class="btn" @click="fileInput?.click()">Import .md</button>
      <input
        ref="fileInput"
        class="visually-hidden"
        type="file"
        accept=".md,.markdown,.txt,text/markdown,text/plain"
        multiple
        tabindex="-1"
        aria-hidden="true"
        data-testid="import-input"
        @change="onFiles"
      />
    </div>
  </aside>
</template>

<style scoped>
.sidebar {
  display: flex;
  flex-direction: column;
  min-height: 0;
  border-right: 1px solid var(--border);
  background: var(--surface);
}

.search {
  padding: 12px 12px 8px;
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 12px 8px;
}

.tag {
  padding: 2px 8px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--surface);
  font-size: 13px;
  cursor: pointer;
}

.tag.active {
  background: var(--accent-soft);
  border-color: var(--accent);
}

.count {
  color: var(--text-muted);
}

.summary {
  margin: 0;
  padding: 0 14px 6px;
  font-size: 12px;
  color: var(--text-muted);
}

.list {
  flex: 1;
  min-height: 0;
  margin: 0;
  padding: 0 6px;
  overflow-y: auto;
  list-style: none;
}

.item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  width: 100%;
  padding: 8px 10px;
  border: 0;
  border-radius: var(--radius);
  background: transparent;
  text-align: left;
  cursor: pointer;
}

.item:hover {
  background: var(--surface-2);
}

.item.selected {
  background: var(--accent-soft);
}

.title {
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snippet {
  display: -webkit-box;
  overflow: hidden;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  font-size: 13px;
  color: var(--text-muted);
}

.meta {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  font-size: 12px;
  color: var(--text-muted);
}

.empty {
  padding: 8px 16px;
  color: var(--text-muted);
}

.footer {
  padding: 10px 12px;
  border-top: 1px solid var(--border);
}
</style>
