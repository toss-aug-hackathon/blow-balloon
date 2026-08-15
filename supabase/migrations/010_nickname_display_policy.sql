-- 랭킹 카드에 맞춰 별명을 완성형 한글·영문·숫자 2~6자로 제한한다.

begin;

with normalized_nicknames as (
  select
    id,
    left(regexp_replace(nickname, '[^가-힣A-Za-z0-9]', '', 'g'), 6) as nickname
  from public.ranking_users
)
update public.ranking_users as users
set
  nickname = case
    when char_length(normalized.nickname) >= 2 then normalized.nickname
    else '풍선친구'
  end,
  updated_at = now()
from normalized_nicknames as normalized
where users.id = normalized.id
  and users.nickname is distinct from case
    when char_length(normalized.nickname) >= 2 then normalized.nickname
    else '풍선친구'
  end;

alter table public.ranking_users
  drop constraint if exists ranking_users_nickname_valid;

alter table public.ranking_users
  add constraint ranking_users_nickname_valid check (
    nickname ~ '^[가-힣A-Za-z0-9]{2,6}$'
  );

create or replace function public.register_ranking_user(
  p_anonymous_key text,
  p_nickname text
)
returns table (nickname text, display_id bigint)
language plpgsql security definer set search_path = ''
as $$
declare
  existing_user record;
  candidate integer;
begin
  p_nickname := btrim(p_nickname);
  if p_anonymous_key is null
     or char_length(p_anonymous_key) not between 1 and 255
     or p_anonymous_key <> btrim(p_anonymous_key)
     or p_nickname is null
     or p_nickname !~ '^[가-힣A-Za-z0-9]{2,6}$'
     or not public.is_safe_nickname(p_nickname) then
    raise exception using errcode = '22023', message = 'INVALID_NICKNAME';
  end if;

  select u.nickname, u.public_id into existing_user
  from public.ranking_users u where u.anonymous_key = p_anonymous_key;
  if found then
    return query select existing_user.nickname, existing_user.public_id::bigint;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('ranking-users-public-id', 0));
  loop
    candidate := 1000 + floor(random() * 9000)::integer;
    exit when not exists (select 1 from public.ranking_users where public_id = candidate);
  end loop;

  return query
  insert into public.ranking_users (anonymous_key, nickname, public_id)
  values (p_anonymous_key, p_nickname, candidate)
  returning ranking_users.nickname, ranking_users.public_id::bigint;
end;
$$;

create or replace function public.update_ranking_nickname(
  p_anonymous_key text,
  p_nickname text
)
returns table (nickname text, display_id bigint)
language plpgsql security definer set search_path = ''
as $$
begin
  p_nickname := btrim(p_nickname);
  if p_anonymous_key is null
     or char_length(p_anonymous_key) not between 1 and 255
     or p_anonymous_key <> btrim(p_anonymous_key)
     or p_nickname is null
     or p_nickname !~ '^[가-힣A-Za-z0-9]{2,6}$'
     or not public.is_safe_nickname(p_nickname) then
    raise exception using errcode = '22023', message = 'INVALID_NICKNAME';
  end if;

  update public.ranking_users
  set nickname = p_nickname, updated_at = now()
  where anonymous_key = p_anonymous_key;

  if not found then
    raise exception using errcode = 'P0002', message = 'USER_NOT_REGISTERED';
  end if;

  return query
  select u.nickname, u.public_id::bigint
  from public.ranking_users u
  where u.anonymous_key = p_anonymous_key;
end;
$$;

commit;
