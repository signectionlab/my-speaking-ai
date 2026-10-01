import { json } from '@sveltejs/kit';
import {
	payloadToInsertRow,
	rowToSavedConversation
} from '$lib/realtime/conversationRecords.js';

const MAX_LIST = 50;
const MAX_MESSAGES = 500;

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
	}

	return {
		payload: {
			savedAt,
			level: level.trim(),
			vadPreset: vadPreset.trim(),
			languageMode: isNonEmptyString(languageMode) ? String(languageMode).trim() : undefined,
			messages
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
export async function GET({ locals }) {
	const auth = await requireUser({ locals });
	if (auth.error) return auth.error;

	const { data, error } = await auth.supabase
		.from('conversation_records')
		.select('id, saved_at, level, vad_preset, language_mode, messages')
		.order('saved_at', { ascending: false })
		.limit(MAX_LIST);

	if (error) {
		console.error('conversation_records list:', error.message);
		return json({ ok: false, error: '대화 기록을 불러오지 못했습니다.' }, { status: 500 });
	}

	return json({
		ok: true,
		conversations: (data ?? []).map(rowToSavedConversation)
	});
}

/** @type {import('./$types').RequestHandler} */
export async function POST({ locals, request }) {
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

	const { data, error } = await supabase
		.from('conversation_records')
		.insert(payloadToInsertRow(user.id, payload))
		.select('id, saved_at, level, vad_preset, language_mode, messages')
		.single();

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
