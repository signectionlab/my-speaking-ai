import { json } from '@sveltejs/kit';
import {
	payloadToInsertRow,
	rowToSavedConversation
} from '$lib/realtime/conversationRecords.js';
import { normalizeUsage, USAGE_BILLING_COLUMNS, usageBillingColumns } from '$lib/realtime/realtimeUsage.js';
import { readUsdKrwRate } from '$lib/server/usdKrwRate.js';
import { isTeacherPersonalityId } from '$lib/realtime/tutorPersonalities.js';

const MAX_LIST = 50;
const MAX_MESSAGES = 500;
const MAX_MESSAGE_TEXT = 8000;
const RECORD_COLUMNS =
	'id, saved_at, level, vad_preset, language_mode, teacher_personality, custom_prompt_text, messages, usage';
const RECORD_COLUMNS_WITHOUT_USAGE =
	'id, saved_at, level, vad_preset, language_mode, teacher_personality, custom_prompt_text, messages';

/** @param {string | undefined} message */
function missingUsageColumn(message) {
	return /usage/i.test(message || '');
}

/** @param {string | undefined} message */
function missingBillingColumn(message) {
	return /usage_|estimated_cost|usd_krw_rate/i.test(message || '');
}

/** @param {Record<string, unknown>} row */
function withoutBillingColumns(row) {
	const next = { ...row };
	for (const key of USAGE_BILLING_COLUMNS) delete next[key];
	return next;
}

/** @param {unknown} value */
function isNonEmptyString(value) {
	return typeof value === 'string' && value.trim().length > 0;
}

/** @param {unknown} body */
function parseInsertBody(body) {
	if (!body || typeof body !== 'object') return { error: '요청 본문이 올바르지 않습니다.' };

	const savedAt = body.savedAt;
	const level = body.level;
	const vadPreset = body.vadPreset;
	const languageMode = body.languageMode;
	const messages = body.messages;
	const teacherPersonality = body.teacherPersonality;
	const customPromptText = body.customPromptText;
	const usage = body.usage;

	if (!isNonEmptyString(savedAt) || Number.isNaN(Date.parse(savedAt))) {
		return { error: '사용 시각(savedAt)이 올바르지 않습니다.' };
	}
	if (!isNonEmptyString(level) || !isNonEmptyString(vadPreset)) {
		return { error: '레벨 또는 VAD 설정이 누락되었습니다.' };
	}
	if (!Array.isArray(messages)) return { error: 'messages 배열이 필요합니다.' };
	if (messages.length > MAX_MESSAGES) {
		return { error: `메시지는 최대 ${MAX_MESSAGES}개까지 저장할 수 있습니다.` };
	}

	for (const item of messages) {
		if (!item || typeof item !== 'object') return { error: '메시지 형식이 올바르지 않습니다.' };
		const role = item.role;
		const text = item.text;
		if (role !== 'user' && role !== 'assistant' && role !== 'system') {
			return { error: '메시지 role은 user, assistant, system 만 허용됩니다.' };
		}
		if (typeof text !== 'string') return { error: '메시지 text는 문자열이어야 합니다.' };
		if (text.length > MAX_MESSAGE_TEXT) {
			return { error: `메시지 한 건은 ${MAX_MESSAGE_TEXT}자까지 저장할 수 있습니다.` };
		}
	}

	if (teacherPersonality !== undefined && !isTeacherPersonalityId(teacherPersonality)) {
		return { error: 'teacherPersonality 값이 올바르지 않습니다.' };
	}
	if (customPromptText !== undefined && typeof customPromptText !== 'string') {
		return { error: 'customPromptText는 문자열이어야 합니다.' };
	}
	if (usage !== undefined && usage !== null && typeof usage !== 'object') {
		return { error: 'usage 형식이 올바르지 않습니다.' };
	}

	return {
		payload: {
			savedAt,
			level: level.trim(),
			vadPreset: vadPreset.trim(),
			languageMode: isNonEmptyString(languageMode) ? String(languageMode).trim() : undefined,
			teacherPersonality: isTeacherPersonalityId(teacherPersonality)
				? teacherPersonality
				: 'friendly',
			customPromptText:
				typeof customPromptText === 'string' && customPromptText.trim()
					? customPromptText.trim().slice(0, 2000)
					: undefined,
			messages,
			usage: normalizeUsage(usage)
		}
	};
}

/** @param {{ locals: App.Locals }} param */
async function requireUser({ locals }) {
	if (!locals.user) return { error: json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 }) };
	if (!locals.supabase) {
		return { error: json({ ok: false, error: 'Supabase가 설정되지 않았습니다.' }, { status: 503 }) };
	}
	return { user: locals.user, supabase: locals.supabase };
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals, fetch }) {
	const auth = await requireUser({ locals });
	if (auth.error) return auth.error;

	let { data, error } = await auth.supabase
		.from('conversation_records')
		.select(RECORD_COLUMNS)
		.order('saved_at', { ascending: false })
		.limit(MAX_LIST);

	if (error && missingUsageColumn(error.message)) {
		const fallback = await auth.supabase
			.from('conversation_records')
			.select(RECORD_COLUMNS_WITHOUT_USAGE)
			.order('saved_at', { ascending: false })
			.limit(MAX_LIST);
		data = fallback.data;
		error = fallback.error;
	}

	if (error) {
		console.error('conversation_records list:', error.message);
		return json({ ok: false, error: '대화 기록을 불러오지 못했습니다.' }, { status: 500 });
	}

	const exchange = await readUsdKrwRate(fetch);

	return json({
		ok: true,
		exchange,
		conversations: (data ?? []).map(rowToSavedConversation)
	});
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ locals, request, fetch }) {
	const auth = await requireUser({ locals });
	if (auth.error) return auth.error;

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'JSON 본문을 읽을 수 없습니다.' }, { status: 400 });
	}

	const parsed = parseInsertBody(body);
	if ('error' in parsed && parsed.error) {
		return json({ ok: false, error: parsed.error }, { status: 400 });
	}

	const { user, supabase } = auth;
	const payload = /** @type {NonNullable<typeof parsed.payload>} */ (parsed.payload);

	await supabase.from('profiles').upsert(
		{ id: user.id, email: user.email || '' },
		{ onConflict: 'id' }
	);

	const exchange = await readUsdKrwRate(fetch);
	const row = {
		...payloadToInsertRow(user.id, payload),
		...usageBillingColumns(payload.usage, exchange?.rate)
	};
	let { data, error } = await supabase.from('conversation_records').insert(row).select(RECORD_COLUMNS).single();

	if (error && missingBillingColumn(error.message)) {
		const fallback = await supabase
			.from('conversation_records')
			.insert(withoutBillingColumns(row))
			.select(RECORD_COLUMNS)
			.single();
		data = fallback.data;
		error = fallback.error;
	}

	if (error && missingUsageColumn(error.message)) {
		const withoutUsage = withoutBillingColumns(row);
		delete withoutUsage.usage;
		const fallback = await supabase
			.from('conversation_records')
			.insert(withoutUsage)
			.select(RECORD_COLUMNS_WITHOUT_USAGE)
			.single();
		data = fallback.data;
		error = fallback.error;
	}

	if (error) {
		console.error('conversation_records insert:', error.message);
		return json({ ok: false, error: '대화 저장에 실패했습니다.' }, { status: 500 });
	}

	return json({ ok: true, conversation: rowToSavedConversation(data) }, { status: 201 });
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ locals, url }) {
	const auth = await requireUser({ locals });
	if (auth.error) return auth.error;

	const id = url.searchParams.get('id')?.trim();
	if (!id) {
		return json({ ok: false, error: '삭제할 기록 id가 필요합니다.' }, { status: 400 });
	}

	const { error } = await auth.supabase
		.from('conversation_records')
		.delete()
		.eq('id', id)
		.eq('user_id', auth.user.id);

	if (error) {
		console.error('conversation_records delete:', error.message);
		return json({ ok: false, error: '대화 기록을 삭제하지 못했습니다.' }, { status: 500 });
	}

	return json({ ok: true });
}
