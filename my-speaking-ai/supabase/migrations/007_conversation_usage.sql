-- 대화별 OpenAI Realtime 사용량 (001 적용 후 SQL Editor에서 실행)
-- response.done 토큰과 whisper-1 전사 토큰, 세션 사용 시간을 저장합니다.

alter table public.conversation_records
  add column if not exists usage jsonb;

comment on column public.conversation_records.usage is
  'Realtime 사용량 JSON. 테이블에서 보이는 시간·토큰·요금 컬럼은 008에서 추가합니다.';
