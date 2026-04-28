import { expect, test } from "@playwright/test";

test.describe("public accessibility smoke checks", () => {
  test("exposes skip navigation and labelled contact form controls", async ({ page }) => {
    await page.goto("/");
    await page.keyboard.press("Tab");

    await expect(page.getByRole("link", { name: /Hoppa till innehållet/i })).toBeFocused();

    await page.goto("/kontakt");
    await expect(page.getByLabel("Namn")).toBeVisible();
    await expect(page.getByLabel("E-post")).toBeVisible();
    await expect(page.getByLabel("Ärende")).toBeVisible();
    await expect(page.getByLabel("Meddelande")).toBeVisible();
  });
});
