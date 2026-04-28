import { expect, test } from "@playwright/test";

const email = process.env.E2E_USER_EMAIL;
const password = process.env.E2E_USER_PASSWORD;

test.describe("core drafting flow", () => {
  test.skip(!email || !password, "Set E2E_USER_EMAIL and E2E_USER_PASSWORD to run the login flow.");

  test("login, select template, paste notes, generate, and copy", async ({ context, page }) => {
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);

    await page.route("**/api/ai", async (route) => {
      await route.fulfill({
        body: "Observation: Eleven deltog aktivt.\n\nNästa steg: Fortsätt med konkret material.",
        contentType: "text/plain; charset=utf-8",
        headers: {
          "Cache-Control": "no-store",
          "X-Skolskribenten-Output-Guard": "passed",
        },
        status: 200,
      });
    });

    await page.goto("/logga-in?next=%2Fskrivstation");
    await page.getByLabel("E-postadress").fill(email!);
    await page.getByLabel(/Lösenord/i).fill(password!);
    await page.getByRole("button", { name: "Logga in" }).click();

    await expect(page).toHaveURL(/\/skrivstation/);
    await page.getByRole("button", { name: "Lärlogg" }).click();
    await page
      .getByLabel("Anteckningar som ska omvandlas till pedagogisk dokumentation")
      .fill("Eleven deltog aktivt i problemlösning och använde konkret material.");
    await page.getByRole("button", { name: /Generera dokument/i }).click();

    await expect(page.getByText(/Observation: Eleven deltog aktivt/i)).toBeVisible();
    await page.getByRole("button", { name: "Kopiera" }).click();
    await expect(page.getByRole("button", { name: "Kopierat" })).toBeVisible();
  });
});
