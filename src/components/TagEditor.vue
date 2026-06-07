<script setup lang="ts">
import { ref } from "vue";
import { normalizeTags, parseTagInput } from "../lib/notes";

const props = defineProps<{ tags: string[] }>();
const emit = defineEmits<{ change: [tags: string[]] }>();
const draft = ref("");

function commit(): void {
  const added = parseTagInput(draft.value);
  draft.value = "";
  if (added.length) emit("change", normalizeTags([...props.tags, ...added]));
}

function removeTag(tag: string): void {
  emit("change", props.tags.filter((t) => t !== tag));
}

function onKeydown(e: KeyboardEvent): void {
  if (e.key === "Enter" || e.key === ",") {
    e.preventDefault();
    commit();
  } else if (e.key === "Backspace" && draft.value === "" && props.tags.length) {
    removeTag(props.tags[props.tags.length - 1]!);
  }
}
</script>

<template>
  <div class="tag-editor">
    <span v-for="t in tags" :key="t" class="chip">
      #{{ t }}
      <button type="button" class="remove" :aria-label="`Remove tag ${t}`" @click="removeTag(t)">&times;</button>
    </span>
    <label class="visually-hidden" for="tag-input">Add tags</label>
    <input
      id="tag-input"
      v-model="draft"
      class="draft"
      type="text"
      placeholder="Add tag"
      autocomplete="off"
      @keydown="onKeydown"
      @blur="commit"
    />
  </div>
</template>

<style scoped>
.tag-editor {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-top: 1px solid var(--border);
  background: var(--surface);
}

.chip {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  padding: 1px 4px 1px 8px;
  border-radius: 999px;
  background: var(--accent-soft);
  font-size: 13px;
}

.remove {
  width: 20px;
  height: 20px;
  border: 0;
  border-radius: 50%;
  background: transparent;
  line-height: 1;
  cursor: pointer;
}

.remove:hover {
  background: var(--surface-2);
}

.draft {
  flex: 1;
  min-width: 100px;
  border: 0;
  background: transparent;
  font-size: 13px;
}

.draft:focus-visible {
  outline: none;
}
</style>
