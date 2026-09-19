import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";
import sharp from "sharp";

// Signs up a throwaway account against the real Supabase project, then deletes it.
config({ path: path.resolve(__dirname, "../../.env.local"), quiet: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "One signed-in journey is enough; layout is covered by phase 1 on phones.");

// Unique per worker process, so parallel projects never collide on one address or username.
const stamp = `${Date.now()}${process.pid}`;
const email = `e2e.${stamp}@shoreup-tests.dev`;
const password = `Tide-${stamp}-pool`;
const username = `e2e_${stamp}`;

test.afterAll(async () => {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const user of data.users.filter((u) => u.email === email)) await admin.auth.admin.deleteUser(user.id);
});

test("sign up, edit the profile, upload a photo, and join a cleanup from People", async ({ page }) => {
  // Sign up
  await page.goto("/signin");
  await page.getByRole("button", { name: "Create an account" }).click();
  await page.getByLabel("Display name").fill("Tessa Tidewater");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByLabel(/I am 18 or older/).check();
  await page.getByRole("button", { name: "Create account" }).click();

  // Back on the globe, the corner shows the avatar instead of "Sign in".
  const avatar = page.getByRole("link", { name: /Your profile, Tessa Tidewater/ });
  await expect(avatar).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("link", { name: "Sign in" })).toBeHidden();

  // The sign-up trigger made a profile. Edit it.
  await avatar.click();
  await expect(page.getByRole("heading", { name: "Tessa Tidewater" })).toBeVisible();
  // Levels and badges stay shut until a first five-item clean session (phase 5).
  await expect(page.getByRole("heading", { name: "Badges are locked" })).toBeVisible();
  await page.getByRole("link", { name: "Edit profile" }).click();

  // Photo with GPS data in it; the server must strip it.
  const photo = await sharp({ create: { width: 900, height: 700, channels: 3, background: { r: 30, g: 110, b: 150 } } })
    .withExif({ IFD3: { GPSLatitudeRef: "N", GPSLatitude: "43/1 39/1 40/1", GPSLongitudeRef: "W", GPSLongitude: "79/1 18/1 25/1" } })
    .jpeg()
    .toBuffer();
  await page.getByLabel("Profile photo").setInputFiles({ name: "me.jpg", mimeType: "image/jpeg", buffer: photo });
  await expect(page.getByRole("button", { name: "Change photo" })).toBeVisible({ timeout: 15_000 });

  await page.getByRole("textbox", { name: /^Username/ }).fill(username);
  await page.getByRole("textbox", { name: /^Area/ }).fill("Leslieville, Toronto");
  await page.getByRole("textbox", { name: /^Bio/ }).fill("Testing the tide line.");
  await page.getByRole("radio", { name: "Joining a cleanup" }).check();
  await page.getByRole("checkbox", { name: /List me in the People directory/ }).check();
  await page.getByRole("button", { name: "Save profile" }).click();

  await expect(page).toHaveURL(new RegExp(`/profile/${username}$`));
  await expect(page.getByText(`@${username}, Leslieville, Toronto`)).toBeVisible();
  await expect(page.getByText("Testing the tide line.")).toBeVisible();

  // The stored avatar is a WebP with no EXIF left in it.
  const { data: profile } = await admin.from("profiles").select("avatar_url").eq("username", username).single();
  const stored = Buffer.from(await (await fetch(profile!.avatar_url)).arrayBuffer());
  const meta = await sharp(stored).metadata();
  expect(meta.format).toBe("webp");
  expect(meta.exif).toBeUndefined();

  // People: the new user is listed, and Maya at Cherry Beach can be joined.
  await page.goto("/people");
  await expect(page.getByRole("link", { name: "Tessa Tidewater", exact: true })).toBeVisible();
  const maya = page.getByRole("listitem").filter({ hasText: "Maya Okafor" });
  await expect(maya.getByText("Looking for volunteers")).toBeVisible();
  await expect(maya.getByText(/Cherry Beach/)).toBeVisible();
  // The directory now uses the one Register/Cancel button the events menu uses (phase 5).
  await maya.getByRole("button", { name: "Register for this cleanup" }).click();
  await expect(maya.getByRole("button", { name: "Cancel your registration" })).toBeVisible({ timeout: 10_000 });

  // The cleanup page lists them, and so does their directory entry.
  await maya.getByRole("link", { name: /Cherry Beach/ }).click();
  await expect(page.getByRole("heading", { name: /Cherry Beach/ })).toBeVisible();
  await expect(page.getByText("Organized by Maya Okafor")).toBeVisible();
  await expect(page.getByRole("main").getByRole("link", { name: /Tessa Tidewater/ })).toBeVisible();
  await expect(page.getByRole("heading", { name: "4 people going" })).toBeVisible();

  // Host a cleanup from a beach panel.
  await page.goto("/beach/kitsilano");
  await page.getByRole("button", { name: "Host a cleanup" }).click();
  const dialog = page.getByRole("dialog", { name: "Host a cleanup" });
  await expect(dialog).toBeVisible();
  const inTenDays = new Date(Date.now() + 10 * 86_400_000).toISOString().slice(0, 11) + "09:30";
  await dialog.getByLabel("Date and time").fill(inTenDays);
  await dialog.getByLabel("Notes for volunteers").fill("Meet by the big log.");
  await dialog.getByRole("button", { name: "Create cleanup" }).click();
  await expect(page).toHaveURL(/\/cleanups\/[0-9a-f-]{36}$/, { timeout: 15_000 });
  await expect(page.getByRole("heading", { name: /Kitsilano Beach/ })).toBeVisible();
  await expect(page.getByText("You're hosting this one.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "1 person going" })).toBeVisible();
  await expect(page.getByText("Meet by the big log.")).toBeVisible();

  // Sign out
  await page.goto(`/profile/${username}`);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible({ timeout: 10_000 });
});

test("a hidden or unconfirmed profile is invisible to everyone else", async ({ page }) => {
  await page.goto("/people");
  // Emma is taking a break, so she is not listed, even though her profile is public.
  await expect(page.getByRole("link", { name: "Emma Jensen", exact: true })).toBeHidden();
  const res = await page.goto("/profile/nobody_by_this_name");
  expect(res?.status()).toBe(404);
});

test("signed-out visitors are sent to sign in before joining or editing", async ({ page }) => {
  await page.goto("/profile/edit");
  await expect(page).toHaveURL(/\/signin\?next=%2Fprofile%2Fedit|\/signin\?next=\/profile\/edit/);

  await page.goto("/people");
  await page.getByRole("listitem").filter({ hasText: "Maya Okafor" }).getByRole("button", { name: "Register for this cleanup" }).click();
  await expect(page).toHaveURL(/\/signin\?next=/);
});
