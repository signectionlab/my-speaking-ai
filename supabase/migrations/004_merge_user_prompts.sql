-- 003의 user_prompt_drafts + user_saved_prompts → user_prompts 단일 테이블
-- (003 적용 후 SQL Editor에서 실행)

-- ============================================================
-- 1) 통합 테이블
-- ============================================================
create table if not exists public.user_prompts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  language_mode text not null check (language_mode in ('english', 'korean', 'mixed')),
  prompt_kind text not null check (prompt_kind in ('draft', 'saved')),
  title text,
  content text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint user_prompts_saved_title check (
    (prompt_kind = 'draft' and title is null)
    or (prompt_kind = 'saved' and title is not null and char_length(trim(title)) > 0)
  )
);

comment on table public.user_prompts is '사용자 프롬프트: draft=언어별 자동 초안 1개, saved=이름 붙인 저장 목록';

create unique index if not exists user_prompts_one_draft_per_mode
  on public.user_prompts (user_id, language_mode)
  where prompt_kind = 'draft';

create index if not exists user_prompts_saved_list_idx
  on public.user_prompts (user_id, updated_at desc)
  where prompt_kind = 'saved';

-- ============================================================
-- 2) 기존 데이터 이전 (id 유지 → 저장 프롬프트 삭제 URL 호환)
-- ============================================================
insert into public.user_prompts (id, user_id, language_mode, prompt_kind, title, content, created_at, updated_at)
select id, user_id, language_mode, 'saved', title, content, created_at, updated_at
from public.user_saved_prompts
on conflict (id) do nothing;

insert into public.user_prompts (user_id, language_mode, prompt_kind, title, content, created_at, updated_at)
select user_id, language_mode, 'draft', null, content, updated_at, updated_at
from public.user_prompt_drafts;

-- ============================================================
-- 3) 구 테이블 제거
-- ============================================================
drop policy if exists "user_prompt_drafts: select own" on public.user_prompt_drafts;
drop policy if exists "user_prompt_drafts: insert own" on public.user_prompt_drafts;
drop policy if exists "user_prompt_drafts: update own" on public.user_prompt_drafts;
drop policy if exists "user_prompt_drafts: delete own" on public.user_prompt_drafts;

drop policy if exists "user_saved_prompts: select own" on public.user_saved_prompts;
drop policy if exists "user_saved_prompts: insert own" on public.user_saved_prompts;
drop policy if exists "user_saved_prompts: update own" on public.user_saved_prompts;
drop policy if exists "user_saved_prompts: delete own" on public.user_saved_prompts;

drop table if exists public.user_prompt_drafts;
drop table if exists public.user_saved_prompts;

-- ============================================================
-- 4) RLS
-- ============================================================
alter table public.user_prompts enable row level security;

create policy "user_prompts: select own"
  on public.user_prompts for select using (auth.uid() = user_id);
create policy "user_prompts: insert own"
  on public.user_prompts for insert with check (auth.uid() = user_id);
create policy "user_prompts: update own"
  on public.user_prompts for update using (auth.uid() = user_id);
create policy "user_prompts: delete own"
  on public.user_prompts for delete using (auth.uid() = user_id);
