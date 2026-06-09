import { expect, test, type Page } from "@playwright/test";

function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));
  return errors;
}

async function showPreview(page: Page) {
  // Desktop shows the split view; narrow screens toggle between panes.
  if (await page.getByTestId("preview").isVisible()) return;
  await page.getByRole("button", { name: "Preview", exact: true }).click();
}

test("create a note, see the preview, and find it again after a reload", async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "md-notes", exact: true })).toBeVisible();

  await page.getByRole("button", { name: "New note" }).first().click();
  const editor = page.getByRole("textbox", { name: "Markdown" });
  await expect(editor).toBeFocused();
  await editor.fill("# Trip plan\n\nPack **boots** and a `map`.\n\n- [ ] book train\n\n<img src=x onerror=alert(1)>");

  await showPreview(page);
  const preview = page.getByTestId("preview");
  await expect(preview.getByRole("heading", { level: 1, name: "Trip plan" })).toBeVisible();
  await expect(preview.locator("strong")).toHaveText("boots");
  await expect(preview.locator("img")).not.toHaveAttribute("onerror", /.*/);
  await expect(page.getByRole("status").filter({ hasText: "Saved" })).toBeVisible();

  await page.reload();
  // The list shows the derived title; open it and check the content survived.
  await page.getByRole("button", { name: /Trip plan/ }).click();
  await expect(page.getByRole("textbox", { name: "Markdown" })).toHaveValue(/Pack \*\*boots\*\*/);
  await showPreview(page);
  await expect(page.getByTestId("preview").getByRole("heading", { name: "Trip plan" })).toBeVisible();

  expect(errors).toEqual([]);
});

test("search highlights matches in the list", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "New note" }).first().click();
  await page.getByRole("textbox", { name: "Markdown" }).fill("# Groceries\n\nmilk and eggs");
  await page.keyboard.press("ControlOrMeta+k");
  await page.getByRole("searchbox", { name: "Search notes" }).fill("milk");
  const item = page.getByRole("listitem").filter({ hasText: "Groceries" });
  await expect(item.locator("mark")).toHaveText("milk");
  await expect(page.getByText("1 of 2 notes match")).toBeVisible();
});
