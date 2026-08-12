-- 더미 사용자를 제거하면 연결된 게임 기록도 on delete cascade로 함께 제거된다.

delete from public.game_users
where user_key like 'mock-ranking-%';
