-- 출시 전 랭킹 화면 확인용 더미 사용자 15명과 두 게임 기록을 추가한다.
-- 008_nongame_anonymous_identity_reset.sql 적용 후 실행한다.
-- 같은 스크립트를 다시 실행해도 동일한 mock anonymous_key의 기록만 갱신된다.

do $$
declare
  mock_anonymous_keys text[] := array[
    'mock-ranking-01', 'mock-ranking-02', 'mock-ranking-03',
    'mock-ranking-04', 'mock-ranking-05', 'mock-ranking-06',
    'mock-ranking-07', 'mock-ranking-08', 'mock-ranking-09',
    'mock-ranking-10', 'mock-ranking-11', 'mock-ranking-12',
    'mock-ranking-13', 'mock-ranking-14', 'mock-ranking-15'
  ];
  mock_nicknames text[] := array[
    '바람대장', '구름토끼', '풍선별', '말랑구름', '분홍바람',
    '둥실이', '호흡왕', '풍선여우', '파란하늘', '구름콩',
    '바람꽃', '둥실토끼', '풍선꿈', '말랑별', '바람새싹'
  ];
  item_index integer;
begin
  for item_index in 1..array_length(mock_anonymous_keys, 1) loop
    perform * from public.register_ranking_user(
      mock_anonymous_keys[item_index],
      mock_nicknames[item_index]
    );
  end loop;
end $$;

with mock_scores(anonymous_key, ranking_type, best_score, best_duration_ms) as (
  values
    ('mock-ranking-01', 'LUNG_CAPACITY'::public.ranking_type, 7820::bigint, 21400::bigint),
    ('mock-ranking-02', 'LUNG_CAPACITY'::public.ranking_type, 6910::bigint, 19800::bigint),
    ('mock-ranking-03', 'LUNG_CAPACITY'::public.ranking_type, 6150::bigint, 18700::bigint),
    ('mock-ranking-04', 'LUNG_CAPACITY'::public.ranking_type, 5480::bigint, 17200::bigint),
    ('mock-ranking-05', 'LUNG_CAPACITY'::public.ranking_type, 4810::bigint, 15900::bigint),
    ('mock-ranking-06', 'LUNG_CAPACITY'::public.ranking_type, 4270::bigint, 14800::bigint),
    ('mock-ranking-07', 'LUNG_CAPACITY'::public.ranking_type, 3650::bigint, 13600::bigint),
    ('mock-ranking-08', 'LUNG_CAPACITY'::public.ranking_type, 3210::bigint, 12900::bigint),
    ('mock-ranking-09', 'LUNG_CAPACITY'::public.ranking_type, 2780::bigint, 11700::bigint),
    ('mock-ranking-10', 'LUNG_CAPACITY'::public.ranking_type, 2310::bigint, 10800::bigint),
    ('mock-ranking-11', 'LUNG_CAPACITY'::public.ranking_type, 1880::bigint, 9700::bigint),
    ('mock-ranking-12', 'LUNG_CAPACITY'::public.ranking_type, 1490::bigint, 8800::bigint),
    ('mock-ranking-13', 'LUNG_CAPACITY'::public.ranking_type, 1120::bigint, 7900::bigint),
    ('mock-ranking-14', 'LUNG_CAPACITY'::public.ranking_type, 760::bigint, 6800::bigint),
    ('mock-ranking-15', 'LUNG_CAPACITY'::public.ranking_type, 420::bigint, 5700::bigint),
    ('mock-ranking-01', 'BALLOON_COUNT'::public.ranking_type, 38::bigint, 28600::bigint),
    ('mock-ranking-02', 'BALLOON_COUNT'::public.ranking_type, 36::bigint, 27400::bigint),
    ('mock-ranking-03', 'BALLOON_COUNT'::public.ranking_type, 34::bigint, 26300::bigint),
    ('mock-ranking-04', 'BALLOON_COUNT'::public.ranking_type, 32::bigint, 25100::bigint),
    ('mock-ranking-05', 'BALLOON_COUNT'::public.ranking_type, 30::bigint, 23900::bigint),
    ('mock-ranking-06', 'BALLOON_COUNT'::public.ranking_type, 28::bigint, 22600::bigint),
    ('mock-ranking-07', 'BALLOON_COUNT'::public.ranking_type, 26::bigint, 21400::bigint),
    ('mock-ranking-08', 'BALLOON_COUNT'::public.ranking_type, 24::bigint, 20200::bigint),
    ('mock-ranking-09', 'BALLOON_COUNT'::public.ranking_type, 22::bigint, 19100::bigint),
    ('mock-ranking-10', 'BALLOON_COUNT'::public.ranking_type, 20::bigint, 17900::bigint),
    ('mock-ranking-11', 'BALLOON_COUNT'::public.ranking_type, 18::bigint, 16700::bigint),
    ('mock-ranking-12', 'BALLOON_COUNT'::public.ranking_type, 16::bigint, 15400::bigint),
    ('mock-ranking-13', 'BALLOON_COUNT'::public.ranking_type, 14::bigint, 14200::bigint),
    ('mock-ranking-14', 'BALLOON_COUNT'::public.ranking_type, 12::bigint, 12900::bigint),
    ('mock-ranking-15', 'BALLOON_COUNT'::public.ranking_type, 10::bigint, 11600::bigint)
)
insert into public.ranking_scores (
  ranking_user_id,
  ranking_type,
  best_score,
  best_duration_ms,
  last_submitted_at,
  updated_at
)
select
  users.id,
  scores.ranking_type,
  scores.best_score,
  scores.best_duration_ms,
  now() - interval '1 day',
  now()
from mock_scores as scores
join public.ranking_users as users on users.anonymous_key = scores.anonymous_key
on conflict (ranking_user_id, ranking_type) do update
set best_score = excluded.best_score,
    best_duration_ms = excluded.best_duration_ms,
    last_submitted_at = excluded.last_submitted_at,
    updated_at = excluded.updated_at;

-- 삽입 결과 확인
select
  users.nickname,
  users.public_id,
  scores.ranking_type,
  scores.best_score,
  scores.best_duration_ms
from public.ranking_users as users
join public.ranking_scores as scores on scores.ranking_user_id = users.id
where users.anonymous_key like 'mock-ranking-%'
order by scores.ranking_type, scores.best_score desc;
