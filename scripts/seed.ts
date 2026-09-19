/**
 * Seeds Supabase with demo data. Safe to re-run: reference rows are upserted
 * and demo water readings are replaced.
 *
 * Seeds beaches, zones, demo water readings, 20 demo users, 3 upcoming cleanups,
 * 5 communities (one hosted by a nonprofit), and 30 demo posts with public domain cleanup photos.
 *
 * Usage: pnpm seed   (needs NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local)
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { config } from "dotenv";
import type { FeatureCollection } from "geojson";
import { UNCREDITED_PHOTOS } from "../lib/images/cleanupPhotos";
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

  const community = await seedCommunities(users, beachRows, zoneStates);

  console.log(`Seeded ${community.communities} communities and ${community.posts} demo posts.`);
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

type CommunitySeed = {
  nonprofits: { slug: string; name: string; description: string; url: string | null }[];
  communities: { slug: string; name: string; area: string; beach: string; nonprofit: string | null; members: string[] }[];
  posts: { author: string; community: string; beaches: string[]; count: number }[];
  bodies: string[];
};

/**
 * Real beach cleanup photos for the demo feed, so Community News looks like the real thing.
 * Public domain photos only: feed posts show no credit line, so none may be owed.
 */
async function uploadDemoPhotos(): Promise<string[]> {
  const paths: string[] = [];
  for (const [i, photo] of UNCREDITED_PHOTOS.entries()) {
    // Already 1200 by 900 WebP, the same shape the upload route produces.
    const webp = await readFile(path.join(ROOT, "public", photo.src));
    const storagePath = `demo/cleanup-${i + 1}.webp`;
    const { error } = await supabase.storage.from("post-photos").upload(storagePath, webp, { contentType: "image/webp", upsert: true });
    check(`demo photo ${i + 1}`, error);
    paths.push(storagePath);
  }
  return paths;
}

async function seedCommunities(
  users: Map<string, string>,
  beachRows: { id: string; lng: number; lat: number }[],
  zoneStates: DemoZoneState[],
): Promise<{ communities: number; posts: number }> {
  const seed = await readJson<CommunitySeed>("data/seed/communities.json");
  const beachById = new Map(beachRows.map((b) => [b.id, b]));

  check("nonprofits", (await supabase.from("nonprofits").upsert(seed.nonprofits, { onConflict: "slug" })).error);
  const nonprofits = await supabase.from("nonprofits").select("id, slug");
  check("read nonprofits", nonprofits.error);
  const nonprofitId = new Map((nonprofits.data ?? []).map((n) => [n.slug as string, n.id as string]));

  const communityRows = seed.communities.map((c) => {
    const beach = beachById.get(c.beach)!;
    // Rounded to 2 decimals: a neighbourhood, not a meeting point.
    return { slug: c.slug, name: c.name, area: c.area, lng: Number(beach.lng.toFixed(2)), lat: Number(beach.lat.toFixed(2)), nonprofit_id: c.nonprofit ? nonprofitId.get(c.nonprofit) : null };
  });
  check("communities", (await supabase.from("communities").upsert(communityRows, { onConflict: "slug" })).error);
  const communities = await supabase.from("communities").select("id, slug");
  check("read communities", communities.error);
  const communityId = new Map((communities.data ?? []).map((c) => [c.slug as string, c.id as string]));

  const members = seed.communities.flatMap((c, ci) =>
    c.members.map((username, mi) => ({
      community_id: communityId.get(c.slug),
      user_id: users.get(username),
      // Staggered so "first community joined" is stable for people in two communities.
      joined_at: new Date(Date.now() - (90 - ci * 5 - mi) * 86_400_000).toISOString(),
    })),
  );
  check("community members", (await supabase.from("community_members").upsert(members, { onConflict: "community_id,user_id" })).error);

  // Demo posts are replaced wholesale. They fill the feeds but never change a litter score.
  check("clear demo posts", (await supabase.from("posts").delete().eq("is_demo", true)).error);
  const photos = await uploadDemoPhotos();
  const zonesByBeach = new Map<string, string[]>();
  for (const z of zoneStates) zonesByBeach.set(z.beachId, [...(zonesByBeach.get(z.beachId) ?? []), z.zoneId]);

  let n = 0;
  const postRows = seed.posts.flatMap((plan) =>
    Array.from({ length: plan.count }, (_, i) => {
      const beach = plan.beaches[i % plan.beaches.length];
      const zones = zonesByBeach.get(beach)!;
      const k = n++;
      return {
        author_id: users.get(plan.author),
        community_id: communityId.get(plan.community),
        beach_id: beach,
        zone_id: zones[k % zones.length],
        body: seed.bodies[k % seed.bodies.length],
        bags: 1 + (k % 5),
        is_demo: true,
        created_at: new Date(Date.now() - (2 + k * 2) * 86_400_000 - (k % 7) * 3_600_000).toISOString(),
      };
    }),
  );
  const inserted = await supabase.from("posts").insert(postRows).select("id");
  check("demo posts", inserted.error);
  const photoRows = (inserted.data ?? []).flatMap((post, k) =>
    Array.from({ length: 1 + (k % 3 === 0 ? 1 : 0) }, (_, j) => ({ post_id: post.id, position: j + 1, path: photos[(k + j) % photos.length] })),
  );
  check("demo post photos", (await supabase.from("post_photos").insert(photoRows)).error);

  // Badges that the demo posts would have earned.
  const badges = seed.posts.flatMap((plan) => {
    const keys = ["first_cleanup"];
    if (plan.count >= 10) keys.push("ten_cleanups");
    if (new Set(plan.beaches.slice(0, plan.count)).size >= 5) keys.push("five_beaches");
    return keys.map((achievement_key) => ({ user_id: users.get(plan.author), achievement_key }));
  });
  check("demo achievements", (await supabase.from("user_achievements").upsert(badges, { onConflict: "user_id,achievement_key", ignoreDuplicates: true })).error);

  return { communities: communityRows.length, posts: postRows.length };
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
