import { expect, test } from "@playwright/test";

// The globe needs a real Mapbox token (NEXT_PUBLIC_MAPBOX_TOKEN in .env.local).

test("lands on the globe with signed-out chrome", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("application", { name: "Globe and beach map" })).toBeVisible();
  await expect(page.getByRole("link", { name: "CN: Join" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Donate" })).toBeVisible();
  await expect(page.locator(".mapboxgl-ctrl-logo")).toBeVisible();
});

test("searching Woodbine opens its zones and a plain-words reason", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search beaches and places" }).and(page.locator(":visible"));
  await search.fill("woodb");
  await page.getByRole("option", { name: /Woodbine Beach/ }).click();

  await expect(page).toHaveURL(/\/beach\/woodbine$/);
  const panel = page.getByRole("complementary", { name: "Woodbine Beach details" });
  // The core moment: score, zones, and the reason within 3 seconds of the click.
  await expect(panel.getByText("across 5 zones")).toBeVisible({ timeout: 3000 });
  await expect(panel.getByText("Demo data")).toBeVisible();
  await expect(panel.getByRole("listitem", { name: "Zone C: 50, Poor" })).toBeVisible();
  await expect(panel.getByRole("listitem", { name: "Zone E: 25, Avoid" })).toBeVisible();
  await expect(panel.getByText(/Zone E shows red because the water is unsafe/)).toBeAttached();
});

test("a beach URL opens on that beach, and Back to globe returns", async ({ page }) => {
  await page.goto("/beach/cherry");
  await expect(page.getByRole("heading", { name: "Cherry Beach" })).toBeVisible();
  await page.getByRole("button", { name: "Back to globe" }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("heading", { name: "Cherry Beach" })).toBeHidden();
});

test("place search offers geocoded places", async ({ page }) => {
  await page.goto("/");
  const search = page.getByRole("combobox", { name: "Search beaches and places" }).and(page.locator(":visible"));
  await search.fill("Lisbon");
  await expect(page.getByRole("option", { name: /Lisbon/ }).first()).toBeVisible({ timeout: 8000 });
});
