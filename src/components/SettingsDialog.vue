<script setup lang="ts">
import { ref, watch } from "vue";
import { listModels } from "../lib/ollama";
import { useSettingsStore } from "../stores/settings";

const open = defineModel<boolean>("open", { required: true });
const settings = useSettingsStore();
const dialog = ref<HTMLDialogElement | null>(null);
const test = ref<{ ok: boolean; message: string } | null>(null);
const testing = ref(false);

watch(open, (value) => {
  if (value) {
    test.value = null;
    dialog.value?.showModal();
  } else {
    dialog.value?.close();
  }
});

async function testConnection(): Promise<void> {
  testing.value = true;
  test.value = null;
  try {
    const models = await listModels(settings.ollamaUrl);
    const wanted = settings.ollamaModel.trim();
    const has = models.some((m) => m === wanted || m.startsWith(`${wanted}:`));
    test.value = has
      ? { ok: true, message: `Connected. "${wanted}" is installed.` }
      : {
          ok: false,
          message: models.length
            ? `Connected, but "${wanted}" is not installed. Installed: ${models.join(", ")}. Run "ollama pull ${wanted}".`
            : `Connected, but no models are installed. Run "ollama pull ${wanted}".`,
        };
  } catch (err) {
    test.value = { ok: false, message: err instanceof Error ? err.message : String(err) };
  } finally {
    testing.value = false;
  }
}
</script>

<template>
  <dialog ref="dialog" class="dialog" aria-labelledby="settings-title" @close="open = false">
    <form method="dialog" class="content">
      <header>
        <h2 id="settings-title">Settings</h2>
        <button class="btn btn-ghost" aria-label="Close settings">&times;</button>
      </header>

      <fieldset>
        <legend>Theme</legend>
        <label v-for="t in ['system', 'light', 'dark'] as const" :key="t" class="radio">
          <input v-model="settings.theme" type="radio" name="theme" :value="t" />
          {{ t === "system" ? "Match my device" : t[0]!.toUpperCase() + t.slice(1) }}
        </label>
      </fieldset>

      <fieldset>
        <legend>Local AI summaries (optional)</legend>
        <p class="notice">
          This site has no AI of its own and no server that sees your notes. If you turn this on, the
          <strong>Summarize</strong> button sends the open note straight from your browser to an
          <a href="https://ollama.com" target="_blank" rel="noopener noreferrer">Ollama</a> server that you run on
          your own computer. Nothing is sent until you click the button.
        </p>

        <label class="check">
          <input v-model="settings.aiEnabled" type="checkbox" data-testid="ai-toggle" />
          Show the "Summarize (local)" button
        </label>

        <div class="field">
          <label for="ollama-url">Ollama URL</label>
          <input id="ollama-url" v-model.trim="settings.ollamaUrl" class="input" type="url" :disabled="!settings.aiEnabled" />
        </div>
        <div class="field">
          <label for="ollama-model">Model</label>
          <input id="ollama-model" v-model.trim="settings.ollamaModel" class="input" type="text" :disabled="!settings.aiEnabled" />
        </div>

        <div class="row">
          <button type="button" class="btn" :disabled="!settings.aiEnabled || testing" @click="testConnection">
            {{ testing ? "Testing…" : "Test connection" }}
          </button>
          <button type="button" class="btn btn-ghost" :disabled="!settings.aiEnabled" @click="settings.resetAi">
            Reset to defaults
          </button>
        </div>
        <p v-if="test" class="result" :class="{ ok: test.ok }" role="status">{{ test.message }}</p>

        <details class="help">
          <summary>How to set up Ollama for this page</summary>
          <ol>
            <li>Install Ollama and run <code>ollama pull llama3.2</code>.</li>
            <li>
              Allow this page to call it by starting the server with
              <code>OLLAMA_ORIGINS=&lt;this site's address&gt; ollama serve</code>.
            </li>
            <li>Your browser may ask for permission to reach devices on your local network. Allow it.</li>
          </ol>
          <p>
            The hosted demo only allows connections to <code>localhost:11434</code> and <code>127.0.0.1:11434</code>.
            To use another address, run md-notes yourself.
          </p>
        </details>
      </fieldset>

      <fieldset>
        <legend>Keyboard shortcuts</legend>
        <dl class="keys">
          <dt><kbd>Alt</kbd> + <kbd>N</kbd></dt>
          <dd>New note</dd>
          <dt><kbd>Ctrl/Cmd</kbd> + <kbd>K</kbd> or <kbd>/</kbd></dt>
          <dd>Search</dd>
          <dt><kbd>Alt</kbd> + <kbd>P</kbd></dt>
          <dd>Toggle preview</dd>
          <dt><kbd>Ctrl/Cmd</kbd> + <kbd>S</kbd></dt>
          <dd>Save now (notes also save automatically)</dd>
        </dl>
      </fieldset>
    </form>
  </dialog>
</template>

<style scoped>
.dialog {
  width: min(560px, calc(100vw - 24px));
  max-height: calc(100vh - 48px);
  padding: 0;
  border: 1px solid var(--border);
  border-radius: 12px;
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow);
}

.dialog::backdrop {
  background: rgb(0 0 0 / 40%);
}

.content {
  padding: 8px 20px 20px;
}

header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

h2 {
  margin: 8px 0;
  font-size: 1.2em;
}

fieldset {
  margin: 12px 0 0;
  padding: 12px 14px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
}

legend {
  padding: 0 4px;
  font-weight: 600;
}

.radio {
  margin-right: 16px;
}

.notice {
  margin: 0 0 10px;
  padding: 8px 10px;
  border-radius: var(--radius);
  background: var(--warning-bg);
  color: var(--warning-text);
  font-size: 14px;
}

.notice a {
  color: inherit;
}

.check {
  display: flex;
  gap: 8px;
  align-items: center;
  margin-bottom: 10px;
}

.field {
  display: grid;
  gap: 4px;
  margin-bottom: 10px;
}

.field label {
  font-size: 13px;
  color: var(--text-muted);
}

.row {
  display: flex;
  gap: 8px;
}

.result {
  margin: 8px 0 0;
  color: var(--danger);
  font-size: 14px;
}

.result.ok {
  color: var(--accent);
}

.help {
  margin-top: 10px;
  font-size: 14px;
}

.help code {
  font-family: var(--font-mono);
  font-size: 0.9em;
}

.keys {
  display: grid;
  grid-template-columns: auto 1fr;
  gap: 6px 16px;
  margin: 0;
}

.keys dd {
  margin: 0;
}
</style>
