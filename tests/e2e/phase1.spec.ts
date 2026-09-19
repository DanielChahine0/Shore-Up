import { expect, test } from "@playwright/test";

// The globe needs a real Mapbox token (NEXT_PUBLIC_MAPBOX_TOKEN in .env.local).

test("lands on the globe with signed-out chrome", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("application", { name: "Globe and beach map" })).toBeVisible();
  await expect(page.getByRole("link", { name: "CN: Join" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Log trash/ })).toBeVisible();
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

type MapHandle = { getCenter(): { lng: number; lat: number }; getZoom(): number; isMoving(): boolean; isStyleLoaded(): boolean };
const camera = (page: import("@playwright/test").Page) =>
  page.evaluate(() => {
    const map = (window as unknown as { __shoreMap: MapHandle }).__shoreMap;
    return { ...map.getCenter(), zoom: map.getZoom() };
  });
/** The map has loaded its style and stopped moving. */
const settled = (page: import("@playwright/test").Page) =>
  page.waitForFunction(() => {
    const map = (window as unknown as { __shoreMap?: MapHandle }).__shoreMap;
    return map && map.isStyleLoaded() && !map.isMoving();
  });
/** The camera has arrived at a beach. The panel renders before the map style loads, so tests must wait for this. */
const onBeach = (page: import("@playwright/test").Page) =>
  page.waitForFunction(() => {
    const map = (window as unknown as { __shoreMap?: MapHandle }).__shoreMap;
    return map && map.isStyleLoaded() && !map.isMoving() && map.getZoom() > 10;
  });

test("closing a beach leaves the camera where it is", async ({ page }) => {
  await page.goto("/beach/cherry");
  await expect(page.getByRole("heading", { name: "Cherry Beach" })).toBeVisible();
  await onBeach(page);
  const before = await camera(page);

  await page.getByRole("button", { name: "Close beach details" }).click();
  await expect(page.getByRole("heading", { name: "Cherry Beach" })).toBeHidden();
  await page.waitForTimeout(500);
  await settled(page);
  expect(await camera(page)).toEqual(before);
  // Still zoomed in, so the way out is still offered.
  await expect(page.getByRole("button", { name: "Back to globe" })).toBeVisible();
});

test("Back to globe zooms out over the current spot, not the starting view", async ({ page }) => {
  await page.goto("/beach/bondi");
  await expect(page.getByRole("heading", { name: "Bondi Beach" })).toBeVisible();
  await onBeach(page);

  await page.getByRole("button", { name: "Back to globe" }).click();
  await page.waitForTimeout(500);
  await settled(page);
  const after = await camera(page);
  expect(after.zoom).toBeLessThan(2);
  // Still over Sydney (151 E, 34 S), not back over the Atlantic.
  expect(after.lng).toBeGreaterThan(140);
  expect(after.lat).toBeLessThan(-20);
  await expect(page.getByRole("button", { name: "Back to globe" })).toBeHidden();

  // And it stays put: the idle rotation does not resume.
  await page.waitForTimeout(1200);
  expect((await camera(page)).lng).toBeCloseTo(after.lng, 3);
});
