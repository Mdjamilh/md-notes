import { flushPromises, mount } from "@vue/test-utils";
import { clear, createStore } from "idb-keyval";
import { createPinia, setActivePinia } from "pinia";
import { beforeEach, describe, expect, it, vi } from "vitest";
import NoteEditor from "../../src/components/NoteEditor.vue";
import NoteList from "../../src/components/NoteList.vue";
import TagEditor from "../../src/components/TagEditor.vue";
import { useNotesStore } from "../../src/stores/notes";
import { useSettingsStore } from "../../src/stores/settings";

async function setup() {
  const pinia = createPinia();
  setActivePinia(pinia);
  const store = useNotesStore();
  await store.init();
  return { pinia, store };
}

describe("components", () => {
  beforeEach(async () => {
    await clear(createStore("md-notes", "notes"));
    localStorage.clear();
    localStorage.setItem("md-notes:seeded", "1");
  });

  it("NoteList highlights matches in titles and snippets", async () => {
    const { pinia, store } = await setup();
    await store.create("# Pasta night\n\nBuy pasta and basil");
    await store.create("# Unrelated");
    const wrapper = mount(NoteList, { global: { plugins: [pinia] } });

    await wrapper.find("input[type=search]").setValue("pasta");
    const items = wrapper.findAll("li");
    expect(items).toHaveLength(1);
    expect(items[0]!.findAll("mark").map((m) => m.text())).toEqual(["Pasta", "pasta"]);
    expect(wrapper.text()).toContain("1 of 2 notes match");
  });

  it("NoteList renders note text as text, never as HTML", async () => {
    const { pinia, store } = await setup();
    await store.create("<img src=x onerror=alert(1)>\n\n<b>bold</b>");
    const wrapper = mount(NoteList, { global: { plugins: [pinia] } });
    expect(wrapper.find("li img").exists()).toBe(false);
    expect(wrapper.find("li b").exists()).toBe(false);
    expect(wrapper.find("li .title").text()).toBe("<img src=x onerror=alert(1)>");
  });

  it("NoteEditor updates the store as you type and previews sanitized HTML", async () => {
    const { pinia, store } = await setup();
    const note = await store.create();
    const wrapper = mount(NoteEditor, { props: { note }, global: { plugins: [pinia] } });

    await wrapper.find("textarea").setValue("# Hi\n\n<img src=x onerror=alert(1)>");
    expect(store.selected?.body).toContain("# Hi");
    await wrapper.setProps({ note: store.selected! });
    const preview = wrapper.find("[data-testid=preview]");
    expect(preview.find("h1").text()).toBe("Hi");
    expect(preview.html()).not.toContain("onerror");
    await store.flush();
  });

  it("NoteEditor hides the Summarize button until local AI is enabled", async () => {
    const { pinia, store } = await setup();
    const note = await store.create("# Something");
    const wrapper = mount(NoteEditor, { props: { note }, global: { plugins: [pinia] } });
    expect(wrapper.text()).not.toContain("Summarize");

    useSettingsStore().aiEnabled = true;
    await flushPromises();
    expect(wrapper.text()).toContain("Summarize (local)");
  });

  it("shows a helpful message when the local Ollama server is down", async () => {
    const { pinia, store } = await setup();
    const note = await store.create("# Meeting\n\nlots of words");
    useSettingsStore().aiEnabled = true;
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("Failed to fetch"));
    const wrapper = mount(NoteEditor, { props: { note }, global: { plugins: [pinia] } });

    const button = wrapper.findAll("button").find((b) => b.text() === "Summarize (local)")!;
    await button.trigger("click");
    await flushPromises();

    expect(fetchSpy).toHaveBeenCalledWith("http://localhost:11434/api/generate", expect.anything());
    const alert = wrapper.find("[role=alert]");
    expect(alert.text()).toContain("Could not reach Ollama at http://localhost:11434");
    expect(alert.text()).toContain("Try again");
  });

  it("TagEditor adds tags on Enter and removes them", async () => {
    const wrapper = mount(TagEditor, { props: { tags: ["a"] } });
    const input = wrapper.find("input");
    await input.setValue("Work, #Ideas");
    await input.trigger("keydown", { key: "Enter" });
    expect(wrapper.emitted("change")?.[0]).toEqual([["a", "work", "ideas"]]);

    await wrapper.find("button[aria-label='Remove tag a']").trigger("click");
    expect(wrapper.emitted("change")?.[1]).toEqual([[]]);
  });
});
