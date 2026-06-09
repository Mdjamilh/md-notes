<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import NoteEditor from "./components/NoteEditor.vue";
import NoteList from "./components/NoteList.vue";
import SettingsDialog from "./components/SettingsDialog.vue";
import { useShortcuts } from "./composables/useShortcuts";
import { useTheme } from "./composables/useTheme";
import { importFiles } from "./lib/transfer";
import { useNotesStore } from "./stores/notes";
import { useSettingsStore } from "./stores/settings";

const store = useNotesStore();
const settings = useSettingsStore();
useTheme();

const list = ref<InstanceType<typeof NoteList> | null>(null);
const editor = ref<InstanceType<typeof NoteEditor> | null>(null);
const settingsOpen = ref(false);
/** On narrow screens only one of list/editor is visible. */
const mobilePane = ref<"list" | "editor">("list");
const toast = ref<string | null>(null);
let toastTimer: ReturnType<typeof setTimeout> | undefined;

function notify(message: string): void {
  toast.value = message;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.value = null), 6000);
}

async function newNote(): Promise<void> {
  await store.create();
  mobilePane.value = "editor";
  if (settings.view === "preview") settings.view = "split";
  await nextTick();
  editor.value?.focus();
}

function open(id: string): void {
  store.select(id);
  mobilePane.value = "editor";
}

async function onImport(files: File[]): Promise<void> {
  const { notes, errors } = await importFiles(files);
  await store.addImported(notes);
  if (notes.length) mobilePane.value = "editor";
  const parts = [];
  if (notes.length) parts.push(`Imported ${notes.length} ${notes.length === 1 ? "note" : "notes"}.`);
  if (errors.length) parts.push(`Skipped: ${errors.join("; ")}`);
  if (parts.length) notify(parts.join(" "));
}

useShortcuts({
  new: () => void newNote(),
  search: () => {
    mobilePane.value = "list";
    list.value?.focusSearch();
  },
  togglePreview: () => editor.value?.togglePreview(),
  save: () => void store.flush(),
});

// Write pending edits when the tab is hidden or closed, so a quick close after typing isn't lost.
const onHide = () => {
  if (document.visibilityState === "hidden") void store.flush();
};
const onUnload = () => void store.flush();

onMounted(async () => {
  document.addEventListener("visibilitychange", onHide);
  window.addEventListener("pagehide", onUnload);
  await store.init();
});

onBeforeUnmount(() => {
  document.removeEventListener("visibilitychange", onHide);
  window.removeEventListener("pagehide", onUnload);
});
</script>

<template>
  <div class="app" :class="`pane-${mobilePane}`">
    <header class="topbar">
      <h1 class="brand"><img src="/favicon.svg" alt="" width="22" height="22" /> md-notes</h1>
      <span class="local" title="Notes are stored in IndexedDB in this browser">Saved only in this browser</span>
      <button type="button" class="btn btn-primary" title="New note (Alt+N)" @click="newNote">New note</button>
      <button type="button" class="btn" aria-haspopup="dialog" @click="settingsOpen = true">Settings</button>
    </header>

    <main class="main">
      <NoteList ref="list" class="list-pane" @open="open" @import="onImport" />
      <NoteEditor
        v-if="store.selected"
        ref="editor"
        :key="store.selected.id"
        class="editor-pane"
        :note="store.selected"
        @back="mobilePane = 'list'"
      />
      <div v-else-if="store.loaded" class="editor-pane blank">
        <p>Select a note, or create one with <kbd>Alt</kbd> + <kbd>N</kbd>.</p>
        <button type="button" class="btn btn-primary" @click="newNote">New note</button>
      </div>
    </main>

    <SettingsDialog v-model:open="settingsOpen" />

    <div v-if="toast" class="toast" role="status">
      {{ toast }}
      <button type="button" class="btn btn-ghost" aria-label="Dismiss" @click="toast = null">&times;</button>
    </div>
  </div>
</template>

<style scoped>
.app {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.topbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--border);
  background: var(--surface);
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
  margin: 0;
  font-size: 17px;
}

.local {
  margin-right: auto;
  padding: 2px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  font-size: 12px;
}

.main {
  flex: 1;
  display: grid;
  grid-template-columns: minmax(240px, 320px) 1fr;
  min-height: 0;
}

.blank {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-muted);
}

.toast {
  position: fixed;
  bottom: 16px;
  left: 50%;
  display: flex;
  align-items: center;
  gap: 8px;
  max-width: calc(100vw - 32px);
  padding: 8px 8px 8px 14px;
  transform: translateX(-50%);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  box-shadow: var(--shadow);
}

@media (max-width: 760px) {
  .local {
    display: none;
  }

  .brand {
    margin-right: auto;
  }

  .main {
    grid-template-columns: 1fr;
  }

  .pane-list .editor-pane,
  .pane-editor .list-pane {
    display: none;
  }
}
</style>
