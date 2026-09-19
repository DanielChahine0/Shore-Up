-- Row Level Security. Default deny everywhere, then open up the minimum.
-- The service role (seed script, Stripe webhook, forecasting service) bypasses RLS.

alter table profiles enable row level security;
alter table beaches enable row level security;
alter table zones enable row level security;
alter table water_readings enable row level security;
alter table nonprofits enable row level security;
alter table communities enable row level security;
alter table community_members enable row level security;
alter table cleanups enable row level security;
alter table cleanup_attendees enable row level security;
alter table posts enable row level security;
alter table post_photos enable row level security;
alter table post_likes enable row level security;
alter table post_reports enable row level security;
alter table user_achievements enable row level security;
alter table donations enable row level security;

-- Profiles: others read through the public_profiles view only. The base table
-- is readable and writable by its owner.
create policy "own profile read" on profiles for select using (auth.uid() = id);
create policy "own profile insert" on profiles for insert with check (auth.uid() = id);
create policy "own profile update" on profiles for update using (auth.uid() = id) with check (auth.uid() = id);

-- Reference and score data: world-readable, written by the service role only.
create policy "public read" on beaches for select using (true);
create policy "public read" on zones for select using (true);
create policy "public read" on water_readings for select using (true);
create policy "public read" on nonprofits for select using (true);
create policy "public read" on communities for select using (true);

-- Memberships
create policy "public read" on community_members for select using (true);
create policy "join as self" on community_members for insert with check (auth.uid() = user_id);
create policy "leave as self" on community_members for delete using (auth.uid() = user_id);

-- Cleanups
create policy "public read" on cleanups for select using (true);
create policy "organize as self" on cleanups for insert with check (auth.uid() = organizer_id);
create policy "organizer edits" on cleanups for update using (auth.uid() = organizer_id) with check (auth.uid() = organizer_id);
create policy "organizer cancels" on cleanups for delete using (auth.uid() = organizer_id);

create policy "public read" on cleanup_attendees for select using (true);
create policy "attend as self" on cleanup_attendees for insert with check (auth.uid() = user_id);
create policy "withdraw as self" on cleanup_attendees for delete using (auth.uid() = user_id);

-- Posts: members post to their own communities.
create policy "public read" on posts for select using (true);
create policy "members post as self" on posts for insert with check (
  auth.uid() = author_id
  and not is_demo
  and exists (select 1 from community_members m where m.community_id = posts.community_id and m.user_id = auth.uid())
);
create policy "author deletes" on posts for delete using (auth.uid() = author_id);

create policy "public read" on post_photos for select using (true);
create policy "author adds photos" on post_photos for insert with check (
  exists (select 1 from posts p where p.id = post_photos.post_id and p.author_id = auth.uid())
);

create policy "public read" on post_likes for select using (true);
create policy "like as self" on post_likes for insert with check (auth.uid() = user_id);
create policy "unlike as self" on post_likes for delete using (auth.uid() = user_id);

-- Reports are write-only for users; moderators read them with the service role.
create policy "report as self" on post_reports for insert with check (auth.uid() = reporter_id);

-- Achievements are awarded by a security definer function, never by clients.
create policy "public read" on user_achievements for select using (true);

-- Donations: no client access at all. Totals are exposed by recipient_totals.

grant select on zone_state, public_profiles, profile_stats, recipient_totals to anon, authenticated;
