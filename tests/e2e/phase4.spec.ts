import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { expect, test } from "@playwright/test";

// Verification against the real Supabase project: an organizer takes the tally after an event,
// and the endorsement shows on the volunteer's profile. Both throwaway accounts are deleted after,
// and the cleanup goes with its organizer.
config({ path: path.resolve(__dirname, "../../.env.local"), quiet: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });

test.describe.configure({ mode: "serial" });
test.skip(({ isMobile }) => isMobile, "One signed-in journey is enough; layout is covered by phase 1 on phones.");

const stamp = `${Date.now()}.${process.pid}`;
const organizer = { email: `e2e.host.${stamp}@shoreup-tests.dev`, password: `Tide-${stamp}-host`, name: "Orla Organizer" };
const volunteer = { email: `e2e.vol.${stamp}@shoreup-tests.dev`, password: `Tide-${stamp}-vol`, name: "Vic Volunteer" };
const emails = [organizer.email, volunteer.email];

let cleanupId = "";
let volunteerUsername = "";

test.beforeAll(async ({}, testInfo) => {
  if (testInfo.project.name !== "desktop") return;
  const ids: string[] = [];
  for (const person of [organizer, volunteer]) {
    const { data, error } = await admin.auth.admin.createUser({ email: person.email, password: person.password, email_confirm: true, user_metadata: { display_name: person.name, is_adult_confirmed: true } });
    if (error) throw error;
    ids.push(data.user.id);
  }
  // Adult-confirmed profiles are public, so the organizer can read the volunteer's page.
  const profile = await admin.from("profiles").select("username").eq("id", ids[1]).single();
  if (profile.error) throw profile.error;
  volunteerUsername = profile.data.username;

  // The event started two hours ago, so check-ins are open.
  const cleanup = await admin.from("cleanups").insert({ beach_id: "cherry", organizer_id: ids[0], starts_at: new Date(Date.now() - 2 * 3_600_000).toISOString(), notes: "e2e tally" }).select("id").single();
  if (cleanup.error) throw cleanup.error;
  cleanupId = cleanup.data.id;
  const attendee = await admin.from("cleanup_attendees").insert({ cleanup_id: cleanupId, user_id: ids[1] });
  if (attendee.error) throw attendee.error;
});

test.afterAll(async () => {
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const user of data.users.filter((u) => u.email && emails.includes(u.email))) await admin.auth.admin.deleteUser(user.id);
});

test("the organizer takes the tally, and the endorsement shows on the volunteer's profile", async ({ page }) => {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(organizer.email);
  await page.getByLabel("Password").fill(organizer.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("link", { name: /Your profile, Orla Organizer/ })).toBeVisible({ timeout: 15_000 });

  await page.goto(`/cleanups/${cleanupId}`);
  await expect(page.getByRole("heading", { name: "Take the tally" })).toBeVisible();

  await page.getByRole("checkbox", { name: "Checked in: Vic Volunteer" }).check();
  const items = page.getByRole("spinbutton", { name: "Items collected by Vic Volunteer" });
  await expect(items).toBeEnabled({ timeout: 10_000 });
  await items.fill("37");
  await page.getByRole("button", { name: "Save items for Vic Volunteer" }).click();
  await expect(page.getByRole("button", { name: "Save items for Vic Volunteer" })).toBeDisabled({ timeout: 10_000 });

  // The event page sums it up for everyone. The organizer is on their own roster, hence two.
  await page.reload();
  await expect(page.getByText("1 of 2 checked in, 37 items verified.")).toBeVisible();

  // And the volunteer's profile carries the endorsement.
  await page.goto(`/profile/${volunteerUsername}`);
  await expect(page.getByText("Checked in - 37 items verified")).toBeVisible();
});

test("only the organizer can take the tally, enforced by the database", async () => {
  const stranger = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!, { auth: { persistSession: false } });
  const signedIn = await stranger.auth.signInWithPassword({ email: volunteer.email, password: volunteer.password });
  expect(signedIn.error).toBeNull();

  // A volunteer cannot endorse themselves.
  const viaFunction = await stranger.rpc("check_in_attendee", { p_cleanup: cleanupId, p_user: signedIn.data.user!.id, p_items: 5000 });
  expect(viaFunction.error?.message).toContain("Only the organizer");
  const direct = await stranger.from("cleanup_checkins").update({ items_verified: 5000 }).eq("cleanup_id", cleanupId).select("cleanup_id");
  expect(direct.data ?? []).toHaveLength(0);
});
