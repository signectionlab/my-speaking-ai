-- conversation_records: 세션당 사용한 AI 설정(선생님 성격) 저장
-- (001 마이그레이션 적용 후 Supabase SQL Editor에서 실행)

alter table public.conversation_records
  add column if not exists teacher_personality text not null default 'friendly',
  add column if not exists custom_prompt_text text;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'conversation_records_teacher_personality_check'
  ) then
    alter table public.conversation_records
      add constraint conversation_records_teacher_personality_check
      check (teacher_personality in ('friendly', 'strict', 'business', 'casual', 'custom'));
  end if;
end $$;

comment on column public.conversation_records.teacher_personality is
  'AI 선생님 성격: friendly | strict | business | casual | custom';
comment on column public.conversation_records.custom_prompt_text is
  '직접 작성 프롬프트 스냅샷 (teacher_personality=custom 일 때)';
