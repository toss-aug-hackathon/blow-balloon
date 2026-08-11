-- 고정 4자리 사용자 ID와 별명 변경 기능

alter table public.game_users
  add column if not exists public_id integer;

create unique index if not exists game_users_public_id_unique
  on public.game_users (public_id)
  where public_id is not null;

do $$
declare
  user_row record;
  candidate integer;
begin
  for user_row in
    select id
    from public.game_users
    where public_id is null
    order by id
  loop
    loop
      candidate := 1000 + floor(random() * 9000)::integer;
      exit when not exists (
        select 1
        from public.game_users
        where public_id = candidate
      );
    end loop;

    update public.game_users
    set public_id = candidate
    where id = user_row.id;
  end loop;
end $$;

alter table public.game_users
  alter column public_id set not null;

create or replace function public.is_safe_nickname(p_nickname text)
returns boolean
language plpgsql
immutable
set search_path = ''
as $$
declare
  normalized text;
begin
  normalized := lower(p_nickname);
  normalized := regexp_replace(normalized, '[[:space:][:punct:][:cntrl:]]', '', 'g');
  normalized := regexp_replace(normalized, E'(.)\\1+', E'\\1', 'g');
  return normalized !~ '(시발|시이발|씨발|씨이발|ㅅㅂ|개새끼|개새|새끼|병신|븅신|지랄|존나|좆|씹|섹스|야동|포르노|자지|보지|성기|강간|창녀|걸레|fuck|shit|bitch|asshole|dick|pussy|porn|sex)';
end;
$$;

create or replace function public.get_game_user(p_user_key text)
returns table (
  is_registered boolean,
  nickname text,
  display_id bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    true,
    u.nickname,
    u.public_id::bigint
  from public.game_users as u
  where u.user_key = p_user_key;
$$;

create or replace function public.register_game_user(
  p_user_key text,
  p_nickname text
)
returns table (
  nickname text,
  display_id bigint
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  existing_user record;
  candidate integer;
begin
  if p_user_key is null
     or char_length(p_user_key) not between 1 and 255
     or p_user_key <> btrim(p_user_key) then
    raise exception using errcode = '22023', message = 'INVALID_USER_KEY';
  end if;

  p_nickname := btrim(p_nickname);
  if p_nickname is null
     or char_length(p_nickname) not between 2 and 12
     or p_nickname ~ '[#[:cntrl:]]'
     or not public.is_safe_nickname(p_nickname) then
    raise exception using errcode = '22023', message = 'INVALID_NICKNAME';
  end if;

  select u.nickname, u.public_id
    into existing_user
  from public.game_users as u
  where u.user_key = p_user_key;

  if found then
    return query select existing_user.nickname, existing_user.public_id::bigint;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('game-users-public-id', 0)
  );

  loop
    candidate := 1000 + floor(random() * 9000)::integer;
    exit when not exists (
      select 1
      from public.game_users
      where public_id = candidate
    );
  end loop;

  return query
  insert into public.game_users (user_key, nickname, public_id)
  values (p_user_key, p_nickname, candidate)
  returning game_users.nickname, game_users.public_id::bigint;
end;
$$;

create or replace function public.update_game_nickname(
  p_user_key text,
  p_nickname text
)
returns table (
  nickname text,
  display_id bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  p_nickname := btrim(p_nickname);
  if p_user_key is null
     or char_length(p_user_key) not between 1 and 255
     or p_user_key <> btrim(p_user_key)
     or p_nickname is null
     or char_length(p_nickname) not between 2 and 12
     or p_nickname ~ '[#[:cntrl:]]'
     or not public.is_safe_nickname(p_nickname) then
    raise exception using errcode = '22023', message = 'INVALID_NICKNAME';
  end if;

  update public.game_users
  set nickname = p_nickname,
      updated_at = now()
  where user_key = p_user_key;

  if not found then
    raise exception using errcode = 'P0002', message = 'USER_NOT_REGISTERED';
  end if;

  return query
  select u.nickname, u.public_id::bigint
  from public.game_users as u
  where u.user_key = p_user_key;
end;
$$;

create or replace function public.get_game_ranking(
  p_game_type public.game_type,
  p_limit integer default 100
)
returns table (
  rank bigint,
  nickname text,
  display_id bigint,
  score bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    rank() over (order by s.best_score desc)::bigint as rank,
    u.nickname,
    u.public_id::bigint,
    s.best_score
  from public.game_scores as s
  join public.game_users as u on u.id = s.user_id
  where s.game_type = p_game_type
  order by s.best_score desc, u.public_id asc
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

create or replace function public.get_my_records(p_user_key text)
returns table (
  nickname text,
  display_id bigint,
  game_type public.game_type,
  best_score bigint,
  rank bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select u.id, u.nickname, u.public_id
    from public.game_users as u
    where u.user_key = p_user_key
  ),
  game_types as (
    select unnest(enum_range(null::public.game_type)) as game_type
  )
  select
    me.nickname,
    me.public_id::bigint,
    gt.game_type,
    mine.best_score,
    case
      when mine.best_score is null then null
      else (
        select count(*) + 1
        from public.game_scores as higher
        where higher.game_type = gt.game_type
          and higher.best_score > mine.best_score
      )::bigint
    end as rank
  from me
  cross join game_types as gt
  left join public.game_scores as mine
    on mine.user_id = me.id
   and mine.game_type = gt.game_type
  order by gt.game_type;
$$;

revoke all on function public.update_game_nickname(text, text) from public, anon, authenticated;
grant execute on function public.update_game_nickname(text, text) to service_role;
revoke all on function public.is_safe_nickname(text) from public, anon, authenticated;
grant execute on function public.is_safe_nickname(text) to service_role;
