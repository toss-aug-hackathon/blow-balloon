-- hoo-balloon 비게임 랭킹 전용 초기 스키마
-- 사용 전 기존 랭킹 객체를 별도 초기화 SQL로 삭제하세요.

begin;

create type public.ranking_type as enum ('BALLOON_COUNT', 'LUNG_CAPACITY');

create table public.ranking_users (
  id bigint generated always as identity primary key,
  anonymous_key text not null unique,
  nickname text not null,
  public_id integer not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ranking_users_anonymous_key_valid check (
    char_length(anonymous_key) between 1 and 255
    and anonymous_key = btrim(anonymous_key)
  ),
  constraint ranking_users_nickname_valid check (
    char_length(nickname) between 2 and 12
    and nickname = btrim(nickname)
    and nickname !~ '[#[:cntrl:]]'
  )
);

create table public.ranking_scores (
  id bigint generated always as identity primary key,
  ranking_user_id bigint not null references public.ranking_users(id) on delete cascade,
  ranking_type public.ranking_type not null,
  best_score bigint not null,
  best_duration_ms bigint,
  last_submitted_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ranking_scores_user_type_unique unique (ranking_user_id, ranking_type),
  constraint ranking_scores_score_valid check (
    (ranking_type = 'BALLOON_COUNT' and best_score between 0 and 50)
    or (ranking_type = 'LUNG_CAPACITY' and best_score between 0 and 9999)
  ),
  constraint ranking_scores_duration_valid check (
    best_duration_ms is null
    or best_duration_ms between 0 and 86400000
  )
);

create index ranking_scores_lung_ranking_idx
  on public.ranking_scores (best_score desc, best_duration_ms desc nulls last, ranking_user_id)
  where ranking_type = 'LUNG_CAPACITY';

create index ranking_scores_rush_ranking_idx
  on public.ranking_scores (best_score desc, best_duration_ms asc nulls last, ranking_user_id)
  where ranking_type = 'BALLOON_COUNT';

alter table public.ranking_users enable row level security;
alter table public.ranking_scores enable row level security;
alter table public.ranking_users force row level security;
alter table public.ranking_scores force row level security;

revoke all on table public.ranking_users from public, anon, authenticated;
revoke all on table public.ranking_scores from public, anon, authenticated;
revoke all on sequence public.ranking_users_id_seq from public, anon, authenticated;
revoke all on sequence public.ranking_scores_id_seq from public, anon, authenticated;

create or replace function public.is_safe_nickname(p_nickname text)
returns boolean
language plpgsql immutable
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

create or replace function public.get_ranking_user(p_anonymous_key text)
returns table (is_registered boolean, nickname text, display_id bigint)
language sql stable security definer set search_path = ''
as $$
  select true, u.nickname, u.public_id::bigint
  from public.ranking_users u
  where u.anonymous_key = p_anonymous_key;
$$;

create or replace function public.register_ranking_user(p_anonymous_key text, p_nickname text)
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
     or char_length(p_nickname) not between 2 and 12
     or p_nickname ~ '[#[:cntrl:]]'
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

create or replace function public.update_ranking_nickname(p_anonymous_key text, p_nickname text)
returns table (nickname text, display_id bigint)
language plpgsql security definer set search_path = ''
as $$
begin
  p_nickname := btrim(p_nickname);
  if p_anonymous_key is null
     or char_length(p_anonymous_key) not between 1 and 255
     or p_anonymous_key <> btrim(p_anonymous_key)
     or p_nickname is null
     or char_length(p_nickname) not between 2 and 12
     or p_nickname ~ '[#[:cntrl:]]'
     or not public.is_safe_nickname(p_nickname) then
    raise exception using errcode = '22023', message = 'INVALID_NICKNAME';
  end if;

  update public.ranking_users set nickname = p_nickname, updated_at = now()
  where anonymous_key = p_anonymous_key;
  if not found then
    raise exception using errcode = 'P0002', message = 'USER_NOT_REGISTERED';
  end if;
  return query select u.nickname, u.public_id::bigint
  from public.ranking_users u where u.anonymous_key = p_anonymous_key;
end;
$$;

create or replace function public.submit_best_ranking_score(
  p_anonymous_key text, p_ranking_type public.ranking_type,
  p_score bigint, p_duration_ms bigint
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

  select id into v_user_id from public.ranking_users where anonymous_key = p_anonymous_key;
  if v_user_id is null then
    raise exception using errcode = 'P0002', message = 'USER_NOT_REGISTERED';
  end if;

  perform pg_catalog.pg_advisory_xact_lock(
    pg_catalog.hashtextextended(v_user_id::text || ':' || p_ranking_type::text, 0)
  );

  select best_score, best_duration_ms, last_submitted_at
    into v_previous_best_score, v_previous_duration_ms, v_last_submitted_at
  from public.ranking_scores
  where ranking_user_id = v_user_id and ranking_type = p_ranking_type;

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
      v_best_score := p_score; v_best_duration_ms := p_duration_ms;
    elsif p_score = v_previous_best_score then
      v_best_score := v_previous_best_score;
      v_best_duration_ms := case
        when v_previous_duration_ms is null then p_duration_ms
        when p_duration_ms is null then v_previous_duration_ms
        when p_ranking_type = 'LUNG_CAPACITY' then greatest(v_previous_duration_ms, p_duration_ms)
        else least(v_previous_duration_ms, p_duration_ms)
      end;
    else
      v_best_score := v_previous_best_score; v_best_duration_ms := v_previous_duration_ms;
    end if;

    update public.ranking_scores
    set best_score = v_best_score,
        best_duration_ms = v_best_duration_ms,
        last_submitted_at = now(),
        updated_at = case when v_is_new_best then now() else updated_at end
    where ranking_user_id = v_user_id and ranking_type = p_ranking_type;
    return query select v_best_score, v_best_duration_ms, v_is_new_best;
    return;
  end if;

  insert into public.ranking_scores (ranking_user_id, ranking_type, best_score, best_duration_ms)
  values (v_user_id, p_ranking_type, p_score, p_duration_ms);
  return query select p_score, p_duration_ms, true;
end;
$$;

create or replace function public.get_ranking(
  p_ranking_type public.ranking_type, p_limit integer default 100
)
returns table (rank bigint, nickname text, display_id bigint, score bigint, duration_ms bigint)
language sql stable security definer set search_path = ''
as $$
  select rank() over (
    order by s.best_score desc,
      case when p_ranking_type = 'LUNG_CAPACITY' then s.best_duration_ms end desc nulls last,
      case when p_ranking_type = 'BALLOON_COUNT' then s.best_duration_ms end asc nulls last
  )::bigint, u.nickname, u.public_id::bigint, s.best_score, s.best_duration_ms
  from public.ranking_scores s join public.ranking_users u on u.id = s.ranking_user_id
  where s.ranking_type = p_ranking_type
  order by s.best_score desc,
    case when p_ranking_type = 'LUNG_CAPACITY' then s.best_duration_ms end desc nulls last,
    case when p_ranking_type = 'BALLOON_COUNT' then s.best_duration_ms end asc nulls last,
    u.public_id asc
  limit least(greatest(coalesce(p_limit, 100), 1), 100);
$$;

create or replace function public.get_ranking_records(p_anonymous_key text)
returns table (
  nickname text, display_id bigint, ranking_type public.ranking_type,
  best_score bigint, best_duration_ms bigint, rank bigint
)
language sql stable security definer set search_path = ''
as $$
  with me as (
    select id, nickname, public_id from public.ranking_users where anonymous_key = p_anonymous_key
  ), ranking_types as (
    select unnest(enum_range(null::public.ranking_type)) as ranking_type
  )
  select me.nickname, me.public_id::bigint, rt.ranking_type,
    mine.best_score, mine.best_duration_ms,
    case when mine.best_score is null then null else (
      select count(*) + 1 from public.ranking_scores higher
      where higher.ranking_type = rt.ranking_type and (
        higher.best_score > mine.best_score or (
          higher.best_score = mine.best_score and (
            (rt.ranking_type = 'LUNG_CAPACITY' and coalesce(higher.best_duration_ms, -1) > coalesce(mine.best_duration_ms, -1))
            or (rt.ranking_type = 'BALLOON_COUNT' and coalesce(higher.best_duration_ms, 86400001) < coalesce(mine.best_duration_ms, 86400001))
          )
        )
      )
    )::bigint end
  from me cross join ranking_types rt
  left join public.ranking_scores mine on mine.ranking_user_id = me.id and mine.ranking_type = rt.ranking_type
  order by rt.ranking_type;
$$;

revoke all on function public.is_safe_nickname(text) from public, anon, authenticated;
revoke all on function public.get_ranking_user(text) from public, anon, authenticated;
revoke all on function public.register_ranking_user(text, text) from public, anon, authenticated;
revoke all on function public.update_ranking_nickname(text, text) from public, anon, authenticated;
revoke all on function public.submit_best_ranking_score(text, public.ranking_type, bigint, bigint) from public, anon, authenticated;
revoke all on function public.get_ranking(public.ranking_type, integer) from public, anon, authenticated;
revoke all on function public.get_ranking_records(text) from public, anon, authenticated;

grant execute on function public.is_safe_nickname(text) to service_role;
grant execute on function public.get_ranking_user(text) to service_role;
grant execute on function public.register_ranking_user(text, text) to service_role;
grant execute on function public.update_ranking_nickname(text, text) to service_role;
grant execute on function public.submit_best_ranking_score(text, public.ranking_type, bigint, bigint) to service_role;
grant execute on function public.get_ranking(public.ranking_type, integer) to service_role;
grant execute on function public.get_ranking_records(text) to service_role;

commit;
