-- Shore Up schema. Beach and zone geometry lives in the repo (data/geo/*.geojson);
-- the database holds state: water readings, cleanups, people, and donations.

create type water_status as enum ('safe', 'caution', 'unsafe');
create type data_source as enum ('demo', 'official', 'model', 'volunteer');
create type user_mode as enum ('looking_for_volunteers', 'joining', 'solo', 'break');
create type recipient_type as enum ('volunteer', 'nonprofit');
create type donation_status as enum ('pending', 'paid');

-- People -------------------------------------------------------------------

create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  username text not null unique check (username ~ '^[a-z0-9_]{3,30}$'),
  display_name text not null check (char_length(display_name) between 1 and 60),
  bio text not null default '' check (char_length(bio) <= 500),
  -- City or neighbourhood only. Exact locations are never stored.
  area text not null default '' check (char_length(area) <= 80),
  avatar_url text,
  mode user_mode not null default 'joining',
  is_adult_confirmed boolean not null default false,
  directory_opt_in boolean not null default false,
  is_hidden boolean not null default false,
  created_at timestamptz not null default now()
);

-- Beaches ------------------------------------------------------------------

create table beaches (
  id text primary key,
  name text not null,
  area text not null,
  country text not null,
  lng double precision not null,
  lat double precision not null,
  osm_id text not null
);

create table zones (
  id text primary key,
  beach_id text not null references beaches (id) on delete cascade,
  name text not null,
  position int not null,
  -- Demo litter: until a volunteer posts a cleanup, the zone reads as last
  -- cleaned this many days ago, so seeded scores stay stable over time.
  demo_last_cleaned_days int not null default 3 check (demo_last_cleaned_days >= 0),
  unique (beach_id, position)
);

-- Append-only. The latest row per zone wins. The Python forecasting service
-- will insert rows with source = 'model'; nothing else changes.
create table water_readings (
  id bigint generated always as identity primary key,
  zone_id text not null references zones (id) on delete cascade,
  status water_status not null,
  source data_source not null,
  observed_at timestamptz not null default now()
);
create index water_readings_zone_latest on water_readings (zone_id, observed_at desc);

-- Communities --------------------------------------------------------------

create table nonprofits (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text not null default '',
  url text
);

create table communities (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  area text not null,
  -- Rounded to 2 decimals (about 1 km). Used only for "near me" sorting.
  lng numeric(6, 2) not null,
  lat numeric(5, 2) not null,
  nonprofit_id uuid references nonprofits (id) on delete set null,
  created_at timestamptz not null default now()
);

create table community_members (
  community_id uuid not null references communities (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);
create index community_members_user on community_members (user_id, joined_at);

-- Cleanups -----------------------------------------------------------------

create table cleanups (
  id uuid primary key default gen_random_uuid(),
  beach_id text not null references beaches (id),
  zone_id text references zones (id),
  organizer_id uuid not null references profiles (id) on delete cascade,
  community_id uuid references communities (id) on delete set null,
  host_nonprofit_id uuid references nonprofits (id) on delete set null,
  starts_at timestamptz not null,
  notes text not null default '' check (char_length(notes) <= 1000),
  created_at timestamptz not null default now()
);
create index cleanups_beach_upcoming on cleanups (beach_id, starts_at);

create table cleanup_attendees (
  cleanup_id uuid not null references cleanups (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (cleanup_id, user_id)
);

-- Community News -----------------------------------------------------------

create table posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles (id) on delete cascade,
  community_id uuid not null references communities (id) on delete cascade,
  beach_id text not null references beaches (id),
  zone_id text not null references zones (id),
  cleanup_id uuid references cleanups (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  bags int not null default 0 check (bags between 0 and 500),
  -- Seeded demo posts fill the feed but never change a zone's litter score.
  is_demo boolean not null default false,
  created_at timestamptz not null default now()
);
create index posts_community_feed on posts (community_id, created_at desc);
create index posts_beach_feed on posts (beach_id, created_at desc);
create index posts_zone_latest on posts (zone_id, created_at desc) where not is_demo;

create table post_photos (
  post_id uuid not null references posts (id) on delete cascade,
  position int not null check (position between 1 and 4),
  path text not null,
  primary key (post_id, position)
);

create table post_likes (
  post_id uuid not null references posts (id) on delete cascade,
  user_id uuid not null references profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (post_id, user_id)
);

create table post_reports (
  id bigint generated always as identity primary key,
  post_id uuid not null references posts (id) on delete cascade,
  reporter_id uuid not null references profiles (id) on delete cascade,
  reason text not null default '' check (char_length(reason) <= 500),
  created_at timestamptz not null default now(),
  unique (post_id, reporter_id)
);

create table user_achievements (
  user_id uuid not null references profiles (id) on delete cascade,
  achievement_key text not null,
  earned_at timestamptz not null default now(),
  primary key (user_id, achievement_key)
);

-- Donations ----------------------------------------------------------------

create table donations (
  id uuid primary key default gen_random_uuid(),
  stripe_session_id text not null unique,
  recipient_type recipient_type not null,
  -- profiles.id for a volunteer, nonprofits.id for a nonprofit.
  recipient_id uuid not null,
  community_id uuid references communities (id) on delete set null,
  cleanup_id uuid references cleanups (id) on delete set null,
  donor_id uuid references profiles (id) on delete set null,
  amount_cents int not null check (amount_cents > 0),
  currency text not null default 'cad',
  status donation_status not null default 'pending',
  created_at timestamptz not null default now(),
  paid_at timestamptz
);
create index donations_recipient on donations (recipient_type, recipient_id) where status = 'paid';

-- Views --------------------------------------------------------------------
-- security_invoker = false (the default) is deliberate on the public views
-- below: each exposes only safe columns and rows, while RLS keeps the base
-- tables private.

-- Inputs for getBeachZones(): latest water reading and latest real cleanup per zone.
create view zone_state as
select
  z.id as zone_id,
  z.beach_id,
  z.name,
  z.position,
  w.status as water_status,
  w.source as water_source,
  w.observed_at as water_observed_at,
  coalesce(p.created_at, now() - make_interval(days => z.demo_last_cleaned_days)) as last_cleaned_at,
  (case when p.created_at is null then 'demo' else 'volunteer' end)::data_source as litter_source
from zones z
join lateral (
  select status, source, observed_at from water_readings r
  where r.zone_id = z.id order by observed_at desc limit 1
) w on true
left join lateral (
  select created_at from posts p
  where p.zone_id = z.id and not p.is_demo order by created_at desc limit 1
) p on true;

-- Only adults who have not hidden their profile are ever visible to others.
create view public_profiles as
select id, username, display_name, bio, area, avatar_url, mode, directory_opt_in, created_at
from profiles
where is_adult_confirmed and not is_hidden;

create view profile_stats as
select
  pr.id as user_id,
  count(po.id)::int as total_cleanups,
  count(distinct po.beach_id)::int as beaches_cleaned,
  coalesce(sum(po.bags), 0)::int as bags_collected
from profiles pr
left join posts po on po.author_id = pr.id
where pr.is_adult_confirmed and not pr.is_hidden
group by pr.id;

create view recipient_totals as
select recipient_type, recipient_id, sum(amount_cents)::int as total_cents, count(*)::int as donation_count
from donations
where status = 'paid'
group by recipient_type, recipient_id;
