create schema if not exists extensions;
create schema if not exists private;

create extension if not exists pgcrypto with schema extensions;

create table public.music_groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  group_id uuid not null references public.music_groups (id) on delete cascade,
  user_id uuid not null unique references auth.users (id) on delete cascade,
  member_role text not null check (member_role in ('admin', 'member')),
  created_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table public.group_invites (
  token_hash bytea primary key check (octet_length(token_hash) = 32),
  group_id uuid not null references public.music_groups (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  redeemed_by uuid unique references auth.users (id) on delete set null,
  redeemed_at timestamptz
);

create table public.tracks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.music_groups (id) on delete cascade,
  uploader_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  artist text not null,
  album text not null,
  duration real not null check (duration >= 0),
  year integer,
  genre text,
  content_hash text not null check (content_hash ~ '^[0-9a-f]{64}$'),
  file_name text not null,
  audio_path text not null unique check (
    audio_path = group_id::text || '/' || uploader_id::text || '/' || id::text || '/audio.mp3'
  ),
  artwork_path text check (
    artwork_path is null or artwork_path in (
      group_id::text || '/' || uploader_id::text || '/' || id::text || '/artwork.jpg',
      group_id::text || '/' || uploader_id::text || '/' || id::text || '/artwork.png',
      group_id::text || '/' || uploader_id::text || '/' || id::text || '/artwork.webp'
    )
  ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, id),
  unique (group_id, content_hash)
);

create table public.playlists (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.music_groups (id) on delete cascade,
  created_by uuid not null references auth.users (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (group_id, id)
);

create table public.playlist_tracks (
  group_id uuid not null,
  playlist_id uuid not null,
  track_id uuid not null,
  position integer not null check (position >= 0),
  primary key (group_id, playlist_id, track_id),
  unique (group_id, playlist_id, position),
  foreign key (group_id, playlist_id)
    references public.playlists (group_id, id) on delete cascade,
  foreign key (group_id, track_id)
    references public.tracks (group_id, id) on delete cascade
);

create table public.user_preferences (
  user_id uuid primary key references auth.users (id) on delete cascade,
  theme text not null default 'dark' check (theme in ('dark', 'light')),
  repeat_mode text not null default 'off' check (repeat_mode in ('off', 'all', 'one')),
  shuffle boolean not null default false,
  queue_track_ids uuid[] not null default '{}',
  current_index integer not null default -1,
  last_track_id uuid,
  last_position real not null default 0 check (last_position >= 0),
  updated_at timestamptz not null default now()
);

create index tracks_group_created_idx on public.tracks (group_id, created_at desc);
create index playlists_group_updated_idx on public.playlists (group_id, updated_at desc);

create function private.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.group_members as member
    where member.group_id = p_group_id
      and member.user_id = (select auth.uid())
  );
$function$;

create function private.is_group_member(p_group_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.group_members as member
    where member.group_id::text = p_group_id
      and member.user_id = (select auth.uid())
  );
$function$;

create function private.is_group_admin(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.group_members as member
    where member.group_id = p_group_id
      and member.user_id = (select auth.uid())
      and member.member_role = 'admin'
  );
$function$;

create function private.is_group_admin(p_group_id text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.group_members as member
    where member.group_id::text = p_group_id
      and member.user_id = (select auth.uid())
      and member.member_role = 'admin'
  );
$function$;

create function private.can_manage_playlist(p_group_id uuid, p_playlist_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $function$
  select exists (
    select 1
    from public.playlists as playlist
    where playlist.group_id = p_group_id
      and playlist.id = p_playlist_id
      and (
        playlist.created_by = (select auth.uid())
        or private.is_group_admin(p_group_id)
      )
  );
$function$;

create function public.create_music_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  new_group_id uuid;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in before creating a group.';
  end if;

  if p_name is null or char_length(btrim(p_name)) not between 1 and 80 then
    raise exception using errcode = '22023', message = 'Group names must be 1 to 80 characters.';
  end if;

  if exists (select 1 from public.group_members where user_id = current_user_id) then
    raise exception using errcode = '23505', message = 'This account already belongs to a group.';
  end if;

  insert into public.music_groups (name, created_by)
  values (btrim(p_name), current_user_id)
  returning id into new_group_id;

  insert into public.group_members (group_id, user_id, member_role)
  values (new_group_id, current_user_id, 'admin');

  return new_group_id;
end;
$function$;

create function public.create_music_group_invite(p_group_id uuid, p_expires_in_days integer default 7)
returns text
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  invite_code text;
begin
  if current_user_id is null or not private.is_group_admin(p_group_id) then
    raise exception using errcode = '42501', message = 'Only group admins can create invites.';
  end if;

  if p_expires_in_days not between 1 and 30 then
    raise exception using errcode = '22023', message = 'Invite expiry must be between 1 and 30 days.';
  end if;

  invite_code := encode(extensions.gen_random_bytes(24), 'hex');

  insert into public.group_invites (token_hash, group_id, created_by, expires_at)
  values (
    extensions.digest(convert_to(invite_code, 'UTF8'), 'sha256'),
    p_group_id,
    current_user_id,
    now() + make_interval(days => p_expires_in_days)
  );

  return invite_code;
end;
$function$;

create function public.redeem_music_group_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $function$
declare
  current_user_id uuid := (select auth.uid());
  invite public.group_invites%rowtype;
begin
  if current_user_id is null then
    raise exception using errcode = '42501', message = 'Sign in before joining a group.';
  end if;

  if p_invite_code is null or char_length(p_invite_code) <> 48 then
    raise exception using errcode = '22023', message = 'This invite code is invalid or expired.';
  end if;

  if exists (select 1 from public.group_members where user_id = current_user_id) then
    raise exception using errcode = '23505', message = 'This account already belongs to a group.';
  end if;

  select * into invite
  from public.group_invites
  where token_hash = extensions.digest(convert_to(p_invite_code, 'UTF8'), 'sha256')
    and redeemed_at is null
    and expires_at > now()
  for update;

  if not found then
    raise exception using errcode = '22023', message = 'This invite code is invalid or expired.';
  end if;

  insert into public.group_members (group_id, user_id, member_role)
  values (invite.group_id, current_user_id, 'member');

  update public.group_invites
  set redeemed_by = current_user_id, redeemed_at = now()
  where token_hash = invite.token_hash;

  return invite.group_id;
end;
$function$;

create function public.set_playlist_tracks(p_group_id uuid, p_playlist_id uuid, p_track_ids uuid[])
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
begin
  if not private.is_group_member(p_group_id)
    or not private.can_manage_playlist(p_group_id, p_playlist_id) then
    raise exception using errcode = '42501', message = 'You cannot edit this playlist.';
  end if;

  if p_track_ids is null
    or coalesce(array_length(p_track_ids, 1), 0) <> (
      select count(distinct requested.track_id)::integer
      from unnest(p_track_ids) as requested(track_id)
    ) then
    raise exception using errcode = '22023', message = 'Playlist tracks must be a non-null list without duplicates.';
  end if;

  if exists (
    select 1
    from unnest(p_track_ids) as requested(track_id)
    left join public.tracks as track
      on track.id = requested.track_id and track.group_id = p_group_id
    where track.id is null
  ) then
    raise exception using errcode = '22023', message = 'A playlist can only contain tracks in its group.';
  end if;

  delete from public.playlist_tracks
  where group_id = p_group_id and playlist_id = p_playlist_id;

  insert into public.playlist_tracks (group_id, playlist_id, track_id, position)
  select p_group_id, p_playlist_id, requested.track_id, requested.position::integer
  from unnest(p_track_ids) with ordinality as requested(track_id, position);

  update public.playlists
  set updated_at = now()
  where id = p_playlist_id and group_id = p_group_id;
end;
$function$;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
revoke all on function private.is_group_member(uuid) from public, anon, authenticated;
revoke all on function private.is_group_member(text) from public, anon, authenticated;
revoke all on function private.is_group_admin(uuid) from public, anon, authenticated;
revoke all on function private.is_group_admin(text) from public, anon, authenticated;
revoke all on function private.can_manage_playlist(uuid, uuid) from public, anon, authenticated;
grant execute on function private.is_group_member(uuid) to authenticated;
grant execute on function private.is_group_member(text) to authenticated;
grant execute on function private.is_group_admin(uuid) to authenticated;
grant execute on function private.is_group_admin(text) to authenticated;
grant execute on function private.can_manage_playlist(uuid, uuid) to authenticated;

revoke all on function public.create_music_group(text) from public, anon, authenticated;
revoke all on function public.create_music_group_invite(uuid, integer) from public, anon, authenticated;
revoke all on function public.redeem_music_group_invite(text) from public, anon, authenticated;
revoke all on function public.set_playlist_tracks(uuid, uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.create_music_group(text) to authenticated;
grant execute on function public.create_music_group_invite(uuid, integer) to authenticated;
grant execute on function public.redeem_music_group_invite(text) to authenticated;
grant execute on function public.set_playlist_tracks(uuid, uuid, uuid[]) to authenticated;

revoke all on table public.music_groups, public.group_members, public.group_invites,
  public.tracks, public.playlists, public.playlist_tracks, public.user_preferences
from anon, authenticated;
grant select on table public.music_groups, public.group_members to authenticated;
grant select, insert, update, delete on table public.tracks, public.playlists, public.user_preferences to authenticated;
grant select, insert, delete on table public.playlist_tracks to authenticated;

alter table public.music_groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invites enable row level security;
alter table public.tracks enable row level security;
alter table public.playlists enable row level security;
alter table public.playlist_tracks enable row level security;
alter table public.user_preferences enable row level security;

create policy "Group members can view their group"
on public.music_groups for select to authenticated
using (private.is_group_member(id));

create policy "Group members can view membership"
on public.group_members for select to authenticated
using (private.is_group_member(group_id));

create policy "Group members can view tracks"
on public.tracks for select to authenticated
using (private.is_group_member(group_id));

create policy "Group members can upload their own tracks"
on public.tracks for insert to authenticated
with check (
  uploader_id = (select auth.uid())
  and private.is_group_member(group_id)
  and exists (
    select 1
    from storage.objects as object
    where object.bucket_id = 'group-music'
      and object.name = audio_path
      and object.owner_id = (select auth.uid())::text
  )
  and (
    artwork_path is null
    or exists (
      select 1
      from storage.objects as object
      where object.bucket_id = 'group-music'
        and object.name = artwork_path
        and object.owner_id = (select auth.uid())::text
    )
  )
);

create policy "Uploaders and admins can update tracks"
on public.tracks for update to authenticated
using (
  private.is_group_member(group_id)
  and (uploader_id = (select auth.uid()) or private.is_group_admin(group_id))
)
with check (
  private.is_group_member(group_id)
  and (uploader_id = (select auth.uid()) or private.is_group_admin(group_id))
);

create policy "Uploaders and admins can delete tracks"
on public.tracks for delete to authenticated
using (
  private.is_group_member(group_id)
  and (uploader_id = (select auth.uid()) or private.is_group_admin(group_id))
);

create policy "Group members can view playlists"
on public.playlists for select to authenticated
using (private.is_group_member(group_id));

create policy "Group members can create their own playlists"
on public.playlists for insert to authenticated
with check (
  created_by = (select auth.uid())
  and private.is_group_member(group_id)
);

create policy "Playlist owners and admins can update playlists"
on public.playlists for update to authenticated
using (
  private.is_group_member(group_id)
  and (created_by = (select auth.uid()) or private.is_group_admin(group_id))
)
with check (
  private.is_group_member(group_id)
  and (created_by = (select auth.uid()) or private.is_group_admin(group_id))
);

create policy "Playlist owners and admins can delete playlists"
on public.playlists for delete to authenticated
using (
  private.is_group_member(group_id)
  and (created_by = (select auth.uid()) or private.is_group_admin(group_id))
);

create policy "Group members can view playlist tracks"
on public.playlist_tracks for select to authenticated
using (private.is_group_member(group_id));

create policy "Playlist owners and admins can add playlist tracks"
on public.playlist_tracks for insert to authenticated
with check (
  private.is_group_member(group_id)
  and private.can_manage_playlist(group_id, playlist_id)
);

create policy "Playlist owners and admins can remove playlist tracks"
on public.playlist_tracks for delete to authenticated
using (
  private.is_group_member(group_id)
  and private.can_manage_playlist(group_id, playlist_id)
);

create policy "Users can view their own preferences"
on public.user_preferences for select to authenticated
using (user_id = (select auth.uid()));

create policy "Users can create their own preferences"
on public.user_preferences for insert to authenticated
with check (user_id = (select auth.uid()));

create policy "Users can update their own preferences"
on public.user_preferences for update to authenticated
using (user_id = (select auth.uid()))
with check (user_id = (select auth.uid()));

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'group-music',
  'group-music',
  false,
  52428800,
  array['audio/mpeg', 'image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = false,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create policy "Group members can read group music"
on storage.objects for select to authenticated
using (
  bucket_id = 'group-music'
  and private.is_group_member((storage.foldername(name))[1])
);

create policy "Group members can upload group music"
on storage.objects for insert to authenticated
with check (
  bucket_id = 'group-music'
  and cardinality(storage.foldername(name)) = 3
  and private.is_group_member((storage.foldername(name))[1])
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and split_part(name, '/', 4) in ('audio.mp3', 'artwork.jpg', 'artwork.png', 'artwork.webp')
);

create policy "Uploaders can update their own files"
on storage.objects for update to authenticated
using (
  bucket_id = 'group-music'
  and cardinality(storage.foldername(name)) = 3
  and owner_id = (select auth.uid())::text
  and private.is_group_member((storage.foldername(name))[1])
  and (storage.foldername(name))[2] = (select auth.uid())::text
)
with check (
  bucket_id = 'group-music'
  and cardinality(storage.foldername(name)) = 3
  and owner_id = (select auth.uid())::text
  and private.is_group_member((storage.foldername(name))[1])
  and (storage.foldername(name))[2] = (select auth.uid())::text
);

create policy "Uploaders and admins can delete group music"
on storage.objects for delete to authenticated
using (
  bucket_id = 'group-music'
  and private.is_group_member((storage.foldername(name))[1])
  and (
    owner_id = (select auth.uid())::text
    or private.is_group_admin((storage.foldername(name))[1])
  )
);