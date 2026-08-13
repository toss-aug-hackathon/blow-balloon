-- 더미 사용자를 제거하면 연결된 게임 기록도 on delete cascade로 함께 제거된다.

-- 008_nongame_anonymous_identity_reset.sql 적용 후 실행한다.
delete from public.ranking_users
where anonymous_key like 'mock-ranking-%';
