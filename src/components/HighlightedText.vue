<script setup lang="ts">
import { computed } from "vue";
import { highlight } from "../lib/highlight";

const props = defineProps<{ text: string; terms: readonly string[] }>();

// Matches are rendered as <mark> elements by the template, never via v-html.
const segments = computed(() => highlight(props.text, props.terms));
</script>

<template>
  <span><template v-for="(s, i) in segments" :key="i"><mark v-if="s.match">{{ s.text }}</mark><template v-else>{{ s.text }}</template></template></span>
</template>
