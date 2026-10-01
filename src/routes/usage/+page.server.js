import { error, redirect } from '@sveltejs/kit';
import { normalizeUsage } from '$lib/realtime/realtimeUsage.js';
import { readUsdKrwRate } from '$lib/server/usdKrwRate.js';

const LIST_LIMIT = 500;

/** @param {string | undefined} message */
function missingUsageColumn(message) {
	return /usage/i.test(message || '');
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, fetch }) {
	if (!locals.user) redirect(303, '/login?redirect=%2Fusage');
	if (!locals.supabase) error(503, 'Supabase 설정이 없습니다.');

	let usageReady = true;
	let { data, error: listError } = await locals.supabase
		.from('conversation_records')
		.select('id, saved_at, usage')
		.order('saved_at', { ascending: false })
		.limit(LIST_LIMIT);

	if (listError && missingUsageColumn(listError.message)) {
		usageReady = false;
		const fallback = await locals.supabase
			.from('conversation_records')
			.select('id, saved_at')
			.order('saved_at', { ascending: false })
			.limit(LIST_LIMIT);
		data = fallback.data;
		listError = fallback.error;
	}

	if (listError) {
		error(503, '사용량을 불러오지 못했습니다. 잠시 후 다시 시도해 주세요.');
	}

	const exchange = await readUsdKrwRate(fetch);

	return {
		usageReady,
		exchange,
		conversations: (data ?? []).map((row) => ({
			id: row.id,
			savedAt: row.saved_at,
			usage: normalizeUsage(row.usage)
		}))
	};
}
