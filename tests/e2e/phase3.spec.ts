import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import sharp from "sharp";

// The core loop against the real Supabase project: join a community, post a cleanup,
// and watch the zone turn green. The throwaway account (and its post) is deleted after.
config({ path: path.resolve(__dirname, "../../.env.local"), quiet: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "One signed-in journey is enough; layout is covered by phase 1 on phones.");

// Unique per worker process, so the desktop and phone projects never collide on one address.
const stamp = `${Date.now()}.${process.pid}`;
const email = `e2e.loop.${stamp}@shoreup-tests.dev`;
const password = `Tide-${stamp}-pool`;

test.beforeAll(async ({}, testInfo) => {
  if (testInfo.project.name !== "desktop") return;
  const { error } = await admin.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: { display_name: "Rory Rockpool", is_adult_confirmed: true } });
  if (error) throw error;
});

test.afterAll(async () => {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const user of data.users.filter((u) => u.email === email)) await admin.auth.admin.deleteUser(user.id);
});

async function photo(color: { r: number; g: number; b: number }) {
  return sharp({ create: { width: 1000, height: 750, channels: 3, background: color } })
    .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "43/1 36/1 45/1", GPSLongitudeRef: "W", GPSLongitude: "79/1 23/1 0/1" } })
    .jpeg()
    .toBuffer();
}

test("join a community, post a cleanup, and the zone turns green", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("link", { name: /Your profile, Rory Rockpool/ })).toBeVisible({ timeout: 15_000 });

  // The pill starts as "CN: Join" and opens the list of communities.
  await page.getByRole("link", { name: "CN: Join" }).click();
  await expect(page.getByRole("heading", { name: "Communities" })).toBeVisible();
  const crew = page.getByRole("listitem").filter({ hasText: "Toronto Island Stewards" });
  await crew.getByRole("button", { name: "Join" }).click();

  // Joining lands on the community's feed, and the pill now names it.
  await expect(page).toHaveURL(/\/cn\/toronto-island-stewards$/, { timeout: 15_000 });
  await expect(page.getByRole("link", { name: "CN: Toronto Island Stewards" })).toBeVisible();
  await expect(page.getByRole("article").first()).toBeVisible();

  // Gibraltar Point Zone A starts Poor: safe water, heavy litter.
  await page.goto("/beach/gibraltar-point");
  const panel = page.getByRole("complementary", { name: "Gibraltar Point Beach details" });
  await expect(panel.getByRole("listitem", { name: "Zone A: 50, Poor" })).toBeVisible();

  await panel.getByRole("button", { name: "Post a cleanup" }).click();
  const dialog = page.getByRole("dialog", { name: "Post a cleanup" });
  await expect(dialog.getByLabel("Beach")).toHaveValue("gibraltar-point");
  await dialog.getByLabel("Zone").selectOption("gibraltar-point-1");
  await dialog.getByLabel("Cleanup photos").setInputFiles([
    { name: "before.jpg", mimeType: "image/jpeg", buffer: await photo({ r: 190, g: 170, b: 130 }) },
    { name: "after.jpg", mimeType: "image/jpeg", buffer: await photo({ r: 60, g: 130, b: 150 }) },
  ]);
  await expect(dialog.getByRole("button", { name: /Remove photo/ })).toHaveCount(2, { timeout: 20_000 });
  await dialog.getByLabel("What did you find?").fill("Two bags of bottle caps and rope from the west end.");
  await dialog.getByLabel("Bags collected").fill("2");
  await dialog.getByRole("button", { name: "Post cleanup" }).click();

  // The badge pops, the zone turns green, and the post shows in the panel.
  await expect(page.getByRole("status").filter({ hasText: "Badge earned: First Cleanup" })).toBeVisible({ timeout: 20_000 });
  await expect(panel.getByRole("listitem", { name: "Zone A: 100, Clean" })).toBeVisible({ timeout: 10_000 });
  await expect(panel.getByText("Two bags of bottle caps and rope from the west end.")).toBeVisible();

  // Stored photos carry no EXIF.
  const { data: photos } = await admin.from("post_feed").select("photo_paths").eq("body", "Two bags of bottle caps and rope from the west end.").single();
  expect(photos!.photo_paths).toHaveLength(2);
  for (const p of photos!.photo_paths as string[]) {
    const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/post-photos/${p}`;
    const meta = await sharp(Buffer.from(await (await fetch(url)).arrayBuffer())).metadata();
    expect(meta.exif).toBeUndefined();
  }

  // The feed has it first, and it can be liked and reported.
  await page.getByRole("link", { name: "CN: Toronto Island Stewards" }).click();
  const post = page.getByRole("article").filter({ hasText: "Two bags of bottle caps and rope" });
  await expect(post).toBeVisible();
  await expect(post.getByRole("img")).toHaveCount(2);
  await post.getByRole("button", { name: "Like" }).click();
  await expect(post.getByRole("button", { name: "Unlike" })).toContainText("1");
  await post.getByRole("button", { name: "Report" }).click();
  await post.getByRole("button", { name: "Send report" }).click();
  await expect(post.getByText(/Reported\. Thanks/)).toBeVisible();

  // The profile shows the cleanup. Levels and badges stay locked until a clean session logs five items.
  await page.getByRole("link", { name: /Your profile, Rory Rockpool/ }).click();
  await expect(page.getByRole("heading", { name: "Badges are locked" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Gibraltar Point Beach" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Toronto Island Stewards", exact: true })).toBeVisible();
});

test("posting requires membership, enforced by the database", async () => {
  const stranger = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, { auth: { persistSession: false } });
  const signedIn = await stranger.auth.signInWithPassword({ email, password });
  expect(signedIn.error).toBeNull();
  const { data: other } = await admin.from("communities").select("id").eq("slug", "bondi-dawn-patrol").single();

  const viaFunction = await stranger.rpc("create_cleanup_post", { p_community: other!.id, p_beach: "bondi", p_zone: "bondi-1", p_body: "sneaky", p_bags: 1, p_photo_paths: [`${signedIn.data.user!.id}/x.webp`] });
  expect(viaFunction.error?.message).toContain("Join this community");

  const direct = await stranger.from("posts").insert({ author_id: signedIn.data.user!.id, community_id: other!.id, beach_id: "bondi", zone_id: "bondi-1", body: "sneaky" });
  expect(direct.error).not.toBeNull();
});

test("the communities page and feeds are readable signed out", async ({ page }) => {
  await page.goto("/communities");
  await expect(page.getByRole("link", { name: "Woodbine Shore Crew" })).toBeVisible();
  await expect(page.getByText(/hosted by Tideline Collective/)).toBeVisible();
  await page.getByRole("link", { name: "Woodbine Shore Crew" }).click();
  await expect(page.getByText("Hosted by")).toBeVisible();
  await expect(page.getByRole("article").first()).toBeVisible();
});
