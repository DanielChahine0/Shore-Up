/**
 * Seeds Supabase with demo data. Safe to re-run: reference rows are upserted
 * and demo water readings are replaced.
 *
 * Seeds beaches, zones, demo water readings, 20 demo users, and 3 upcoming
 * cleanups. Communities and posts are added in phase 3.
 *
 * Usage: pnpm seed   (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local)
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { FeatureCollection } from "geojson";
import type { DemoZoneState } from "../lib/scores/sources";

const ROOT = path.resolve(__dirname, "..");
config({ path: path.join(ROOT, ".env.local") });

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local first.");
  process.exit(1);
}
const supabase = createClient(url, serviceKey, { auth: { persistSession: false } });

const readJson = async <T>(file: string) => JSON.parse(await readFile(path.join(ROOT, file), "utf8")) as T;

function check(step: string, error: { message: string } | null) {
  if (error) throw new Error(`${step}: ${error.message}`);
}

async function main() {
  const beaches = await readJson<FeatureCollection>("data/geo/beaches.json");
  const zoneStates = await readJson<DemoZoneState[]>("data/seed/zone-state.json");

  const beachRows = beaches.features.map((f) => {
    const p = f.properties as { id: string; name: string; area: string; country: string; lng: number; lat: number; osm_id: string };
    return { id: p.id, name: p.name, area: p.area, country: p.country, lng: p.lng, lat: p.lat, osm_id: p.osm_id };
  });
  check("beaches", (await supabase.from("beaches").upsert(beachRows)).error);

  const zoneRows = zoneStates.map((z) => ({
    id: z.zoneId,
    beach_id: z.beachId,
    name: z.name,
    position: z.position,
    demo_last_cleaned_days: z.lastCleanedDaysAgo,
  }));
  check("zones", (await supabase.from("zones").upsert(zoneRows)).error);

  // Replace demo readings only. Official, model, and volunteer readings are never touched.
  check("clear demo water readings", (await supabase.from("water_readings").delete().eq("source", "demo")).error);
  const now = Date.now();
  const readingRows = zoneStates.map((z) => ({
    zone_id: z.zoneId,
    status: z.waterStatus,
    source: "demo",
    observed_at: new Date(now - z.waterObservedHoursAgo * 3_600_000).toISOString(),
  }));
  check("water readings", (await supabase.from("water_readings").insert(readingRows)).error);

  const users = await seedDemoUsers();
  const cleanups = await seedCleanups(users);

  console.log(`Seeded ${users.size} demo users and ${cleanups} upcoming cleanups.`);
  console.log(`Seeded ${beachRows.length} beaches, ${zoneRows.length} zones, ${readingRows.length} demo water readings.`);
}

type DemoUser = { username: string; name: string; area: string; mode: string; bio: string };

/** Demo accounts use the reserved .example domain and random passwords, so nobody can sign in as them. */
const demoEmail = (username: string) => `${username}@demo.shoreup.example`;

async function seedDemoUsers(): Promise<Map<string, string>> {
  const demoUsers = await readJson<DemoUser[]>("data/seed/demo-users.json");

  const existing = new Map<string, string>();
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    check("list users", error);
    for (const u of data.users) if (u.email) existing.set(u.email, u.id);
    if (data.users.length < 200) break;
  }

  const ids = new Map<string, string>();
  for (const demo of demoUsers) {
    let id = existing.get(demoEmail(demo.username));
    if (!id) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: demoEmail(demo.username),
        password: randomBytes(24).toString("base64url"),
        email_confirm: true,
        user_metadata: { display_name: demo.name, username: demo.username, is_adult_confirmed: true },
      });
      check(`create ${demo.username}`, error);
      id = data.user!.id;
    }
    ids.set(demo.username, id);
    // The sign-up trigger normally creates the profile row; upsert so the seed works either way.
    const { error } = await supabase
      .from("profiles")
      .upsert({ id, username: demo.username, display_name: demo.name, area: demo.area, bio: demo.bio, mode: demo.mode, is_adult_confirmed: true, directory_opt_in: true, is_hidden: false });
    check(`profile ${demo.username}`, error);
  }
  return ids;
}

/** Three upcoming cleanups, dated relative to today so the demo never goes stale. */
async function seedCleanups(users: Map<string, string>): Promise<number> {
  const at = (days: number, hourUtc: number) => {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + days);
    d.setUTCHours(hourUtc, 0, 0, 0);
    return d.toISOString();
  };
  const plans = [
    { organizer: "maya_okafor", beach: "cherry", zone: "cherry-2", starts_at: at(4, 14), notes: "Meet at the lifeguard station. Gloves, grabbers, and bags provided. Bring water.", crew: ["liam_tremblay", "sofia_rossi"] },
    { organizer: "priya_nair", beach: "bluffers-park", zone: null, starts_at: at(9, 15), notes: "Family friendly sweep of the east end. Parking fills early.", crew: ["noah_kim"] },
    { organizer: "isla_campbell", beach: "bondi", zone: "bondi-1", starts_at: at(6, 20), notes: "Dawn cleanup at the north end, coffee after.", crew: ["oliver_nguyen"] },
  ];

  const organizerIds = [...users.values()];
  check("clear demo cleanups", (await supabase.from("cleanups").delete().in("organizer_id", organizerIds)).error);

  for (const plan of plans) {
    const { data, error } = await supabase
      .from("cleanups")
      .insert({ beach_id: plan.beach, zone_id: plan.zone, organizer_id: users.get(plan.organizer), starts_at: plan.starts_at, notes: plan.notes })
      .select("id")
      .single();
    check(`cleanup at ${plan.beach}`, error);
    const attendees = plan.crew.map((username) => ({ cleanup_id: data!.id, user_id: users.get(username) }));
    check(`attendees at ${plan.beach}`, (await supabase.from("cleanup_attendees").insert(attendees)).error);
  }
  return plans.length;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
