-- 프로필 최근 수정 시각 (005 적용 후 SQL Editor에서 실행)
-- 이름·전화번호 저장 시각만 앱에서 기록합니다. 회화/프롬프트 저장용 profiles upsert는 이 값을 바꾸지 않습니다.

alter table public.profiles
  add column if not exists updated_at timestamptz;

comment on column public.profiles.updated_at is '이름·연락처를 마지막으로 저장한 시각';

update public.profiles
set updated_at = coalesce(onboarding_completed_at, created_at)
where updated_at is null;
