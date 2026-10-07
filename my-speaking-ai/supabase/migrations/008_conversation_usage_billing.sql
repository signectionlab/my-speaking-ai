-- 대화별 사용 시간·토큰·예상 요금을 테이블 컬럼으로 저장
-- (007 적용 후 SQL Editor에서 실행)
-- 요금은 앱이 저장 시점의 공개 단가와 USD/KRW 환율로 계산해 넣습니다.

alter table public.conversation_records
  add column if not exists usage_duration_ms integer,
  add column if not exists usage_response_count integer,
  add column if not exists usage_input_text_tokens integer,
  add column if not exists usage_input_audio_tokens integer,
  add column if not exists usage_cached_text_tokens integer,
  add column if not exists usage_cached_audio_tokens integer,
  add column if not exists usage_output_text_tokens integer,
  add column if not exists usage_output_audio_tokens integer,
  add column if not exists usage_transcription_audio_tokens integer,
  add column if not exists estimated_cost_usd numeric(16, 8),
  add column if not exists usd_krw_rate numeric(12, 4),
  add column if not exists estimated_cost_krw numeric(14, 2);

comment on column public.conversation_records.usage_duration_ms is '세션 사용 시간(ms)';
comment on column public.conversation_records.usage_response_count is 'Realtime response.done 횟수';
comment on column public.conversation_records.usage_input_text_tokens is '텍스트 입력 토큰';
comment on column public.conversation_records.usage_input_audio_tokens is '오디오 입력 토큰';
comment on column public.conversation_records.usage_cached_text_tokens is '캐시된 텍스트 입력 토큰';
comment on column public.conversation_records.usage_cached_audio_tokens is '캐시된 오디오 입력 토큰';
comment on column public.conversation_records.usage_output_text_tokens is '텍스트 출력 토큰';
comment on column public.conversation_records.usage_output_audio_tokens is '오디오 출력 토큰';
comment on column public.conversation_records.usage_transcription_audio_tokens is 'whisper-1 전사 오디오 토큰';
comment on column public.conversation_records.estimated_cost_usd is '저장 시점 예상 요금(USD)';
comment on column public.conversation_records.usd_krw_rate is '저장 시점 1 USD당 KRW';
comment on column public.conversation_records.estimated_cost_krw is '저장 시점 예상 요금(KRW)';

-- 이미 usage jsonb만 있는 행은 토큰·시간만 컬럼으로 채웁니다. 금액은 환율이 없어 비워 둡니다.
update public.conversation_records
set
  usage_duration_ms = coalesce(usage_duration_ms, nullif(usage->>'durationMs', '')::integer),
  usage_response_count = coalesce(usage_response_count, nullif(usage->>'responseCount', '')::integer),
  usage_input_text_tokens = coalesce(usage_input_text_tokens, nullif(usage->>'inputTextTokens', '')::integer),
  usage_input_audio_tokens = coalesce(usage_input_audio_tokens, nullif(usage->>'inputAudioTokens', '')::integer),
  usage_cached_text_tokens = coalesce(usage_cached_text_tokens, nullif(usage->>'cachedTextTokens', '')::integer),
  usage_cached_audio_tokens = coalesce(usage_cached_audio_tokens, nullif(usage->>'cachedAudioTokens', '')::integer),
  usage_output_text_tokens = coalesce(usage_output_text_tokens, nullif(usage->>'outputTextTokens', '')::integer),
  usage_output_audio_tokens = coalesce(usage_output_audio_tokens, nullif(usage->>'outputAudioTokens', '')::integer),
  usage_transcription_audio_tokens = coalesce(
    usage_transcription_audio_tokens,
    nullif(usage->>'transcriptionAudioTokens', '')::integer
  )
where usage is not null;

create or replace view public.conversation_usage_billing
with (security_invoker = true) as
select
  id,
  user_id,
  saved_at,
  usage_duration_ms,
  usage_response_count,
  usage_input_text_tokens,
  usage_input_audio_tokens,
  usage_cached_text_tokens,
  usage_cached_audio_tokens,
  usage_output_text_tokens,
  usage_output_audio_tokens,
  usage_transcription_audio_tokens,
  estimated_cost_usd,
  usd_krw_rate,
  estimated_cost_krw
from public.conversation_records;

comment on view public.conversation_usage_billing is '대화별 사용 시간·토큰·예상 요금';

grant select on public.conversation_usage_billing to authenticated, service_role;
