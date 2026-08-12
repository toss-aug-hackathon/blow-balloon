-- 크게 불기 점수를 4자리(0~9999) 체계로 확장한다.

alter table public.game_scores
  drop constraint if exists game_scores_score_valid;

alter table public.game_scores
  add constraint game_scores_score_valid check (
    (game_type = 'BALLOON_COUNT' and best_score between 0 and 30)
    or (game_type = 'LUNG_CAPACITY' and best_score between 0 and 9999)
  );

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
