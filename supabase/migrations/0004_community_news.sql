-- Phase 3: Community News. Posting a cleanup is one transaction that writes the
-- post and its photos and awards achievements. Feeds read from views that only
-- ever expose public author details.

-- Post photos ----------------------------------------------------------------
-- Like avatars, photos are uploaded by the app's upload route after EXIF has
-- been stripped. Clients can only read.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('post-photos', 'post-photos', true, 5242880, array['image/webp'])
on conflict (id) do nothing;

-- Posting a cleanup ------------------------------------------------------------

-- Returns {"post_id": uuid, "new_achievements": [keys earned by this post]}.
create or replace function public.create_cleanup_post(
  p_community uuid,
  p_beach text,
  p_zone text,
  p_body text,
  p_bags int,
  p_photo_paths text[],
  p_cleanup uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  me uuid := auth.uid();
  new_post uuid;
  total int;
  beaches_cleaned int;
  earned text[] := '{}';
  candidate text;
  was_new int;
  i int;
begin
  if me is null then
    raise exception 'Sign in to post a cleanup';
  end if;
  if not exists (select 1 from community_members where community_id = p_community and user_id = me) then
    raise exception 'Join this community before posting to it';
  end if;
  if not exists (select 1 from zones where id = p_zone and beach_id = p_beach) then
    raise exception 'That zone is not part of that beach';
  end if;
  if coalesce(array_length(p_photo_paths, 1), 0) not between 1 and 4 then
    raise exception 'Add between 1 and 4 photos';
  end if;
  -- Photos must be ones this user uploaded: the upload route stores them under the user's id.
  for i in 1 .. array_length(p_photo_paths, 1) loop
    if p_photo_paths[i] not like me::text || '/%' then
      raise exception 'Photos must be uploaded by you';
    end if;
  end loop;

  insert into posts (author_id, community_id, beach_id, zone_id, cleanup_id, body, bags)
  values (me, p_community, p_beach, p_zone, p_cleanup, trim(p_body), p_bags)
  returning id into new_post;

  for i in 1 .. array_length(p_photo_paths, 1) loop
    insert into post_photos (post_id, position, path) values (new_post, i, p_photo_paths[i]);
  end loop;

  select count(*), count(distinct beach_id) into total, beaches_cleaned from posts where author_id = me;

  foreach candidate in array array['first_cleanup', 'ten_cleanups', 'five_beaches'] loop
    if (candidate = 'first_cleanup' and total >= 1)
      or (candidate = 'ten_cleanups' and total >= 10)
      or (candidate = 'five_beaches' and beaches_cleaned >= 5) then
      insert into user_achievements (user_id, achievement_key) values (me, candidate)
      on conflict do nothing;
      get diagnostics was_new = row_count;
      if was_new > 0 then
        earned := earned || candidate;
      end if;
    end if;
  end loop;

  return jsonb_build_object('post_id', new_post, 'new_achievements', to_jsonb(earned));
end;
$$;

revoke all on function public.create_cleanup_post(uuid, text, text, text, int, text[], uuid) from public, anon;
grant execute on function public.create_cleanup_post(uuid, text, text, text, int, text[], uuid) to authenticated;

-- All posting goes through the function above, so direct inserts are closed.
drop policy "members post as self" on posts;
drop policy "author adds photos" on post_photos;

-- Feeds ------------------------------------------------------------------------

-- One row per post with everything a feed card needs. Author details come from
-- public_profiles, so a private author shows as null (rendered as "A volunteer").
create view post_feed as
select
  p.id,
  p.community_id,
  c.slug as community_slug,
  c.name as community_name,
  p.beach_id,
  p.zone_id,
  z.name as zone_name,
  p.body,
  p.bags,
  p.is_demo,
  p.created_at,
  p.author_id,
  pr.username as author_username,
  pr.display_name as author_display_name,
  pr.avatar_url as author_avatar_url,
  (select count(*) from post_likes l where l.post_id = p.id)::int as like_count,
  (select coalesce(array_agg(ph.path order by ph.position), '{}') from post_photos ph where ph.post_id = p.id) as photo_paths
from posts p
join communities c on c.id = p.community_id
join zones z on z.id = p.zone_id
left join public_profiles pr on pr.id = p.author_id;

create view community_overview as
select
  c.id,
  c.slug,
  c.name,
  c.area,
  c.lat,
  c.lng,
  c.created_at,
  n.id as nonprofit_id,
  n.slug as nonprofit_slug,
  n.name as nonprofit_name,
  n.description as nonprofit_description,
  n.url as nonprofit_url,
  (select count(*) from community_members m where m.community_id = c.id)::int as member_count
from communities c
left join nonprofits n on n.id = c.nonprofit_id;

-- Member lists only ever show people who chose to be public.
create view community_member_profiles as
select m.community_id, m.joined_at, p.id as user_id, p.username, p.display_name, p.avatar_url, p.area
from community_members m
join public_profiles p on p.id = m.user_id;

grant select on post_feed, community_overview, community_member_profiles to anon, authenticated;
