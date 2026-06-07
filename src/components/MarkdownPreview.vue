<script setup lang="ts">
import { computed } from "vue";
import { renderMarkdown } from "../lib/markdown";

const props = defineProps<{ source: string }>();

// renderMarkdown sanitizes with DOMPurify, which is what makes v-html safe here.
const html = computed(() => renderMarkdown(props.source));
</script>

<template>
  <!-- eslint-disable-next-line vue/no-v-html -->
  <div class="markdown" v-html="html"></div>
</template>

<style scoped>
.markdown {
  overflow-wrap: anywhere;
  line-height: 1.65;
}

.markdown :deep(h1),
.markdown :deep(h2),
.markdown :deep(h3) {
  line-height: 1.25;
  margin: 1.2em 0 0.5em;
}

.markdown :deep(h1) {
  font-size: 1.75em;
  margin-top: 0;
}

.markdown :deep(h2) {
  font-size: 1.35em;
  padding-bottom: 0.2em;
  border-bottom: 1px solid var(--border);
}

.markdown :deep(a) {
  color: var(--accent);
}

.markdown :deep(code) {
  font-family: var(--font-mono);
  font-size: 0.9em;
  padding: 0.1em 0.35em;
  border-radius: 4px;
  background: var(--code-bg);
}

.markdown :deep(pre) {
  padding: 12px 14px;
  overflow-x: auto;
  border-radius: var(--radius);
  background: var(--code-bg);
}

.markdown :deep(pre code) {
  padding: 0;
  background: none;
}

.markdown :deep(blockquote) {
  margin: 1em 0;
  padding: 0.25em 1em;
  border-left: 3px solid var(--accent);
  color: var(--text-muted);
}

.markdown :deep(table) {
  border-collapse: collapse;
  margin: 1em 0;
}

.markdown :deep(th),
.markdown :deep(td) {
  padding: 6px 10px;
  border: 1px solid var(--border);
}

.markdown :deep(th) {
  background: var(--surface-2);
}

.markdown :deep(img) {
  max-width: 100%;
}

.markdown :deep(li:has(> input[type="checkbox"])) {
  list-style: none;
  margin-left: -1.3em;
}

.markdown :deep(hr) {
  border: 0;
  border-top: 1px solid var(--border);
}
</style>
