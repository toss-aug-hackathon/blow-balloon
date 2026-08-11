-- 두 게임의 점수와 기록 시간을 함께 저장한다.
-- 기존 LUNG_CAPACITY의 best_score는 호흡 시간(ms)이었으므로 새 점수 체계와
-- 의미가 달라 해당 게임의 기존 행은 새 기록으로 다시 시작한다.

alter table public.game_scores
  add column if not exists best_duration_ms bigint;

-- 003 마이그레이션을 건너뛰었거나 이전 기록이 남아 있어도
-- 새 최대값 제약조건을 추가할 수 있도록 먼저 정리한다.
update public.game_scores
set best_score = 30,
    updated_at = now()
where game_type = 'BALLOON_COUNT'
  and best_score > 30;

delete from public.game_scores
where game_type = 'LUNG_CAPACITY';

alter table public.game_scores
  drop constraint if exists game_scores_score_valid;

alter table public.game_scores
  add constraint game_scores_score_valid check (
    (game_type = 'BALLOON_COUNT' and best_score between 0 and 30)
    or (game_type = 'LUNG_CAPACITY' and best_score between 0 and 999)
  );

alter table public.game_scores
  drop constraint if exists game_scores_duration_valid;

alter table public.game_scores
  add constraint game_scores_duration_valid check (
    best_duration_ms is null
    or best_duration_ms between 0 and 86400000
  );

drop function if exists public.submit_best_score(text, public.game_type, bigint);

create or replace function public.submit_best_score(
  p_user_key text,
  p_game_type public.game_type,
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
  if p_user_key is null
     or char_length(p_user_key) not between 1 and 255
     or p_user_key <> btrim(p_user_key) then
    raise exception using errcode = '22023', message = 'INVALID_USER_KEY';
  end if;

  if p_game_type is null
     or p_score is null
     or (p_game_type = 'BALLOON_COUNT' and p_score not between 0 and 30)
     or (p_game_type = 'LUNG_CAPACITY' and p_score not between 0 and 999)
     or p_duration_ms is not null and p_duration_ms not between 0 and 86400000 then
    raise exception using errcode = '22023', message = 'INVALID_SCORE';
  end if;

  select u.id into v_user_id
  from public.game_users as u
  where u.user_key = p_user_key;

  if v_user_id is null then
    raise exception using errcode = 'P0002', message = 'USER_NOT_REGISTERED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_game_type::text, 0)
  );

  select scores.best_score, scores.best_duration_ms, scores.last_submitted_at
    into v_previous_best_score, v_previous_duration_ms, v_last_submitted_at
  from public.game_scores as scores
  where scores.user_id = v_user_id
    and scores.game_type = p_game_type;

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
          or p_duration_ms < v_previous_duration_ms
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
        else least(v_previous_duration_ms, p_duration_ms)
      end;
    else
      v_best_score := v_previous_best_score;
      v_best_duration_ms := v_previous_duration_ms;
    end if;

    update public.game_scores as scores
    set best_score = v_best_score,
        best_duration_ms = v_best_duration_ms,
        last_submitted_at = now(),
        updated_at = case when v_is_new_best then now() else scores.updated_at end
    where scores.user_id = v_user_id
      and scores.game_type = p_game_type;

    return query select v_best_score, v_best_duration_ms, v_is_new_best;
    return;
  end if;

  insert into public.game_scores (
    user_id,
    game_type,
    best_score,
    best_duration_ms,
    last_submitted_at
  )
  values (v_user_id, p_game_type, p_score, p_duration_ms, now());

  return query select p_score, p_duration_ms, true;
end;
$$;

drop function if exists public.get_game_ranking(public.game_type, integer);

create function public.get_game_ranking(
  p_game_type public.game_type,
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
      order by s.best_score desc, s.best_duration_ms asc nulls last
    )::bigint as rank,
    u.nickname,
    u.public_id::bigint,
    s.best_score,
    s.best_duration_ms
  from public.game_scores as s
  join public.game_users as u on u.id = s.user_id
  where s.game_type = p_game_type
  order by s.best_score desc, s.best_duration_ms asc nulls last, u.public_id asc
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

drop function if exists public.get_my_records(text);

create function public.get_my_records(p_user_key text)
returns table (
  nickname text,
  display_id bigint,
  game_type public.game_type,
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
    mine.best_duration_ms,
    case
      when mine.best_score is null then null
      else (
        select count(*) + 1
        from public.game_scores as higher
        where higher.game_type = gt.game_type
          and (
            higher.best_score > mine.best_score
            or (
              higher.best_score = mine.best_score
              and coalesce(higher.best_duration_ms, 86400001)
                < coalesce(mine.best_duration_ms, 86400001)
            )
          )
      )::bigint
    end as rank
  from me
  cross join game_types as gt
  left join public.game_scores as mine
    on mine.user_id = me.id
   and mine.game_type = gt.game_type
  order by gt.game_type;
$$;

revoke all on function public.submit_best_score(text, public.game_type, bigint, bigint)
  from public, anon, authenticated;
grant execute on function public.submit_best_score(text, public.game_type, bigint, bigint)
  to service_role;
