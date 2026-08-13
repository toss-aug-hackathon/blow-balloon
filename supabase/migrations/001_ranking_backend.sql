-- hoo-balloon ranking backend
-- Supabase Dashboard > SQL Editor에서 전체를 한 번 실행하세요.

do $$
begin
  create type public.game_type as enum ('BALLOON_COUNT', 'LUNG_CAPACITY');
exception
  when duplicate_object then null;
end $$;

create table if not exists public.game_users (
  id bigint generated always as identity primary key,
  user_key text not null,
  nickname text not null,
  display_id bigint generated always as identity,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_users_user_key_unique unique (user_key),
  constraint game_users_display_id_unique unique (display_id),
  constraint game_users_user_key_valid check (
    char_length(user_key) between 1 and 255
    and user_key = btrim(user_key)
  ),
  constraint game_users_nickname_valid check (
    char_length(nickname) between 2 and 12
    and nickname = btrim(nickname)
    and nickname !~ '[#[:cntrl:]]'
  )
);

create table if not exists public.game_scores (
  id bigint generated always as identity primary key,
  user_id bigint not null references public.game_users(id) on delete cascade,
  game_type public.game_type not null,
  best_score bigint not null,
  last_submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint game_scores_user_game_unique unique (user_id, game_type),
  constraint game_scores_score_valid check (
    (game_type = 'BALLOON_COUNT' and best_score between 0 and 10000)
    or (game_type = 'LUNG_CAPACITY' and best_score between 0 and 86400000)
  )
);

-- 이 스크립트의 이전 버전을 실행한 프로젝트에도 제출 제한 컬럼을 추가한다.
alter table public.game_scores
  add column if not exists last_submitted_at timestamptz;

update public.game_scores
set last_submitted_at = updated_at
where last_submitted_at is null;

alter table public.game_scores
  alter column last_submitted_at set default now(),
  alter column last_submitted_at set not null;

-- 랭킹 정렬과 내 순위 계산을 함께 지원한다.
create index if not exists game_scores_ranking_idx
  on public.game_scores (game_type, best_score desc, user_id);

alter table public.game_users enable row level security;
alter table public.game_scores enable row level security;
alter table public.game_users force row level security;
alter table public.game_scores force row level security;

-- Data API의 anon/authenticated 역할이 테이블을 직접 읽거나 쓰지 못하게 한다.
revoke all on table public.game_users from anon, authenticated;
revoke all on table public.game_scores from anon, authenticated;
revoke all on sequence public.game_users_id_seq from anon, authenticated;
revoke all on sequence public.game_users_display_id_seq from anon, authenticated;
revoke all on sequence public.game_scores_id_seq from anon, authenticated;

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
    u.display_id
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
begin
  if p_user_key is null
     or char_length(p_user_key) not between 1 and 255
     or p_user_key <> btrim(p_user_key) then
    raise exception using errcode = '22023', message = 'INVALID_USER_KEY';
  end if;

  p_nickname := btrim(p_nickname);
  if p_nickname is null
     or char_length(p_nickname) not between 2 and 12
     or p_nickname ~ '[#[:cntrl:]]' then
    raise exception using errcode = '22023', message = 'INVALID_NICKNAME';
  end if;

  return query
  insert into public.game_users (user_key, nickname)
  values (p_user_key, p_nickname)
  on conflict (user_key) do update
    set user_key = excluded.user_key
  returning game_users.nickname, game_users.display_id;
end;
$$;

create or replace function public.submit_best_score(
  p_user_key text,
  p_game_type public.game_type,
  p_score bigint
)
returns table (
  best_score bigint,
  is_new_best boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id bigint;
  v_previous_best_score bigint;
  v_best_score bigint;
  v_last_submitted_at timestamptz;
  v_is_new_best boolean;
begin
  if p_user_key is null
     or char_length(p_user_key) not between 1 and 255
     or p_user_key <> btrim(p_user_key) then
    raise exception using errcode = '22023', message = 'INVALID_USER_KEY';
  end if;

  if p_game_type is null
     or p_score is null
     or (p_game_type = 'BALLOON_COUNT' and p_score not between 0 and 10000)
     or (p_game_type = 'LUNG_CAPACITY' and p_score not between 0 and 86400000) then
    raise exception using errcode = '22023', message = 'INVALID_SCORE';
  end if;

  select u.id
    into v_user_id
  from public.game_users as u
  where u.user_key = p_user_key;

  if v_user_id is null then
    raise exception using errcode = 'P0002', message = 'USER_NOT_REGISTERED';
  end if;

  -- 행이 아직 없는 최초 제출까지 사용자·게임 단위로 직렬화한다.
  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_game_type::text, 0)
  );

  select scores.best_score, scores.last_submitted_at
    into v_previous_best_score, v_last_submitted_at
  from public.game_scores as scores
  where scores.user_id = v_user_id
    and scores.game_type = p_game_type;

  if found then
    if v_last_submitted_at > now() - interval '3 seconds' then
      raise exception using
        errcode = 'P0001',
        message = 'SCORE_SUBMISSION_TOO_FREQUENT';
    end if;

    v_is_new_best := p_score > v_previous_best_score;
    v_best_score := greatest(v_previous_best_score, p_score);

    update public.game_scores as scores
    set best_score = v_best_score,
        last_submitted_at = now(),
        updated_at = case when v_is_new_best then now() else scores.updated_at end
    where scores.user_id = v_user_id
      and scores.game_type = p_game_type;

    return query select v_best_score, v_is_new_best;
    return;
  end if;

  insert into public.game_scores (user_id, game_type, best_score, last_submitted_at)
  values (v_user_id, p_game_type, p_score, now());

  return query select p_score, true;
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
    u.display_id,
    s.best_score
  from public.game_scores as s
  join public.game_users as u on u.id = s.user_id
  where s.game_type = p_game_type
  order by s.best_score desc, u.display_id asc
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
    select u.id, u.nickname, u.display_id
    from public.game_users as u
    where u.user_key = p_user_key
  ),
  game_types as (
    select unnest(enum_range(null::public.game_type)) as game_type
  )
  select
    me.nickname,
    me.display_id,
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

revoke all on function public.get_game_user(text) from public, anon, authenticated;
revoke all on function public.register_game_user(text, text) from public, anon, authenticated;
revoke all on function public.submit_best_score(text, public.game_type, bigint) from public, anon, authenticated;
revoke all on function public.get_game_ranking(public.game_type, integer) from public, anon, authenticated;
revoke all on function public.get_my_records(text) from public, anon, authenticated;

grant execute on function public.get_game_user(text) to service_role;
grant execute on function public.register_game_user(text, text) to service_role;
grant execute on function public.submit_best_score(text, public.game_type, bigint) to service_role;
grant execute on function public.get_game_ranking(public.game_type, integer) to service_role;
grant execute on function public.get_my_records(text) to service_role;
