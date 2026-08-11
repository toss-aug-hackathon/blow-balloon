-- 풍선 스피드런의 최대 기록을 30개로 제한한다.

-- 이전 버전에서 30개를 초과한 기록은 새 상한에 맞춰 정리한다.
update public.game_scores
set best_score = 30,
    updated_at = now()
where game_type = 'BALLOON_COUNT'
  and best_score > 30;

alter table public.game_scores
  drop constraint if exists game_scores_score_valid;

alter table public.game_scores
  add constraint game_scores_score_valid check (
    (game_type = 'BALLOON_COUNT' and best_score between 0 and 30)
    or (game_type = 'LUNG_CAPACITY' and best_score between 0 and 86400000)
  );

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
     or (p_game_type = 'BALLOON_COUNT' and p_score not between 0 and 30)
     or (p_game_type = 'LUNG_CAPACITY' and p_score not between 0 and 86400000) then
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
