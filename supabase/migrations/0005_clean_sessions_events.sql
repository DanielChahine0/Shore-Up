-- Clean sessions (trash logging), trash/beach/community badges, the events
-- list, and organizer check-ins. Like posting, anything that awards a badge
-- goes through a security definer function so clients can never grant their own.

-- Clean sessions -----------------------------------------------------------------
-- A session is counted on the device while it runs (so guests can use it too)
-- and saved once, when the volunteer finishes it.

alter table profiles add column gamification_unlocked_at timestamptz;

create table clean_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles (id) on delete cascade,
  beach_id text references beaches (id),
  zone_id text references zones (id),
  started_at timestamptz not null,
  ended_at timestamptz not null default now(),
  total_items int not null check (total_items between 1 and 5000),
  check (ended_at >= started_at)
);
create index clean_sessions_user on clean_sessions (user_id, ended_at desc);

create table clean_session_items (
  session_id uuid not null references clean_sessions (id) on delete cascade,
  item_key text not null,
  count int not null check (count between 1 and 500),
  primary key (session_id, item_key)
);

alter table clean_sessions enable row level security;
alter table clean_session_items enable row level security;

-- Sessions are private to their owner. Public totals come from trash_stats.
create policy "own sessions read" on clean_sessions for select using (auth.uid() = user_id);
create policy "own session items read" on clean_session_items for select using (
  exists (select 1 from clean_sessions s where s.id = session_id and s.user_id = auth.uid())
);

-- Keep in step with lib/trash/config.ts.
create or replace function public.trash_item_keys()
returns text[]
language sql
immutable
as $$
  select array[
    'plastic_bottle', 'bottle_cap', 'cigarette_butt', 'food_wrapper', 'plastic_bag',
    'can', 'glass', 'straw', 'fishing_gear', 'foam', 'paper', 'other'
  ];
$$;

-- p_items is {"item_key": count, ...}.
-- Returns {"session_id", "total_items", "lifetime_items", "unlocked_now", "new_achievements"}.
create or replace function public.log_clean_session(
  p_started_at timestamptz,
  p_items jsonb,
  p_beach text default null,
  p_zone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  new_session uuid;
  entry record;
  session_total int := 0;
  lifetime int;
  beaches_cleaned int;
  unlocked_now boolean := false;
  earned text[] := '{}';
  candidate text;
  was_new int;
  step int;
begin
  if me is null then
    raise exception 'Sign in to save a clean session';
  end if;
  if p_items is null or jsonb_typeof(p_items) <> 'object' then
    raise exception 'Log at least one item';
  end if;
  if p_started_at is null or p_started_at > now() or p_started_at < now() - interval '1 day' then
    raise exception 'That session start time is not valid';
  end if;
  if p_zone is not null and not exists (select 1 from zones where id = p_zone and beach_id = p_beach) then
    raise exception 'That zone is not part of that beach';
  end if;
  if p_beach is not null and not exists (select 1 from beaches where id = p_beach) then
    raise exception 'That beach is not on Shore Up';
  end if;

  for entry in select key, value from jsonb_each(p_items) loop
    if not entry.key = any (trash_item_keys()) then
      raise exception 'Unknown item: %', entry.key;
    end if;
    if jsonb_typeof(entry.value) <> 'number' or (entry.value::text)::numeric <> floor((entry.value::text)::numeric)
      or (entry.value::text)::int not between 1 and 500 then
      raise exception 'Item counts must be whole numbers from 1 to 500';
    end if;
    session_total := session_total + (entry.value::text)::int;
  end loop;
  if session_total < 1 then
    raise exception 'Log at least one item';
  end if;

  insert into clean_sessions (user_id, beach_id, zone_id, started_at, total_items)
  values (me, p_beach, p_zone, p_started_at, session_total)
  returning id into new_session;

  insert into clean_session_items (session_id, item_key, count)
  select new_session, key, (value::text)::int from jsonb_each(p_items);

  -- Five items in one session opens up badges and levels.
  if session_total >= 5 then
    update profiles set gamification_unlocked_at = now()
    where id = me and gamification_unlocked_at is null;
    get diagnostics was_new = row_count;
    unlocked_now := was_new > 0;
  end if;

  select coalesce(sum(total_items), 0) into lifetime from clean_sessions where user_id = me;

  -- One trash badge per 10 items: trash_10, trash_20, ...
  step := 10;
  while step <= least(lifetime, 1000) loop
    insert into user_achievements (user_id, achievement_key) values (me, 'trash_' || step)
    on conflict do nothing;
    get diagnostics was_new = row_count;
    if was_new > 0 then
      earned := earned || ('trash_' || step);
    end if;
    step := step + 10;
  end loop;

  select count(distinct b) into beaches_cleaned from (
    select beach_id as b from clean_sessions where user_id = me and beach_id is not null
    union
    select beach_id from posts where author_id = me
  ) cleaned;

  foreach candidate in array array['first_beach', 'three_beaches', 'five_beaches'] loop
    if (candidate = 'first_beach' and beaches_cleaned >= 1)
      or (candidate = 'three_beaches' and beaches_cleaned >= 3)
      or (candidate = 'five_beaches' and beaches_cleaned >= 5) then
      insert into user_achievements (user_id, achievement_key) values (me, candidate)
      on conflict do nothing;
      get diagnostics was_new = row_count;
      if was_new > 0 then
        earned := earned || candidate;
      end if;
    end if;
  end loop;

  return jsonb_build_object(
    'session_id', new_session,
    'total_items', session_total,
    'lifetime_items', lifetime,
    'unlocked_now', unlocked_now,
    'new_achievements', to_jsonb(earned)
  );
end;
$$;

revoke all on function public.log_clean_session(timestamptz, jsonb, text, text) from public, anon;
grant execute on function public.log_clean_session(timestamptz, jsonb, text, text) to authenticated;

-- Community badges ---------------------------------------------------------------

create or replace function public.award_community_badges()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  joined int;
begin
  select count(*) into joined from community_members where user_id = new.user_id;
  insert into user_achievements (user_id, achievement_key) values (new.user_id, 'community_member')
  on conflict do nothing;
  if joined >= 3 then
    insert into user_achievements (user_id, achievement_key) values (new.user_id, 'community_connector')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

create trigger on_community_joined
  after insert on community_members
  for each row execute function public.award_community_badges();

-- Organizer check-ins ------------------------------------------------------------
-- At the end of an event the organizer ticks off who came and how much each
-- person collected. That tally is the endorsement shown on profiles.

create table cleanup_checkins (
  cleanup_id uuid not null references cleanups (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  checked_in_by uuid not null references profiles (id) on delete cascade,
  items_verified int not null default 0 check (items_verified between 0 and 5000),
  checked_in_at timestamptz not null default now(),
  primary key (cleanup_id, user_id)
);

alter table cleanup_checkins enable row level security;
create policy "public read" on cleanup_checkins for select using (true);

create or replace function public.check_in_attendee(p_cleanup uuid, p_user uuid, p_items int)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in to check people in';
  end if;
  if not exists (select 1 from cleanups where id = p_cleanup and organizer_id = auth.uid()) then
    raise exception 'Only the organizer can check people in';
  end if;
  if not exists (select 1 from cleanups where id = p_cleanup and starts_at <= now()) then
    raise exception 'Check-ins open once the cleanup has started';
  end if;
  if not exists (select 1 from cleanup_attendees where cleanup_id = p_cleanup and user_id = p_user) then
    raise exception 'That person is not registered for this cleanup';
  end if;
  if p_items is null or p_items not between 0 and 5000 then
    raise exception 'Items must be between 0 and 5000';
  end if;

  insert into cleanup_checkins (cleanup_id, user_id, checked_in_by, items_verified)
  values (p_cleanup, p_user, auth.uid(), p_items)
  on conflict (cleanup_id, user_id)
  do update set items_verified = excluded.items_verified, checked_in_at = now();
end;
$$;

create or replace function public.undo_check_in(p_cleanup uuid, p_user uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (select 1 from cleanups where id = p_cleanup and organizer_id = auth.uid()) then
    raise exception 'Only the organizer can undo a check-in';
  end if;
  delete from cleanup_checkins where cleanup_id = p_cleanup and user_id = p_user;
end;
$$;

revoke all on function public.check_in_attendee(uuid, uuid, int) from public, anon;
revoke all on function public.undo_check_in(uuid, uuid) from public, anon;
grant execute on function public.check_in_attendee(uuid, uuid, int) to authenticated;
grant execute on function public.undo_check_in(uuid, uuid) to authenticated;

-- Views ----------------------------------------------------------------------------

-- Trash totals for public profiles, and always for the viewer's own profile.
create view trash_stats as
select
  pr.id as user_id,
  pr.gamification_unlocked_at is not null as gamification_unlocked,
  (select coalesce(sum(s.total_items), 0) from clean_sessions s where s.user_id = pr.id)::int as total_items,
  (select count(*) from clean_sessions s where s.user_id = pr.id)::int as session_count,
  (select coalesce(sum(c.items_verified), 0) from cleanup_checkins c where c.user_id = pr.id)::int as verified_items,
  (select count(*) from cleanup_checkins c where c.user_id = pr.id)::int as events_attended
from profiles pr
where (pr.is_adult_confirmed and not pr.is_hidden) or pr.id = auth.uid();

-- One row per cleanup with what the events list needs. Organizer details come
-- from public_profiles, so a private organizer shows as null.
create view cleanup_overview as
select
  c.id,
  c.beach_id,
  b.name as beach_name,
  b.area as beach_area,
  b.lat as beach_lat,
  b.lng as beach_lng,
  c.zone_id,
  c.starts_at,
  c.notes,
  c.organizer_id,
  o.username as organizer_username,
  o.display_name as organizer_display_name,
  o.avatar_url as organizer_avatar_url,
  (select count(*) from cleanup_attendees a where a.cleanup_id = c.id)::int as attendee_count,
  (select count(*) from cleanup_checkins k where k.cleanup_id = c.id)::int as checked_in_count,
  (select coalesce(sum(k.items_verified), 0) from cleanup_checkins k where k.cleanup_id = c.id)::int as items_verified
from cleanups c
join beaches b on b.id = c.beach_id
left join public_profiles o on o.id = c.organizer_id;

grant select on trash_stats, cleanup_overview to anon, authenticated;
