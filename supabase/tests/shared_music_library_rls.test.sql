begin;
select plan(8);

insert into auth.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'owner@example.test'),
  ('22222222-2222-2222-2222-222222222222', 'friend@example.test'),
  ('33333333-3333-3333-3333-333333333333', 'stranger@example.test');

insert into public.music_groups (id, name, created_by)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'Test group', '11111111-1111-1111-1111-111111111111');

insert into public.group_members (group_id, user_id, member_role)
values ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', '11111111-1111-1111-1111-111111111111', 'admin');

insert into public.tracks (id, group_id, uploader_id, title, artist, album, duration, content_hash, file_name, audio_path)
values (
  'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  'Owner track',
  'Owner',
  'Test album',
  120,
  repeat('a', 64),
  'owner.mp3',
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb/audio.mp3'
);

insert into public.group_invites (token_hash, group_id, created_by, expires_at)
values (
  extensions.digest(convert_to(repeat('c', 48), 'UTF8'), 'sha256'),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
  '11111111-1111-1111-1111-111111111111',
  now() + interval '1 day'
);

set local role authenticated;
set local request.jwt.claim.sub = '22222222-2222-2222-2222-222222222222';

select is((select count(*)::integer from public.tracks), 0, 'non-members cannot read group tracks');
select is(
  public.redeem_music_group_invite(repeat('c', 48)),
  'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa'::uuid,
  'a valid invite joins the group'
);
select is((select count(*)::integer from public.tracks), 1, 'joined members can read group tracks');

select throws_ok(
  $$insert into public.tracks (group_id, uploader_id, title, artist, album, duration, content_hash, file_name, audio_path)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '11111111-1111-1111-1111-111111111111',
      'Impersonated track', 'Friend', 'Test album', 90, repeat('d', 64), 'friend.mp3',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/cccccccc-cccc-cccc-cccc-cccccccccccc/audio.mp3'
    )$$,
  '42501',
  null,
  'members cannot upload as another user'
);

select throws_ok(
  $$insert into public.tracks (group_id, uploader_id, title, artist, album, duration, content_hash, file_name, audio_path)
    values (
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      '22222222-2222-2222-2222-222222222222',
      'Missing audio', 'Friend', 'Test album', 90, repeat('e', 64), 'missing.mp3',
      'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa/22222222-2222-2222-2222-222222222222/cccccccc-cccc-cccc-cccc-cccccccccccc/audio.mp3'
    )$$,
  '42501',
  null,
  'members cannot add track metadata without their uploaded audio object'
);

select is_empty(
  $$delete from public.tracks where id = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb' returning id$$,
  'members cannot delete another member’s track'
);
select is((select count(*)::integer from public.tracks), 1, 'a denied delete leaves the uploaded track intact');

set local request.jwt.claim.sub = '33333333-3333-3333-3333-333333333333';
select throws_ok(
  $$select public.redeem_music_group_invite(repeat('c', 48))$$,
  '22023',
  null,
  'an invite cannot be redeemed twice'
);

select * from finish();
rollback;