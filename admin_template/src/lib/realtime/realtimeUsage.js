/**
 * OpenAI Realtime 사용량·예상 요금.
 * 단가는 2026-10-01 공개 가격표 기준입니다.
 * @see https://developers.openai.com/api/docs/pricing
 * @see https://developers.openai.com/api/docs/guides/realtime-costs
 * @see https://developers.openai.com/api/docs/models/gpt-realtime-2.1
 * @see https://developers.openai.com/api/docs/models/whisper-1
 */

export const REALTIME_MODEL = 'gpt-realtime-2.1';
export const TRANSCRIPTION_MODEL = 'whisper-1';

/** 100만 토큰당 USD */
export const REALTIME_RATES = {
	textInput: 4,
	textCached: 0.4,
	textOutput: 24,
	audioInput: 32,
	audioCached: 0.4,
	audioOutput: 64,
	imageInput: 5,
	imageCached: 0.5
};

/** whisper-1 전사: 음성 1분당 USD */
export const WHISPER_USD_PER_MINUTE = 0.006;

/** 사용자 음성 1토큰 = 100ms, 어시스턴트 음성 1토큰 = 50ms */
export const INPUT_AUDIO_MS_PER_TOKEN = 100;
export const OUTPUT_AUDIO_MS_PER_TOKEN = 50;

const TOKEN_CAP = 50_000_000;
const DURATION_CAP_MS = 24 * 60 * 60 * 1000;

/**
 * @typedef {{
 *   model: string,
 *   transcriptionModel: string,
 *   durationMs: number,
 *   responseCount: number,
 *   inputTextTokens: number,
 *   inputAudioTokens: number,
 *   inputImageTokens: number,
 *   cachedTextTokens: number,
 *   cachedAudioTokens: number,
 *   cachedImageTokens: number,
 *   outputTextTokens: number,
 *   outputAudioTokens: number,
 *   transcriptionAudioTokens: number
 * }} RealtimeUsage
 */

export function createEmptyUsage() {
	return {
		model: REALTIME_MODEL,
		transcriptionModel: TRANSCRIPTION_MODEL,
		durationMs: 0,
		responseCount: 0,
		inputTextTokens: 0,
		inputAudioTokens: 0,
		inputImageTokens: 0,
		cachedTextTokens: 0,
		cachedAudioTokens: 0,
		cachedImageTokens: 0,
		outputTextTokens: 0,
		outputAudioTokens: 0,
		transcriptionAudioTokens: 0
	};
}

/** @param {unknown} value */
function tokenCount(value) {
	const n = Math.floor(Number(value));
	if (!Number.isFinite(n) || n <= 0) return 0;
	return Math.min(n, TOKEN_CAP);
}

/**
 * 캐시 토큰은 입력 토큰의 일부입니다. 모달리티 합계를 넘지 않게 자릅니다.
 * @param {number} total
 * @param {number} cached
 */
function splitCached(total, cached) {
	const safeCached = Math.min(tokenCount(total), tokenCount(cached));
	return { cached: safeCached, fresh: tokenCount(total) - safeCached };
}

/**
 * @param {unknown} raw
 * @returns {RealtimeUsage | null}
 */
export function normalizeUsage(raw) {
	if (!raw || typeof raw !== 'object') return null;
	const source = /** @type {Record<string, unknown>} */ (raw);
	const duration = Math.floor(Number(source.durationMs));
	return {
		model: typeof source.model === 'string' && source.model.trim() ? source.model.trim() : REALTIME_MODEL,
		transcriptionModel:
			typeof source.transcriptionModel === 'string' && source.transcriptionModel.trim()
				? source.transcriptionModel.trim()
				: TRANSCRIPTION_MODEL,
		durationMs: Number.isFinite(duration) && duration > 0 ? Math.min(duration, DURATION_CAP_MS) : 0,
		responseCount: tokenCount(source.responseCount),
		inputTextTokens: tokenCount(source.inputTextTokens),
		inputAudioTokens: tokenCount(source.inputAudioTokens),
		inputImageTokens: tokenCount(source.inputImageTokens),
		cachedTextTokens: tokenCount(source.cachedTextTokens),
		cachedAudioTokens: tokenCount(source.cachedAudioTokens),
		cachedImageTokens: tokenCount(source.cachedImageTokens),
		outputTextTokens: tokenCount(source.outputTextTokens),
		outputAudioTokens: tokenCount(source.outputAudioTokens),
		transcriptionAudioTokens: tokenCount(source.transcriptionAudioTokens)
	};
}

/**
 * response.done 의 usage 를 누적합니다.
 * @param {RealtimeUsage} usage
 * @param {unknown} raw
 */
export function addResponseUsage(usage, raw) {
	if (!raw || typeof raw !== 'object') return usage;
	const record = /** @type {Record<string, unknown>} */ (raw);
	const details = /** @type {Record<string, unknown>} */ (
		record.input_token_details && typeof record.input_token_details === 'object'
			? record.input_token_details
			: {}
	);
	const cachedDetails = /** @type {Record<string, unknown>} */ (
		details.cached_tokens_details && typeof details.cached_tokens_details === 'object'
			? details.cached_tokens_details
			: {}
	);
	const output = /** @type {Record<string, unknown>} */ (
		record.output_token_details && typeof record.output_token_details === 'object'
			? record.output_token_details
			: {}
	);

	const inputText = tokenCount(details.text_tokens);
	const inputAudio = tokenCount(details.audio_tokens);
	const inputImage = tokenCount(details.image_tokens);
	let cachedText = tokenCount(cachedDetails.text_tokens);
	let cachedAudio = tokenCount(cachedDetails.audio_tokens);
	let cachedImage = tokenCount(cachedDetails.image_tokens);
	if (cachedText + cachedAudio + cachedImage === 0) {
		let remain = tokenCount(details.cached_tokens);
		cachedText = Math.min(inputText, remain);
		remain -= cachedText;
		cachedAudio = Math.min(inputAudio, remain);
		remain -= cachedAudio;
		cachedImage = Math.min(inputImage, remain);
	}

	return {
		...usage,
		responseCount: usage.responseCount + 1,
		inputTextTokens: usage.inputTextTokens + inputText,
		inputAudioTokens: usage.inputAudioTokens + inputAudio,
		inputImageTokens: usage.inputImageTokens + inputImage,
		cachedTextTokens: usage.cachedTextTokens + cachedText,
		cachedAudioTokens: usage.cachedAudioTokens + cachedAudio,
		cachedImageTokens: usage.cachedImageTokens + cachedImage,
		outputTextTokens: usage.outputTextTokens + tokenCount(output.text_tokens),
		outputAudioTokens: usage.outputAudioTokens + tokenCount(output.audio_tokens)
	};
}

/**
 * conversation.item.input_audio_transcription.completed 의 usage 를 누적합니다.
 * @param {RealtimeUsage} usage
 * @param {unknown} raw
 */
export function addTranscriptionUsage(usage, raw) {
	if (!raw || typeof raw !== 'object') return usage;
	const record = /** @type {Record<string, unknown>} */ (raw);
	const details = /** @type {Record<string, unknown>} */ (
		record.input_token_details && typeof record.input_token_details === 'object'
			? record.input_token_details
			: {}
	);
	const audioTokens = tokenCount(details.audio_tokens);
	const seconds = Number(record.seconds ?? record.duration_seconds);
	const fromSeconds = Number.isFinite(seconds) && seconds > 0 ? tokenCount(seconds * 10) : 0;
	return {
		...usage,
		transcriptionAudioTokens: usage.transcriptionAudioTokens + (audioTokens || fromSeconds)
	};
}

/**
 * @param {RealtimeUsage} usage
 * @param {number} durationMs
 */
export function withDuration(usage, durationMs) {
	const ms = Math.floor(Number(durationMs));
	return {
		...usage,
		durationMs: Number.isFinite(ms) && ms > 0 ? Math.min(ms, DURATION_CAP_MS) : 0
	};
}

/** @param {RealtimeUsage | null | undefined} usage */
export function hasMeasuredUsage(usage) {
	if (!usage) return false;
	return (
		usage.responseCount > 0 ||
		usage.transcriptionAudioTokens > 0 ||
		usage.inputTextTokens +
			usage.inputAudioTokens +
			usage.inputImageTokens +
			usage.outputTextTokens +
			usage.outputAudioTokens >
			0
	);
}

/**
 * @param {RealtimeUsage} usage
 */
export function estimateCost(usage) {
	const text = splitCached(usage.inputTextTokens, usage.cachedTextTokens);
	const audio = splitCached(usage.inputAudioTokens, usage.cachedAudioTokens);
	const image = splitCached(usage.inputImageTokens, usage.cachedImageTokens);
	const million = 1_000_000;
	const realtimeUsd =
		(text.fresh * REALTIME_RATES.textInput +
			text.cached * REALTIME_RATES.textCached +
			audio.fresh * REALTIME_RATES.audioInput +
			audio.cached * REALTIME_RATES.audioCached +
			image.fresh * REALTIME_RATES.imageInput +
			image.cached * REALTIME_RATES.imageCached +
			usage.outputTextTokens * REALTIME_RATES.textOutput +
			usage.outputAudioTokens * REALTIME_RATES.audioOutput) /
		million;
	const transcriptionMinutes = (usage.transcriptionAudioTokens * INPUT_AUDIO_MS_PER_TOKEN) / 1000 / 60;
	const transcriptionUsd = transcriptionMinutes * WHISPER_USD_PER_MINUTE;
	return {
		realtimeUsd,
		transcriptionUsd,
		totalUsd: realtimeUsd + transcriptionUsd,
		freshTextTokens: text.fresh,
		cachedTextTokens: text.cached,
		freshAudioTokens: audio.fresh,
		cachedAudioTokens: audio.cached,
		freshImageTokens: image.fresh,
		cachedImageTokens: image.cached
	};
}

export const USAGE_BILLING_COLUMNS = [
	'usage_duration_ms',
	'usage_response_count',
	'usage_input_text_tokens',
	'usage_input_audio_tokens',
	'usage_cached_text_tokens',
	'usage_cached_audio_tokens',
	'usage_output_text_tokens',
	'usage_output_audio_tokens',
	'usage_transcription_audio_tokens',
	'estimated_cost_usd',
	'usd_krw_rate',
	'estimated_cost_krw'
];

/** @param {number} value @param {number} digits */
function roundMoney(value, digits) {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

/**
 * conversation_records 에 그대로 들어가는 사용량·요금 컬럼.
 * @param {unknown} usage
 * @param {number | null | undefined} usdKrwRate
 */
export function usageBillingColumns(usage, usdKrwRate) {
	const normalized = normalizeUsage(usage);
	/** @type {Record<string, number | null>} */
	const empty = {};
	for (const key of USAGE_BILLING_COLUMNS) empty[key] = null;
	if (!normalized) return empty;

	const cost = estimateCost(normalized);
	const rate = Number(usdKrwRate);
	const hasRate = Number.isFinite(rate) && rate > 0;
	return {
		usage_duration_ms: normalized.durationMs,
		usage_response_count: normalized.responseCount,
		usage_input_text_tokens: normalized.inputTextTokens,
		usage_input_audio_tokens: normalized.inputAudioTokens,
		usage_cached_text_tokens: normalized.cachedTextTokens,
		usage_cached_audio_tokens: normalized.cachedAudioTokens,
		usage_output_text_tokens: normalized.outputTextTokens,
		usage_output_audio_tokens: normalized.outputAudioTokens,
		usage_transcription_audio_tokens: normalized.transcriptionAudioTokens,
		estimated_cost_usd: roundMoney(cost.totalUsd, 8),
		usd_krw_rate: hasRate ? rate : null,
		estimated_cost_krw: hasRate ? roundMoney(cost.totalUsd * rate, 2) : null
	};
}

/** @param {RealtimeUsage} usage */
export function usageTimes(usage) {
	return {
		sessionMs: usage.durationMs,
		userSpeechMs: usage.transcriptionAudioTokens * INPUT_AUDIO_MS_PER_TOKEN,
		assistantSpeechMs: usage.outputAudioTokens * OUTPUT_AUDIO_MS_PER_TOKEN
	};
}

/** @param {RealtimeUsage} usage */
export function realtimeTokenTotal(usage) {
	return (
		usage.inputTextTokens +
		usage.inputAudioTokens +
		usage.inputImageTokens +
		usage.outputTextTokens +
		usage.outputAudioTokens
	);
}

/**
 * @param {Array<RealtimeUsage | null | undefined>} list
 */
export function sumUsages(list) {
	/** @type {RealtimeUsage} */
	const total = createEmptyUsage();
	for (const item of list) {
		const usage = item ? normalizeUsage(item) : null;
		if (!usage) continue;
		total.durationMs += usage.durationMs;
		total.responseCount += usage.responseCount;
		total.inputTextTokens += usage.inputTextTokens;
		total.inputAudioTokens += usage.inputAudioTokens;
		total.inputImageTokens += usage.inputImageTokens;
		total.cachedTextTokens += usage.cachedTextTokens;
		total.cachedAudioTokens += usage.cachedAudioTokens;
		total.cachedImageTokens += usage.cachedImageTokens;
		total.outputTextTokens += usage.outputTextTokens;
		total.outputAudioTokens += usage.outputAudioTokens;
		total.transcriptionAudioTokens += usage.transcriptionAudioTokens;
	}
	return total;
}

/** @param {number} ms */
export function formatDuration(ms) {
	const safe = Math.max(0, Math.floor(Number(ms) || 0));
	const totalSeconds = Math.floor(safe / 1000);
	const hours = Math.floor(totalSeconds / 3600);
	const minutes = Math.floor((totalSeconds % 3600) / 60);
	const seconds = totalSeconds % 60;
	if (hours > 0) return `${hours}시간 ${minutes}분 ${seconds}초`;
	if (minutes > 0) return `${minutes}분 ${seconds}초`;
	return `${seconds}초`;
}

/** @param {number} amount */
export function formatUsd(amount) {
	if (!Number.isFinite(amount) || amount <= 0) return '$0.00';
	if (amount < 1) return `$${amount.toFixed(4)}`;
	return `$${amount.toFixed(2)}`;
}

/**
 * @param {number} usd
 * @param {number} usdKrwRate 1 USD당 원화
 */
export function usdToKrw(usd, usdKrwRate) {
	if (!Number.isFinite(usd) || usd <= 0 || !Number.isFinite(usdKrwRate) || usdKrwRate <= 0) return 0;
	return usd * usdKrwRate;
}

/**
 * @param {number} usd
 * @param {number} usdKrwRate
 */
export function formatKrw(usd, usdKrwRate) {
	if (!Number.isFinite(usdKrwRate) || usdKrwRate <= 0) return '';
	const won = usdToKrw(usd, usdKrwRate);
	if (usd > 0 && won < 0.5) return '1원 미만';
	const rounded = Math.round(won);
	return `${new Intl.NumberFormat('ko-KR').format(rounded)}원`;
}

/** @param {number} count */
export function formatTokenCount(count) {
	return new Intl.NumberFormat('ko-KR').format(Math.max(0, Math.round(Number(count) || 0)));
}

/**
 * 말풍선 하나의 입력·출력 모델과 토큰.
 * @typedef {{
 *   inputModel: string,
 *   outputModel: string,
 *   inputTextTokens: number,
 *   inputAudioTokens: number,
 *   inputImageTokens: number,
 *   cachedTextTokens: number,
 *   cachedAudioTokens: number,
 *   outputTextTokens: number,
 *   outputAudioTokens: number
 * }} MessageTurnUsage
 */

/**
 * @param {unknown} raw
 * @returns {MessageTurnUsage | null}
 */
export function normalizeTurnUsage(raw) {
	if (!raw || typeof raw !== 'object') return null;
	const record = /** @type {Record<string, unknown>} */ (raw);
	const inputModel = typeof record.inputModel === 'string' ? record.inputModel.trim() : '';
	const outputModel = typeof record.outputModel === 'string' ? record.outputModel.trim() : '';
	if (!inputModel && !outputModel) return null;
	return {
		inputModel: inputModel || outputModel,
		outputModel: outputModel || inputModel,
		inputTextTokens: tokenCount(record.inputTextTokens),
		inputAudioTokens: tokenCount(record.inputAudioTokens),
		inputImageTokens: tokenCount(record.inputImageTokens),
		cachedTextTokens: tokenCount(record.cachedTextTokens),
		cachedAudioTokens: tokenCount(record.cachedAudioTokens),
		outputTextTokens: tokenCount(record.outputTextTokens),
		outputAudioTokens: tokenCount(record.outputAudioTokens)
	};
}

/**
 * @param {string} model
 * @param {RealtimeUsage} usage
 * @param {{ outputTextTokens?: number, outputAudioTokens?: number }} [output]
 * @returns {MessageTurnUsage}
 */
function turnFromUsage(model, usage, output = {}) {
	return {
		inputModel: model,
		outputModel: model,
		inputTextTokens: usage.inputTextTokens,
		inputAudioTokens: usage.inputAudioTokens,
		inputImageTokens: usage.inputImageTokens,
		cachedTextTokens: usage.cachedTextTokens,
		cachedAudioTokens: usage.cachedAudioTokens,
		outputTextTokens: output.outputTextTokens ?? usage.outputTextTokens,
		outputAudioTokens: output.outputAudioTokens ?? usage.outputAudioTokens
	};
}

/**
 * response.done 한 건의 입력·출력 토큰.
 * @param {unknown} raw
 * @param {string} [model]
 * @returns {MessageTurnUsage | null}
 */
export function describeResponseTurn(raw, model = REALTIME_MODEL) {
	if (!raw || typeof raw !== 'object') return null;
	const usage = addResponseUsage(createEmptyUsage(), raw);
	const name = model.trim() || REALTIME_MODEL;
	return turnFromUsage(name, usage);
}

/**
 * 입력 음성 전사 한 건. 입력은 오디오, 출력은 전사 텍스트입니다.
 * @param {unknown} raw
 * @param {string} [model]
 * @returns {MessageTurnUsage | null}
 */
export function describeTranscriptionTurn(raw, model = TRANSCRIPTION_MODEL) {
	if (!raw || typeof raw !== 'object') return null;
	const record = /** @type {Record<string, unknown>} */ (raw);
	const details = /** @type {Record<string, unknown>} */ (
		record.input_token_details && typeof record.input_token_details === 'object'
			? record.input_token_details
			: {}
	);
	const outputDetails = /** @type {Record<string, unknown>} */ (
		record.output_token_details && typeof record.output_token_details === 'object'
			? record.output_token_details
			: {}
	);
	const audioTokens = tokenCount(details.audio_tokens);
	const seconds = Number(record.seconds ?? record.duration_seconds);
	const fromSeconds = Number.isFinite(seconds) && seconds > 0 ? tokenCount(seconds * 10) : 0;
	const outputText = tokenCount(outputDetails.text_tokens) || tokenCount(record.output_tokens);
	const name = model.trim() || TRANSCRIPTION_MODEL;
	return {
		inputModel: name,
		outputModel: name,
		inputTextTokens: tokenCount(details.text_tokens),
		inputAudioTokens: audioTokens || fromSeconds,
		inputImageTokens: 0,
		cachedTextTokens: 0,
		cachedAudioTokens: 0,
		outputTextTokens: outputText,
		outputAudioTokens: tokenCount(outputDetails.audio_tokens)
	};
}

/** @param {MessageTurnUsage | null | undefined} turn */
export function formatTurnUsageLines(turn) {
	if (!turn) return [];
	/** @param {Array<[number, string]>} parts */
	const joinParts = (parts) => {
		const labeled = parts.filter(([count]) => count > 0).map(([count, label]) => `${label} ${formatTokenCount(count)}`);
		return labeled.length > 0 ? labeled.join(' · ') : '0 토큰';
	};
	const cached = turn.cachedTextTokens + turn.cachedAudioTokens;
	const input = joinParts([
		[turn.inputTextTokens, '텍스트'],
		[turn.inputAudioTokens, '오디오'],
		[turn.inputImageTokens, '이미지'],
		[cached, '캐시']
	]);
	const output = joinParts([
		[turn.outputTextTokens, '텍스트'],
		[turn.outputAudioTokens, '오디오']
	]);
	return [`입력 ${turn.inputModel} · ${input}`, `출력 ${turn.outputModel} · ${output}`];
}
