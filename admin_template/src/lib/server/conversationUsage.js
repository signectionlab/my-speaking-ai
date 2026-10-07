import { normalizeUsage, sumUsages } from '$lib/realtime/realtimeUsage.js';

const PAGE_SIZE = 1000;
const MAX_ROWS = 20_000;

/**
 * @typedef {Object} UsageBillingRow
 * @property {string} user_id
 * @property {string | null} [saved_at]
 * @property {unknown} [usage]
 * @property {number | null} [usage_duration_ms]
 * @property {number | null} [usage_response_count]
 * @property {number | null} [usage_input_text_tokens]
 * @property {number | null} [usage_input_audio_tokens]
 * @property {number | null} [usage_cached_text_tokens]
 * @property {number | null} [usage_cached_audio_tokens]
 * @property {number | null} [usage_output_text_tokens]
 * @property {number | null} [usage_output_audio_tokens]
 * @property {number | null} [usage_transcription_audio_tokens]
 * @property {number | string | null} [estimated_cost_usd]
 * @property {number | string | null} [estimated_cost_krw]
 */

/**
 * @typedef {Object} UserUsageAggregate
 * @property {string} userId
 * @property {number} conversationCount
 * @property {number} measuredCount
 * @property {import('$lib/realtime/realtimeUsage.js').RealtimeUsage} usage
 * @property {number} storedCostUsd
 * @property {number} storedCostKrw
 * @property {string | null} lastActivityAt
 */

/**
 * @typedef {Object} ConversationUsageItem
 * @property {string} id
 * @property {string} savedAt
 * @property {import('$lib/realtime/realtimeUsage.js').RealtimeUsage | null} usage
 * @property {number} storedCostUsd
 */

/** @param {unknown} value */
function num(value) {
	const n = Number(value);
	return Number.isFinite(n) ? n : 0;
}

/** @param {UsageBillingRow} row */
export function usageFromBillingRow(row) {
	const fromJson = normalizeUsage(row.usage);
	if (
		fromJson &&
		(fromJson.durationMs > 0 || fromJson.responseCount > 0 || fromJson.transcriptionAudioTokens > 0)
	) {
		return fromJson;
	}

	const fromColumns = normalizeUsage({
		durationMs: row.usage_duration_ms ?? 0,
		responseCount: row.usage_response_count ?? 0,
		inputTextTokens: row.usage_input_text_tokens ?? 0,
		inputAudioTokens: row.usage_input_audio_tokens ?? 0,
		cachedTextTokens: row.usage_cached_text_tokens ?? 0,
		cachedAudioTokens: row.usage_cached_audio_tokens ?? 0,
		outputTextTokens: row.usage_output_text_tokens ?? 0,
		outputAudioTokens: row.usage_output_audio_tokens ?? 0,
		transcriptionAudioTokens: row.usage_transcription_audio_tokens ?? 0
	});

	return fromColumns;
}

/** @param {UsageBillingRow} row */
function isMeasuredRow(row) {
	const usage = usageFromBillingRow(row);
	if (!usage) return false;
	return (
		usage.durationMs > 0 ||
		usage.responseCount > 0 ||
		usage.transcriptionAudioTokens > 0 ||
		usage.inputTextTokens +
			usage.inputAudioTokens +
			usage.outputTextTokens +
			usage.outputAudioTokens >
			0
	);
}

/**
 * @param {UsageBillingRow[]} rows
 * @returns {UserUsageAggregate[]}
 */
export function aggregateUsageByUser(rows) {
	/** @type {Map<string, UserUsageAggregate>} */
	const map = new Map();

	for (const row of rows) {
		const userId = String(row.user_id || '').trim();
		if (!userId) continue;

		let entry = map.get(userId);
		if (!entry) {
			entry = {
				userId,
				conversationCount: 0,
				measuredCount: 0,
				usage: sumUsages([]),
				storedCostUsd: 0,
				storedCostKrw: 0,
				lastActivityAt: null
			};
			map.set(userId, entry);
		}

		entry.conversationCount += 1;
		const savedAt = row.saved_at ? String(row.saved_at) : null;
		if (savedAt && (!entry.lastActivityAt || savedAt > entry.lastActivityAt)) {
			entry.lastActivityAt = savedAt;
		}

		if (isMeasuredRow(row)) {
			entry.measuredCount += 1;
			const usage = usageFromBillingRow(row);
			if (usage) {
				entry.usage = sumUsages([entry.usage, usage]);
			}
			entry.storedCostUsd += num(row.estimated_cost_usd);
			entry.storedCostKrw += num(row.estimated_cost_krw);
		}
	}

	return [...map.values()].sort((a, b) => {
		const costA = a.storedCostUsd || 0;
		const costB = b.storedCostUsd || 0;
		if (costB !== costA) return costB - costA;
		return (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '');
	});
}

/** @param {string | undefined} message */
export function isUsagePermissionError(message) {
	return /permission denied|42501|not authorized|row-level security/i.test(message || '');
}

/** @param {string | undefined} message */
function missingUsageFunction(message) {
	return /admin_list_conversation_usage|does not exist|schema cache/i.test(message || '');
}

/** @param {string | undefined} message */
export function translateUsageLoadError(message) {
	if (missingUsageFunction(message) || isUsagePermissionError(message)) {
		return '사용량 조회가 DB에 아직 없습니다. Supabase SQL Editor에서 my-speaking-ai의 supabase/migrations/012_security_bounds.sql을 실행해 주세요.';
	}
	return '사용량을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.';
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {{ userId?: string }} [options]
 */
export async function listConversationUsageRows(supabase, options = {}) {
	const userId = options.userId?.trim();
	/** @type {UsageBillingRow[]} */
	const all = [];
	let from = 0;

	while (from < MAX_ROWS) {
		const { data, error } = await supabase.rpc('admin_list_conversation_usage', {
			row_limit: PAGE_SIZE,
			row_offset: from,
			target_user_id: userId || null
		});

		if (error) {
			return { rows: [], usageReady: true, error: translateUsageLoadError(error.message) };
		}

		const batch = /** @type {UsageBillingRow[]} */ (data ?? []);
		all.push(...batch);
		if (batch.length < PAGE_SIZE) break;
		from += PAGE_SIZE;
	}

	return { rows: all, usageReady: true, error: null };
}

/**
 * @param {UsageBillingRow[]} rows
 * @returns {ConversationUsageItem[]}
 */
export function mapRowsToConversationItems(rows) {
	return rows
		.map((row) => {
			const id = /** @type {UsageBillingRow & { id?: string }} */ (row).id;
			return {
				id: id ? String(id) : '',
				savedAt: row.saved_at ? String(row.saved_at) : '',
				usage: usageFromBillingRow(row),
				storedCostUsd: num(row.estimated_cost_usd)
			};
		})
		.filter((item) => item.id);
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 */
export async function listUserConversationUsage(supabase, userId) {
	const { rows, usageReady, error } = await listConversationUsageRows(supabase, { userId });
	return {
		conversations: mapRowsToConversationItems(rows),
		usageReady,
		error
	};
}

/**
 * @param {string} userId
 * @returns {UserUsageAggregate}
 */
function emptyUserUsage(userId) {
	return {
		userId,
		conversationCount: 0,
		measuredCount: 0,
		usage: sumUsages([]),
		storedCostUsd: 0,
		storedCostKrw: 0,
		lastActivityAt: null
	};
}

/**
 * @param {Array<{ id: string }>} profiles
 * @param {UserUsageAggregate[]} byUser
 */
export function mergeProfilesWithUsage(profiles, byUser) {
	/** @type {Map<string, UserUsageAggregate>} */
	const map = new Map(byUser.map((item) => [item.userId, item]));
	for (const profile of profiles) {
		if (!map.has(profile.id)) {
			map.set(profile.id, emptyUserUsage(profile.id));
		}
	}
	return [...map.values()].sort((a, b) => {
		const costA = a.storedCostUsd || 0;
		const costB = b.storedCostUsd || 0;
		if (costB !== costA) return costB - costA;
		return (b.lastActivityAt || '').localeCompare(a.lastActivityAt || '');
	});
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {Array<{ id: string }>} [profiles]
 */
export async function loadAdminUsageSummary(supabase, profiles = []) {
	const { rows, usageReady, error } = await listConversationUsageRows(supabase);
	if (error) {
		return { usageReady, byUser: [], rowsLoaded: 0, error };
	}

	const byUser = mergeProfilesWithUsage(profiles, aggregateUsageByUser(rows));

	return {
		usageReady,
		byUser,
		rowsLoaded: rows.length,
		error: null
	};
}
