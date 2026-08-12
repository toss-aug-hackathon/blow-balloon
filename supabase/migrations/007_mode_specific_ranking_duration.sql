-- 모드별 시간의 의미를 반영한다.
-- 크게 불기: 점수 내림차순, 동점이면 호흡 시간 내림차순.
-- 스피드런: 개수 내림차순, 동점이면 마지막 완성 시간 오름차순.

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
     or (p_game_type = 'BALLOON_COUNT' and p_score not between 0 and 50)
     or (p_game_type = 'LUNG_CAPACITY' and p_score not between 0 and 9999)
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
          or (p_game_type = 'LUNG_CAPACITY' and p_duration_ms > v_previous_duration_ms)
          or (p_game_type = 'BALLOON_COUNT' and p_duration_ms < v_previous_duration_ms)
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
        when p_game_type = 'LUNG_CAPACITY' then greatest(v_previous_duration_ms, p_duration_ms)
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

create or replace function public.get_game_ranking(
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
      order by
        s.best_score desc,
        case when p_game_type = 'LUNG_CAPACITY' then s.best_duration_ms end desc nulls last,
        case when p_game_type = 'BALLOON_COUNT' then s.best_duration_ms end asc nulls last
    )::bigint as rank,
    u.nickname,
    u.public_id::bigint,
    s.best_score,
    s.best_duration_ms
  from public.game_scores as s
  join public.game_users as u on u.id = s.user_id
  where s.game_type = p_game_type
  order by
    s.best_score desc,
    case when p_game_type = 'LUNG_CAPACITY' then s.best_duration_ms end desc nulls last,
    case when p_game_type = 'BALLOON_COUNT' then s.best_duration_ms end asc nulls last,
    u.public_id asc
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

create or replace function public.get_my_records(p_user_key text)
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
              and (
                (
                  gt.game_type = 'LUNG_CAPACITY'
                  and coalesce(higher.best_duration_ms, -1)
                    > coalesce(mine.best_duration_ms, -1)
                )
                or (
                  gt.game_type = 'BALLOON_COUNT'
                  and coalesce(higher.best_duration_ms, 86400001)
                    < coalesce(mine.best_duration_ms, 86400001)
                )
              )
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

revoke all on function public.get_game_ranking(public.game_type, integer)
  from public, anon, authenticated;
grant execute on function public.get_game_ranking(public.game_type, integer)
  to service_role;

revoke all on function public.get_my_records(text)
  from public, anon, authenticated;
grant execute on function public.get_my_records(text)
  to service_role;
