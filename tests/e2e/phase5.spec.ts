import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import { expect, test, type Locator, type Page } from "@playwright/test";

// Phase 5 against the real Supabase project: the welcome popup, clean sessions
// (guest and signed in), the events menu, organizer check-ins, and the badge
// unlock. Every throwaway account and everything it created is deleted after.
config({ path: path.resolve(__dirname, "../../.env.local"), quiet: true });
const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } });
const anonKey = (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)!;

test.describe.configure({ mode: "serial" });

// Unique per worker process, so the desktop and phone projects never collide on one address.
const stamp = `${Date.now()}.${process.pid}`;

type Throwaway = { email: string; password: string; displayName: string; id: string; username: string };

const people = {
  a: { email: `e2e.p5a.${stamp}@shoreup-tests.dev`, password: `Tide-${stamp}-a-pool`, displayName: "Ada Anchor", id: "", username: "" } as Throwaway,
  b: { email: `e2e.p5b.${stamp}@shoreup-tests.dev`, password: `Tide-${stamp}-b-pool`, displayName: "Bo Breakwater", id: "", username: "" } as Throwaway,
};

/** Cleanups this file created directly with the admin client, so they can be removed by id too. */
const createdCleanups: string[] = [];

async function createThrowaway(person: Throwaway) {
  const { data, error } = await admin.auth.admin.createUser({
    email: person.email,
    password: person.password,
    email_confirm: true,
    user_metadata: { display_name: person.displayName, is_adult_confirmed: true },
  });
  if (error) throw error;
  person.id = data.user.id;
  const { data: profile, error: profileError } = await admin.from("profiles").select("username").eq("id", person.id).single();
  if (profileError) throw profileError;
  person.username = profile.username as string;
}

test.beforeAll(async ({}, testInfo) => {
  // Only the desktop project runs the signed-in journeys, so only it needs accounts.
  if (testInfo.project.name !== "desktop") return;
  await createThrowaway(people.a);
  await createThrowaway(people.b);
});

test.afterAll(async () => {
  for (const id of createdCleanups) await admin.from("cleanups").delete().eq("id", id);
  const addresses = new Set([people.a.email, people.b.email]);
  const { data } = await admin.auth.admin.listUsers({ perPage: 200 });
  for (const user of data.users.filter((u) => u.email && addresses.has(u.email))) await admin.auth.admin.deleteUser(user.id);
});

async function signIn(page: Page, person: Throwaway) {
  await page.goto("/signin");
  await page.getByLabel("Email").fill(person.email);
  await page.getByLabel("Password").fill(person.password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page.getByRole("link", { name: new RegExp(`Your profile, ${person.displayName}`) })).toBeVisible({ timeout: 15_000 });
}

async function signOut(page: Page, person: Throwaway) {
  await page.goto(`/profile/${person.username}`);
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByRole("link", { name: "Sign in" })).toBeVisible({ timeout: 10_000 });
}

/** A client signed in as one of the throwaway accounts, for talking to the database as they would. */
async function clientFor(person: Throwaway) {
  const client = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, anonKey, { auth: { persistSession: false } });
  const { error } = await client.auth.signInWithPassword({ email: person.email, password: person.password });
  expect(error).toBeNull();
  return client;
}

const logTrash = (page: Page) => page.getByRole("button", { name: /^Log trash/ });
const sheet = (page: Page) => page.getByRole("region", { name: "Clean session" });

/** Taps one item's plus button `times` times and waits for the tally to follow. */
async function addItems(page: Page, itemName: string, times: number) {
  const add = sheet(page).getByRole("button", { name: `Add one ${itemName.toLowerCase()}` });
  for (let i = 0; i < times; i += 1) {
    await add.click();
    await expect(sheet(page).getByRole("group", { name: `${itemName}: ${i + 1}` })).toBeVisible();
  }
}

test("the welcome popup takes a guest to a place, once", async ({ page }) => {
  await page.goto("/?welcome=1");

  const dialog = page.getByRole("dialog", { name: "Welcome to Shore Up" });
  await expect(dialog).toBeVisible({ timeout: 15_000 });
  await expect(dialog.getByRole("link", { name: "Create an account" })).toBeVisible();

  await dialog.getByRole("button", { name: "Continue as guest" }).click();
  const placeStep = page.getByRole("dialog", { name: "Where do you want to look after?" });
  await expect(placeStep).toBeVisible();
  await expect(placeStep.getByRole("button", { name: "Use my location" })).toBeFocused();

  await placeStep.getByRole("combobox", { name: "Or type a place" }).fill("Toronto");
  const suggestions = placeStep.getByRole("listbox", { name: "Place suggestions" });
  await expect(suggestions).toBeVisible({ timeout: 10_000 });
  const first = suggestions.getByRole("option").first();
  const chosen = (await first.textContent())!;
  await first.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);

  const stored = await page.evaluate(() => window.localStorage.getItem("shoreup.place"));
  expect(stored).not.toBeNull();
  const place = JSON.parse(stored!) as { name: string; lat: number; lng: number };
  expect(place.name.length).toBeGreaterThan(0);
  expect(chosen).toContain(place.name);
  // Kept rounded to about 11 km, so the exact position is never stored.
  expect(place.lat).toBe(Math.round(place.lat * 10) / 10);
  expect(place.lng).toBe(Math.round(place.lng * 10) / 10);

  // Reloading with the same opt-in parameter does not ask again, and keeps the place.
  await page.goto("/?welcome=1");
  await expect(logTrash(page)).toBeVisible({ timeout: 15_000 });
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(await page.evaluate(() => window.localStorage.getItem("shoreup.place"))).toBe(stored);
});

test("a guest can run a clean session, reload, and finish it", async ({ page }) => {
  await page.goto("/");
  await logTrash(page).click();
  await sheet(page).getByRole("button", { name: "Start session" }).click();

  await addItems(page, "Plastic bottle", 2);
  await addItems(page, "Can", 1);

  await expect(sheet(page).getByText("3 items in the bag", { exact: true })).toBeVisible();
  const progress = sheet(page).getByRole("progressbar");
  await expect(progress).toHaveAttribute("aria-valuetext", "3 of 5 items toward badges");
  await expect(sheet(page).getByText("3 of 5 to unlock badges")).toBeVisible();

  // The tally survives a reload, because it lives on the device.
  await page.reload();
  await expect(logTrash(page)).toHaveAccessibleName(/3\s*items in this session/, { timeout: 15_000 });
  await logTrash(page).click();
  await expect(sheet(page).getByText("3 items in the bag", { exact: true })).toBeVisible();
  await expect(sheet(page).getByRole("group", { name: "Plastic bottle: 2" })).toBeVisible();
  await expect(sheet(page).getByRole("group", { name: "Can: 1" })).toBeVisible();

  await sheet(page).getByRole("button", { name: "Finish session" }).click();
  await expect(sheet(page).getByRole("heading", { name: "Session finished" })).toBeVisible();
  await expect(sheet(page).getByRole("link", { name: "Sign in to save it" })).toBeVisible();

  const held = await page.evaluate(() => window.localStorage.getItem("shoreup.guest-sessions"));
  const pending = JSON.parse(held!) as { counts: Record<string, number> }[];
  expect(pending).toHaveLength(1);
  expect(pending[0].counts).toEqual({ plastic_bottle: 2, can: 1 });
  expect(await page.evaluate(() => window.localStorage.getItem("shoreup.clean-session"))).toBeNull();
});

test.describe("signed in", () => {
  test.skip(({ isMobile }) => isMobile, "The signed-in journeys run once, on desktop; phones are covered above.");

  test("twelve items at a beach unlock badges and show up on the profile", async ({ page }) => {
    await signIn(page, people.a);

    // Nothing logged yet, so the badges are still behind the unlock panel.
    await page.goto(`/profile/${people.a.username}`);
    await expect(page.getByRole("heading", { name: "Badges are locked" })).toBeVisible();

    await page.goto("/beach/woodbine");
    await logTrash(page).click();
    await expect(sheet(page).getByText("at Woodbine Beach")).toBeVisible();
    await sheet(page).getByRole("button", { name: "Start session" }).click();
    await addItems(page, "Plastic bottle", 7);
    await addItems(page, "Can", 5);
    await expect(sheet(page).getByText("Badges and levels unlocked", { exact: true })).toBeVisible();

    await sheet(page).getByRole("button", { name: "Finish session" }).click();
    const toast = page.getByRole("status");
    await expect(toast).toContainText("Session saved: 12 items.", { timeout: 20_000 });
    await expect(toast).toContainText("Badges and levels are now unlocked on your profile.");
    await expect(toast).toContainText("Badge earned: 10 Items, First Beach.");

    // The database holds one session, its items, the unlock, and both badges.
    const { data: sessions } = await admin.from("clean_sessions").select("id, total_items, beach_id").eq("user_id", people.a.id);
    expect(sessions).toHaveLength(1);
    expect(sessions![0].total_items).toBe(12);
    expect(sessions![0].beach_id).toBe("woodbine");
    const { data: items } = await admin.from("clean_session_items").select("item_key, count").eq("session_id", sessions![0].id).order("item_key");
    expect(items).toEqual([
      { item_key: "can", count: 5 },
      { item_key: "plastic_bottle", count: 7 },
    ]);
    const { data: profile } = await admin.from("profiles").select("gamification_unlocked_at").eq("id", people.a.id).single();
    expect(profile!.gamification_unlocked_at).not.toBeNull();
    const { data: earned } = await admin.from("user_achievements").select("achievement_key").eq("user_id", people.a.id);
    const keys = (earned ?? []).map((row) => row.achievement_key as string);
    expect(keys).toContain("trash_10");
    expect(keys).toContain("first_beach");

    // And the profile shows all of it.
    await page.goto(`/profile/${people.a.username}`);
    await expect(page.getByRole("heading", { name: "Badges are locked" })).toBeHidden();
    const badge = (name: string) => page.getByRole("listitem").filter({ has: page.getByText(name, { exact: true }) });
    await expect(badge("10 Items").getByText(/^Earned /)).toBeVisible();
    await expect(badge("First Beach").getByText(/^Earned /)).toBeVisible();
    const next = badge("20 Items");
    await expect(next.getByText("Locked", { exact: true })).toBeVisible();
    await expect(next.getByRole("progressbar", { name: "Progress toward 20 Items" })).toHaveAttribute("aria-valuetext", "12 of 20 items");
    await expect(page.getByRole("region", { name: "Totals" }).getByRole("listitem").filter({ hasText: "items logged" })).toContainText("12");
  });

  test("registering for a nearby event and cancelling again", async ({ page }) => {
    await page.addInitScript(
      (value) => {
        try {
          window.localStorage.setItem("shoreup.place", value);
        } catch {
          // A browser that refuses storage just shows every event in one list.
        }
      },
      JSON.stringify({ name: "Toronto", lat: 43.7, lng: -79.4 }),
    );
    await signIn(page, people.a);
    await page.goto("/");

    const toggle = page.getByRole("button", { name: "Events" });
    await toggle.click();
    const panel = page.getByRole("complementary", { name: "Cleanup events near you" });
    await expect(panel.getByText("Shore cleanups near Toronto")).toBeVisible();

    // Toronto beaches come before the "Further away" heading; Sydney comes after it.
    // The header renders before the fetch resolves, so wait for the list itself.
    await expect(panel.getByRole("heading", { level: 3, name: "Further away" })).toBeVisible({ timeout: 15_000 });
    const headings = await panel.getByRole("heading", { level: 3 }).allTextContents();
    const far = headings.indexOf("Further away");
    expect(far).toBeGreaterThan(0);
    expect(headings.indexOf("Cherry Beach")).toBeLessThan(far);
    expect(headings.indexOf("Bluffer's Park Beach")).toBeLessThan(far);
    expect(headings.indexOf("Bondi Beach")).toBeGreaterThan(far);

    const card = panel.getByRole("listitem").filter({ hasText: "Bluffer's Park Beach" });
    const going = card.getByText(/\d+ (person|people) going/);
    const before = Number((await going.textContent())!.match(/\d+/)![0]);

    await card.getByRole("button", { name: "Register for this cleanup" }).click();
    await expect(card.getByRole("button", { name: "Cancel your registration" })).toBeVisible();
    await expect(going).toHaveText(`${before + 1} people going`);

    const registered = async () => {
      const { data } = await admin.from("cleanup_attendees").select("cleanup_id").eq("user_id", people.a.id);
      return (data ?? []).length;
    };
    await expect.poll(registered).toBe(1);

    await card.getByRole("button", { name: "Cancel your registration" }).click();
    await expect(card.getByRole("button", { name: "Register for this cleanup" })).toBeVisible();
    await expect(going).toHaveText(`${before} ${before === 1 ? "person" : "people"} going`);
    await expect.poll(registered).toBe(0);

    await page.keyboard.press("Escape");
    await expect(panel).toBeHidden();
    await expect(toggle).toBeFocused();
  });

  test("the organizer checks a volunteer in, and only the organizer can", async ({ page }) => {
    // join_cleanup only accepts future events, so a finished one is set up directly.
    const startsAt = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    const { data: cleanup, error } = await admin
      .from("cleanups")
      .insert({ beach_id: "woodbine", organizer_id: people.a.id, starts_at: startsAt, notes: "Phase 5 check-in test." })
      .select("id")
      .single();
    expect(error).toBeNull();
    const cleanupId = cleanup!.id as string;
    createdCleanups.push(cleanupId);
    const joined = await admin.from("cleanup_attendees").insert({ cleanup_id: cleanupId, user_id: people.b.id });
    expect(joined.error).toBeNull();

    await signIn(page, people.a);
    await page.goto(`/cleanups/${cleanupId}`);
    await expect(page.getByRole("heading", { name: "Take the tally" })).toBeVisible();

    // The roster row is the one with the tick box; the attendee list below has no controls.
    const tick = page.getByRole("checkbox", { name: `Checked in: ${people.b.displayName}` });
    const row = page.getByRole("listitem").filter({ has: tick });
    // The box only ticks once the server agrees, so click and wait rather than check().
    await tick.click();
    await expect(tick).toBeChecked({ timeout: 15_000 });
    const itemsField = row.getByRole("spinbutton", { name: `Items collected by ${people.b.displayName}` });
    await expect(itemsField).toBeEnabled({ timeout: 15_000 });
    await itemsField.fill("42");
    await row.getByRole("button", { name: `Save items for ${people.b.displayName}` }).click();
    await expect(row.getByText("Saved.")).toBeVisible({ timeout: 15_000 });

    // It sticks, and the public tally line now reports it.
    await page.reload();
    await expect(tick).toBeChecked();
    await expect(page.getByRole("listitem").filter({ has: tick }).getByRole("spinbutton", { name: `Items collected by ${people.b.displayName}` })).toHaveValue("42");
    await expect(page.getByText(/1 of 2 checked in, 42 items verified/)).toBeVisible();

    // The endorsement shows on the volunteer's public profile.
    await page.goto(`/profile/${people.b.username}`);
    await expect(page.getByRole("region", { name: "Totals" }).getByRole("listitem").filter({ hasText: "items verified" })).toContainText("42");
    await expect(page.getByRole("region", { name: "Events" }).getByRole("listitem").filter({ hasText: "Woodbine Beach" })).toContainText("Checked in - 42 items verified");

    // Nobody else gets the organizer's controls, through the page or the database.
    await signOut(page, people.a);
    await signIn(page, people.b);
    await page.goto(`/cleanups/${cleanupId}`);
    await expect(page.getByText(/1 of 2 checked in, 42 items verified/)).toBeVisible();
    await expect(page.getByRole("heading", { name: "Take the tally" })).toBeHidden();
    await expect(page.getByRole("checkbox", { name: `Checked in: ${people.b.displayName}` })).toHaveCount(0);

    const asB = await clientFor(people.b);
    const direct = await asB.rpc("check_in_attendee", { p_cleanup: cleanupId, p_user: people.b.id, p_items: 500 });
    expect(direct.error?.message).toContain("Only the organizer");
  });

  test("clean sessions and badges cannot be forged or read by anyone else", async () => {
    const asB = await clientFor(people.b);

    const forgedSession = await asB.from("clean_sessions").insert({ user_id: people.b.id, started_at: new Date().toISOString(), total_items: 500 });
    expect(forgedSession.error).not.toBeNull();

    const forgedBadge = await asB.from("user_achievements").insert({ user_id: people.b.id, achievement_key: "trash_1000" });
    expect(forgedBadge.error).not.toBeNull();

    // Someone else's sessions are private, so the read simply finds nothing.
    const peeking = await asB.from("clean_sessions").select("id").eq("user_id", people.a.id);
    expect(peeking.error).toBeNull();
    expect(peeking.data).toEqual([]);

    const startedAt = new Date().toISOString();
    const call = (items: Record<string, number>) => asB.rpc("log_clean_session", { p_started_at: startedAt, p_items: items, p_beach: null, p_zone: null });
    expect((await call({ moon_rock: 3 })).error?.message).toContain("Unknown item");
    expect((await call({ plastic_bottle: 0 })).error?.message).toContain("whole numbers from 1 to 500");
    expect((await call({ plastic_bottle: 501 })).error?.message).toContain("whole numbers from 1 to 500");

    const { data: sessions } = await admin.from("clean_sessions").select("id").eq("user_id", people.b.id);
    expect(sessions).toEqual([]);
  });
});

type Box = { x: number; y: number; width: number; height: number };

function overlap(a: Box, b: Box): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

/** Names every pair of map controls whose boxes intersect, so a failure says which two. */
async function collisions(page: Page): Promise<string[]> {
  const named: [string, Locator][] = [
    ["Log trash", logTrash(page)],
    ["Events", page.getByRole("button", { name: "Events" })],
    ["Mapbox attribution", page.locator(".mapboxgl-ctrl-attrib")],
    ["Mapbox logo", page.locator(".mapboxgl-ctrl-logo")],
  ];
  const boxes: [string, Box][] = [];
  for (const [name, locator] of named) {
    const box = await locator.boundingBox();
    if (!box) return [`${name} has no box`];
    boxes.push([name, box]);
  }
  const hits: string[] = [];
  for (let i = 0; i < boxes.length; i += 1) {
    for (let j = i + 1; j < boxes.length; j += 1) {
      if (overlap(boxes[i][1], boxes[j][1])) hits.push(`${boxes[i][0]} overlaps ${boxes[j][0]}`);
    }
  }
  return hits;
}

test("the map controls are reachable, big enough, and clear of each other", async ({ page }) => {
  await page.goto("/");

  // Donations left the MVP in "Remove donations from the MVP", so the map keeps two controls.
  for (const name of ["Log trash", "Events"]) {
    const control = page.getByRole("button", { name: new RegExp(`^${name}`) });
    await expect(control).toBeVisible({ timeout: 15_000 });
    const box = (await control.boundingBox())!;
    expect(box.width, `${name} width`).toBeGreaterThanOrEqual(44);
    expect(box.height, `${name} height`).toBeGreaterThanOrEqual(44);
  }

  await expect.poll(() => collisions(page), { timeout: 10_000 }).toEqual([]);

  // A beach panel moves the buttons and the attribution together; they must stay apart.
  await page.goto("/beach/woodbine");
  await expect(page.getByRole("heading", { name: "Woodbine Beach" })).toBeVisible();
  await expect.poll(() => collisions(page), { timeout: 10_000 }).toEqual([]);
});
