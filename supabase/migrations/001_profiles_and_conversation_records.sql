-- Supabase SQL Editor에서 실행하거나, CLI 마이그레이션으로 적용할 수 있습니다.
-- profiles: auth.users 와 1:1 앱 사용자
-- conversation_records: 사용자별 영어 회화 저장 (SavedConversation 형식)

-- ============================================================
-- 1) 사용자 (앱 프로필) — auth.users 와 1:1
-- ============================================================
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  created_at timestamptz not null default now()
);

comment on table public.profiles is 'Supabase 로그인 계정과 1:1 연결되는 앱 사용자';

-- ============================================================
-- 2) 영어 회화 기록 — 사용자별 저장
--    (앱의 SavedConversation: id, savedAt, level, vadPreset, languageMode, messages)
-- ============================================================
create table public.conversation_records (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  saved_at timestamptz not null default now(),
  level text not null,
  vad_preset text not null,
  language_mode text,
  messages jsonb not null default '[]'::jsonb
    check (jsonb_typeof(messages) = 'array'),
  created_at timestamptz not null default now()
);

create index conversation_records_user_saved_at_idx
  on public.conversation_records (user_id, saved_at desc);

comment on table public.conversation_records is '사용자별 영어 회화 저장 기록';
comment on column public.conversation_records.messages is
  '[{"role":"user"|"assistant","text":"..."}, ...]';

-- ============================================================
-- 3) RLS — 본인 데이터만 읽기/쓰기 (필수에 가깝게 최소만)
-- ============================================================
alter table public.profiles enable row level security;
alter table public.conversation_records enable row level security;

create policy "profiles: select own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: insert own"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: update own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "conversation_records: select own"
  on public.conversation_records for select
  using (auth.uid() = user_id);

create policy "conversation_records: insert own"
  on public.conversation_records for insert
  with check (auth.uid() = user_id);

create policy "conversation_records: update own"
  on public.conversation_records for update
  using (auth.uid() = user_id);

create policy "conversation_records: delete own"
  on public.conversation_records for delete
  using (auth.uid() = user_id);

-- ============================================================
-- 4) (선택) 가입 시 profiles 자동 생성 — 트리거 1개만 추가
--    이 블록을 빼면, 앱에서 첫 로그인 시 profiles upsert 하면 됩니다.
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- 5) (선택) 이미 가입해 둔 계정이 있으면 profiles만 한 번 채우기
-- ============================================================
insert into public.profiles (id, email)
select id, coalesce(email, '')
from auth.users
on conflict (id) do nothing;
