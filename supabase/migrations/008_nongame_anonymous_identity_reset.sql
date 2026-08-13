-- 비게임 전환: 개발 단계의 기존 게임 식별키/랭킹을 초기화하고
-- getAnonymousKey() 기반 익명 식별 스키마로 전환한다.

begin;

-- 기존 함수가 public.game_type을 참조하므로 타입 이름 변경 전에 제거한다.
drop function if exists public.get_game_user(text);
drop function if exists public.register_game_user(text, text);
drop function if exists public.update_game_nickname(text, text);
drop function if exists public.submit_best_score(text, public.game_type, bigint);
drop function if exists public.submit_best_score(text, public.game_type, bigint, bigint);
drop function if exists public.get_game_ranking(public.game_type, integer);
drop function if exists public.get_my_records(text);

-- 개발 데이터는 사용자 결정에 따라 복구 없이 초기화한다.
truncate table public.game_scores, public.game_users restart identity cascade;

-- 002에서 public_id로 교체된 이전 identity 표시 ID를 제거한다.
alter table public.game_users drop column if exists display_id;

drop index if exists public.game_scores_ranking_idx;
drop index if exists public.game_users_public_id_unique;

alter table public.game_users rename to ranking_users;
alter table public.game_scores rename to ranking_scores;
alter type public.game_type rename to ranking_type;

alter table public.ranking_users rename column user_key to anonymous_key;
alter table public.ranking_scores rename column user_id to ranking_user_id;
alter table public.ranking_scores rename column game_type to ranking_type;

alter table public.ranking_users
  rename constraint game_users_pkey to ranking_users_pkey;
alter table public.ranking_users
  rename constraint game_users_user_key_unique to ranking_users_anonymous_key_unique;
alter table public.ranking_users
  rename constraint game_users_user_key_valid to ranking_users_anonymous_key_valid;
alter table public.ranking_users
  rename constraint game_users_nickname_valid to ranking_users_nickname_valid;

alter table public.ranking_scores
  rename constraint game_scores_pkey to ranking_scores_pkey;
alter table public.ranking_scores
  rename constraint game_scores_user_game_unique to ranking_scores_user_type_unique;
alter table public.ranking_scores
  rename constraint game_scores_user_id_fkey to ranking_scores_user_id_fkey;
alter table public.ranking_scores
  rename constraint game_scores_score_valid to ranking_scores_score_valid;
alter table public.ranking_scores
  rename constraint game_scores_duration_valid to ranking_scores_duration_valid;

alter sequence if exists public.game_users_id_seq rename to ranking_users_id_seq;
alter sequence if exists public.game_scores_id_seq rename to ranking_scores_id_seq;

create unique index ranking_users_public_id_unique
  on public.ranking_users (public_id);

create index ranking_scores_lung_ranking_idx
  on public.ranking_scores (
    best_score desc,
    best_duration_ms desc nulls last,
    ranking_user_id
  )
  where ranking_type = 'LUNG_CAPACITY';

create index ranking_scores_rush_ranking_idx
  on public.ranking_scores (
    best_score desc,
    best_duration_ms asc nulls last,
    ranking_user_id
  )
  where ranking_type = 'BALLOON_COUNT';

alter table public.ranking_users enable row level security;
alter table public.ranking_scores enable row level security;
alter table public.ranking_users force row level security;
alter table public.ranking_scores force row level security;

revoke all on table public.ranking_users from public, anon, authenticated;
revoke all on table public.ranking_scores from public, anon, authenticated;
revoke all on sequence public.ranking_users_id_seq from public, anon, authenticated;
revoke all on sequence public.ranking_scores_id_seq from public, anon, authenticated;

create or replace function public.get_ranking_user(p_anonymous_key text)
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
  from public.ranking_users as u
  where u.anonymous_key = p_anonymous_key;
$$;

create or replace function public.register_ranking_user(
  p_anonymous_key text,
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
  if p_anonymous_key is null
     or char_length(p_anonymous_key) not between 1 and 255
     or p_anonymous_key <> btrim(p_anonymous_key) then
    raise exception using errcode = '22023', message = 'INVALID_ANONYMOUS_KEY';
  end if;

  p_nickname := btrim(p_nickname);
  if p_nickname is null
     or char_length(p_nickname) not between 2 and 15
     or p_nickname ~ '[#[:cntrl:]]'
     or not public.is_safe_nickname(p_nickname) then
    raise exception using errcode = '22023', message = 'INVALID_NICKNAME';
  end if;

  select u.nickname, u.public_id
    into existing_user
  from public.ranking_users as u
  where u.anonymous_key = p_anonymous_key;

  if found then
    return query select existing_user.nickname, existing_user.public_id::bigint;
    return;
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended('ranking-users-public-id', 0)
  );

  loop
    candidate := 1000 + floor(random() * 9000)::integer;
    exit when not exists (
      select 1
      from public.ranking_users
      where public_id = candidate
    );
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
  if p_anonymous_key is null
     or char_length(p_anonymous_key) not between 1 and 255
     or p_anonymous_key <> btrim(p_anonymous_key)
     or p_nickname is null
     or char_length(p_nickname) not between 2 and 15
     or p_nickname ~ '[#[:cntrl:]]'
     or not public.is_safe_nickname(p_nickname) then
    raise exception using errcode = '22023', message = 'INVALID_NICKNAME';
  end if;

  update public.ranking_users
  set nickname = p_nickname,
      updated_at = now()
  where anonymous_key = p_anonymous_key;

  if not found then
    raise exception using errcode = 'P0002', message = 'USER_NOT_REGISTERED';
  end if;

  return query
  select u.nickname, u.public_id::bigint
  from public.ranking_users as u
  where u.anonymous_key = p_anonymous_key;
end;
$$;

create or replace function public.submit_best_ranking_score(
  p_anonymous_key text,
  p_ranking_type public.ranking_type,
  p_score bigint,
  p_duration_ms bigint
)
returns table (
  best_score bigint,
  best_duration_ms bigint,
  is_new_best boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id bigint;
  v_previous_best_score bigint;
  v_previous_duration_ms bigint;
  v_best_score bigint;
  v_best_duration_ms bigint;
  v_last_submitted_at timestamptz;
  v_is_new_best boolean;
begin
  if p_anonymous_key is null
     or char_length(p_anonymous_key) not between 1 and 255
     or p_anonymous_key <> btrim(p_anonymous_key) then
    raise exception using errcode = '22023', message = 'INVALID_ANONYMOUS_KEY';
  end if;

  if p_ranking_type is null
     or p_score is null
     or (p_ranking_type = 'BALLOON_COUNT' and p_score not between 0 and 50)
     or (p_ranking_type = 'LUNG_CAPACITY' and p_score not between 0 and 9999)
     or p_duration_ms is not null and p_duration_ms not between 0 and 86400000 then
    raise exception using errcode = '22023', message = 'INVALID_SCORE';
  end if;

  select u.id into v_user_id
  from public.ranking_users as u
  where u.anonymous_key = p_anonymous_key;

  if v_user_id is null then
    raise exception using errcode = 'P0002', message = 'USER_NOT_REGISTERED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_ranking_type::text, 0)
  );

  select scores.best_score, scores.best_duration_ms, scores.last_submitted_at
    into v_previous_best_score, v_previous_duration_ms, v_last_submitted_at
  from public.ranking_scores as scores
  where scores.ranking_user_id = v_user_id
    and scores.ranking_type = p_ranking_type;

  if found then
    if v_last_submitted_at > now() - interval '3 seconds' then
      raise exception using
        errcode = 'P0001',
        message = 'SCORE_SUBMISSION_TOO_FREQUENT';
    end if;

    v_is_new_best :=
      p_score > v_previous_best_score
      or (
        p_score = v_previous_best_score
        and p_duration_ms is not null
        and (
          v_previous_duration_ms is null
          or (p_ranking_type = 'LUNG_CAPACITY' and p_duration_ms > v_previous_duration_ms)
          or (p_ranking_type = 'BALLOON_COUNT' and p_duration_ms < v_previous_duration_ms)
        )
      );

    if p_score > v_previous_best_score then
      v_best_score := p_score;
      v_best_duration_ms := p_duration_ms;
    elsif p_score = v_previous_best_score then
      v_best_score := v_previous_best_score;
      v_best_duration_ms := case
        when v_previous_duration_ms is null then p_duration_ms
        when p_duration_ms is null then v_previous_duration_ms
        when p_ranking_type = 'LUNG_CAPACITY' then greatest(v_previous_duration_ms, p_duration_ms)
        else least(v_previous_duration_ms, p_duration_ms)
      end;
    else
      v_best_score := v_previous_best_score;
      v_best_duration_ms := v_previous_duration_ms;
    end if;

    update public.ranking_scores as scores
    set best_score = v_best_score,
        best_duration_ms = v_best_duration_ms,
        last_submitted_at = now(),
        updated_at = case when v_is_new_best then now() else scores.updated_at end
    where scores.ranking_user_id = v_user_id
      and scores.ranking_type = p_ranking_type;

    return query select v_best_score, v_best_duration_ms, v_is_new_best;
    return;
  end if;

  insert into public.ranking_scores (
    ranking_user_id,
    ranking_type,
    best_score,
    best_duration_ms,
    last_submitted_at
  )
  values (v_user_id, p_ranking_type, p_score, p_duration_ms, now());

  return query select p_score, p_duration_ms, true;
end;
$$;

create or replace function public.get_ranking(
  p_ranking_type public.ranking_type,
  p_limit integer default 100
)
returns table (
  rank bigint,
  nickname text,
  display_id bigint,
  score bigint,
  duration_ms bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    rank() over (
      order by
        s.best_score desc,
        case when p_ranking_type = 'LUNG_CAPACITY' then s.best_duration_ms end desc nulls last,
        case when p_ranking_type = 'BALLOON_COUNT' then s.best_duration_ms end asc nulls last
    )::bigint as rank,
    u.nickname,
    u.public_id::bigint,
    s.best_score,
    s.best_duration_ms
  from public.ranking_scores as s
  join public.ranking_users as u on u.id = s.ranking_user_id
  where s.ranking_type = p_ranking_type
  order by
    s.best_score desc,
    case when p_ranking_type = 'LUNG_CAPACITY' then s.best_duration_ms end desc nulls last,
    case when p_ranking_type = 'BALLOON_COUNT' then s.best_duration_ms end asc nulls last,
    u.public_id asc
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

create or replace function public.get_ranking_records(p_anonymous_key text)
returns table (
  nickname text,
  display_id bigint,
  ranking_type public.ranking_type,
  best_score bigint,
  best_duration_ms bigint,
  rank bigint
)
language sql
stable
security definer
set search_path = ''
as $$
  with me as (
    select u.id, u.nickname, u.public_id
    from public.ranking_users as u
    where u.anonymous_key = p_anonymous_key
  ),
  ranking_types as (
    select unnest(enum_range(null::public.ranking_type)) as ranking_type
  )
  select
    me.nickname,
    me.public_id::bigint,
    rt.ranking_type,
    mine.best_score,
    mine.best_duration_ms,
    case
      when mine.best_score is null then null
      else (
        select count(*) + 1
        from public.ranking_scores as higher
        where higher.ranking_type = rt.ranking_type
          and (
            higher.best_score > mine.best_score
            or (
              higher.best_score = mine.best_score
              and (
                (
                  rt.ranking_type = 'LUNG_CAPACITY'
                  and coalesce(higher.best_duration_ms, -1)
                    > coalesce(mine.best_duration_ms, -1)
                )
                or (
                  rt.ranking_type = 'BALLOON_COUNT'
                  and coalesce(higher.best_duration_ms, 86400001)
                    < coalesce(mine.best_duration_ms, 86400001)
                )
              )
            )
          )
      )::bigint
    end as rank
  from me
  cross join ranking_types as rt
  left join public.ranking_scores as mine
    on mine.ranking_user_id = me.id
   and mine.ranking_type = rt.ranking_type
  order by rt.ranking_type;
$$;

revoke all on function public.get_ranking_user(text)
  from public, anon, authenticated;
revoke all on function public.register_ranking_user(text, text)
  from public, anon, authenticated;
revoke all on function public.update_ranking_nickname(text, text)
  from public, anon, authenticated;
revoke all on function public.submit_best_ranking_score(
  text,
  public.ranking_type,
  bigint,
  bigint
) from public, anon, authenticated;
revoke all on function public.get_ranking(public.ranking_type, integer)
  from public, anon, authenticated;
revoke all on function public.get_ranking_records(text)
  from public, anon, authenticated;
revoke all on function public.is_safe_nickname(text)
  from public, anon, authenticated;

grant execute on function public.get_ranking_user(text) to service_role;
grant execute on function public.register_ranking_user(text, text) to service_role;
grant execute on function public.update_ranking_nickname(text, text) to service_role;
grant execute on function public.submit_best_ranking_score(
  text,
  public.ranking_type,
  bigint,
  bigint
) to service_role;
grant execute on function public.get_ranking(public.ranking_type, integer)
  to service_role;
grant execute on function public.get_ranking_records(text) to service_role;
grant execute on function public.is_safe_nickname(text) to service_role;

commit;
