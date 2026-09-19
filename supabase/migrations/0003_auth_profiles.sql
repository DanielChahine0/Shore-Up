-- Phase 2: profiles are created automatically on sign-up, cleanups can be
-- joined, and avatars have a storage bucket.

-- Profile on sign-up --------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  display text;
  base text;
  candidate text;
begin
  display := coalesce(
    nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'name'), ''),
    split_part(new.email, '@', 1),
    'Volunteer'
  );
  base := regexp_replace(lower(coalesce(nullif(new.raw_user_meta_data ->> 'username', ''), display)), '[^a-z0-9_]+', '_', 'g');
  base := trim(both '_' from base);
  if char_length(base) < 3 then
    base := 'volunteer';
  end if;
  base := left(base, 24);

  candidate := base;
  while exists (select 1 from profiles where username = candidate) loop
    candidate := base || '_' || substr(md5(random()::text), 1, 4);
  end loop;

  insert into profiles (id, username, display_name, avatar_url, is_adult_confirmed)
  values (
    new.id,
    candidate,
    left(display, 60),
    new.raw_user_meta_data ->> 'avatar_url',
    coalesce((new.raw_user_meta_data ->> 'is_adult_confirmed')::boolean, false)
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Cleanups -------------------------------------------------------------------

-- The organizer always attends their own cleanup.
create or replace function public.add_organizer_as_attendee()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into cleanup_attendees (cleanup_id, user_id) values (new.id, new.organizer_id)
  on conflict do nothing;
  return new;
end;
$$;

create trigger on_cleanup_created
  after insert on cleanups
  for each row execute function public.add_organizer_as_attendee();

-- Joining goes through a function so the Crew Leader badge (hosted a cleanup
-- with 5+ people) is awarded in the same transaction. Returns true when the
-- organizer just earned it.
create or replace function public.join_cleanup(target_cleanup uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  organizer uuid;
  people int;
  awarded int := 0;
begin
  if auth.uid() is null then
    raise exception 'Sign in to join a cleanup';
  end if;

  select organizer_id into organizer from cleanups where id = target_cleanup and starts_at > now();
  if organizer is null then
    raise exception 'This cleanup is not open to join';
  end if;

  insert into cleanup_attendees (cleanup_id, user_id) values (target_cleanup, auth.uid())
  on conflict do nothing;

  select count(*) into people from cleanup_attendees where cleanup_id = target_cleanup;
  if people >= 5 then
    insert into user_achievements (user_id, achievement_key) values (organizer, 'crew_leader')
    on conflict do nothing;
    get diagnostics awarded = row_count;
  end if;
  return awarded > 0;
end;
$$;

revoke all on function public.join_cleanup(uuid) from public, anon;
grant execute on function public.join_cleanup(uuid) to authenticated;

-- Attendee lists only ever show people who chose to be public.
create view cleanup_attendee_profiles as
select a.cleanup_id, a.joined_at, p.id as user_id, p.username, p.display_name, p.avatar_url, p.area
from cleanup_attendees a
join public_profiles p on p.id = a.user_id;

grant select on cleanup_attendee_profiles to anon, authenticated;

-- Avatars --------------------------------------------------------------------
-- Uploads go through the app's upload route, which strips EXIF and writes with
-- the service role. Clients can only read.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('avatars', 'avatars', true, 5242880, array['image/webp'])
on conflict (id) do nothing;
