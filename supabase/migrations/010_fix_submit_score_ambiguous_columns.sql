-- submit_best_ranking_score의 PL/pgSQL 변수/컬럼명 충돌을 수정한다.

begin;

create or replace function public.submit_best_ranking_score(
  p_anonymous_key text,
  p_ranking_type public.ranking_type,
  p_score bigint,
  p_duration_ms bigint
)
returns table (best_score bigint, best_duration_ms bigint, is_new_best boolean)
language plpgsql security definer set search_path = ''
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
     or p_anonymous_key <> btrim(p_anonymous_key)
     or p_ranking_type is null
     or p_score is null
     or (p_ranking_type = 'BALLOON_COUNT' and p_score not between 0 and 50)
     or (p_ranking_type = 'LUNG_CAPACITY' and p_score not between 0 and 9999)
     or (p_duration_ms is not null and p_duration_ms not between 0 and 86400000) then
    raise exception using errcode = '22023', message = 'INVALID_SCORE';
  end if;

  select ru.id
    into v_user_id
  from public.ranking_users ru
  where ru.anonymous_key = p_anonymous_key;

  if v_user_id is null then
    raise exception using errcode = 'P0002', message = 'USER_NOT_REGISTERED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_ranking_type::text, 0)
  );

  select rs.best_score, rs.best_duration_ms, rs.last_submitted_at
    into v_previous_best_score, v_previous_duration_ms, v_last_submitted_at
  from public.ranking_scores rs
  where rs.ranking_user_id = v_user_id
    and rs.ranking_type = p_ranking_type;

  if found then
    if v_last_submitted_at > now() - interval '3 seconds' then
      raise exception using errcode = 'P0001', message = 'SCORE_SUBMISSION_TOO_FREQUENT';
    end if;

    v_is_new_best := p_score > v_previous_best_score
      or (p_score = v_previous_best_score and p_duration_ms is not null and (
        v_previous_duration_ms is null
        or (p_ranking_type = 'LUNG_CAPACITY' and p_duration_ms > v_previous_duration_ms)
        or (p_ranking_type = 'BALLOON_COUNT' and p_duration_ms < v_previous_duration_ms)
      ));

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

    update public.ranking_scores rs
    set best_score = v_best_score,
        best_duration_ms = v_best_duration_ms,
        last_submitted_at = now(),
        updated_at = case when v_is_new_best then now() else rs.updated_at end
    where rs.ranking_user_id = v_user_id
      and rs.ranking_type = p_ranking_type;

    return query select v_best_score, v_best_duration_ms, v_is_new_best;
    return;
  end if;

  insert into public.ranking_scores (
    ranking_user_id,
    ranking_type,
    best_score,
    best_duration_ms
  )
  values (v_user_id, p_ranking_type, p_score, p_duration_ms);

  return query select p_score, p_duration_ms, true;
end;
$$;

revoke all on function public.submit_best_ranking_score(
  text, public.ranking_type, bigint, bigint
) from public, anon, authenticated;

grant execute on function public.submit_best_ranking_score(
  text, public.ranking_type, bigint, bigint
) to service_role;

commit;
