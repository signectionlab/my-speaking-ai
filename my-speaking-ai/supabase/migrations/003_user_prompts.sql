-- 사용자별 직접 작성 프롬프트: 초안(언어별) + 저장 목록
-- (001 적용 후 SQL Editor에서 실행)
-- 적용 후 004_merge_user_prompts.sql 로 user_prompts 단일 테이블로 통합하세요.

-- ============================================================
-- 1) 언어 모드별 작성 중 초안 (기기 간 동기화)
-- ============================================================
create table if not exists public.user_prompt_drafts (
  user_id uuid not null references public.profiles (id) on delete cascade,
  language_mode text not null check (language_mode in ('english', 'korean', 'mixed')),
  content text not null default '',
  updated_at timestamptz not null default now(),
  primary key (user_id, language_mode)
);

comment on table public.user_prompt_drafts is '사용자·언어별 직접 작성 프롬프트 초안';

-- ============================================================
-- 2) 저장해 둔 프롬프트 (이름 붙여 여러 개)
-- ============================================================
create table if not exists public.user_saved_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  language_mode text not null check (language_mode in ('english', 'korean', 'mixed')),
  content text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists user_saved_prompts_user_updated_idx
  on public.user_saved_prompts (user_id, updated_at desc);

comment on table public.user_saved_prompts is '사용자가 저장한 직접 작성 프롬프트 목록';

-- ============================================================
-- 3) RLS
-- ============================================================
alter table public.user_prompt_drafts enable row level security;
alter table public.user_saved_prompts enable row level security;

create policy "user_prompt_drafts: select own"
  on public.user_prompt_drafts for select using (auth.uid() = user_id);
create policy "user_prompt_drafts: insert own"
  on public.user_prompt_drafts for insert with check (auth.uid() = user_id);
create policy "user_prompt_drafts: update own"
  on public.user_prompt_drafts for update using (auth.uid() = user_id);
create policy "user_prompt_drafts: delete own"
  on public.user_prompt_drafts for delete using (auth.uid() = user_id);

create policy "user_saved_prompts: select own"
  on public.user_saved_prompts for select using (auth.uid() = user_id);
create policy "user_saved_prompts: insert own"
  on public.user_saved_prompts for insert with check (auth.uid() = user_id);
create policy "user_saved_prompts: update own"
  on public.user_saved_prompts for update using (auth.uid() = user_id);
create policy "user_saved_prompts: delete own"
  on public.user_saved_prompts for delete using (auth.uid() = user_id);
