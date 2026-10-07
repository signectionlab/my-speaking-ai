import { json } from '@sveltejs/kit';
import { CUSTOM_PROMPT_MAX_LEN } from '$lib/realtime/tutorPersonalities.js';

const TITLE_MAX = 80;
const MAX_SAVED = 30;

/** @param {unknown} value */
function isLanguageMode(value) {
	return value === 'english' || value === 'korean' || value === 'mixed';
}

/** @param {{ locals: App.Locals }} param */
async function requireUser({ locals }) {
	if (!locals.user) return { error: json({ ok: false, error: '로그인이 필요합니다.' }, { status: 401 }) };
	if (!locals.supabase) {
		return { error: json({ ok: false, error: 'Supabase가 설정되지 않았습니다.' }, { status: 503 }) };
	}
	return { user: locals.user, supabase: locals.supabase };
}

/** @param {string} text */
function normalizeContent(text) {
	return String(text ?? '').slice(0, CUSTOM_PROMPT_MAX_LEN);
}

/** @param {{ language_mode: string, content: string, updated_at: string }} row */
function rowToDraft(row) {
	return {
		content: row.content,
		updatedAt: row.updated_at
	};
}

/** @param {{ id: string, title: string, language_mode: string, content: string, created_at: string, updated_at: string }} row */
function rowToSaved(row) {
	return {
		id: row.id,
		title: row.title,
		languageMode: row.language_mode,
		content: row.content,
		createdAt: row.created_at,
		updatedAt: row.updated_at
	};
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {string} userId
 * @param {string} languageMode
 * @param {string} content
 */
async function upsertPromptDraft(supabase, userId, languageMode, content) {
	const now = new Date().toISOString();
	const { data: existing, error: findError } = await supabase
		.from('user_prompts')
		.select('id')
		.eq('user_id', userId)
		.eq('language_mode', languageMode)
		.eq('prompt_kind', 'draft')
		.maybeSingle();

	if (findError) {
		throw findError;
	}

	if (existing?.id) {
		const { error } = await supabase
			.from('user_prompts')
			.update({ content, updated_at: now })
			.eq('id', existing.id)
			.eq('user_id', userId);
		if (error) throw error;
		return;
	}

	const { error } = await supabase.from('user_prompts').insert({
		user_id: userId,
		language_mode: languageMode,
		prompt_kind: 'draft',
		title: null,
		content,
		updated_at: now
	});
	if (error) throw error;
}

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	const auth = await requireUser({ locals });
	if (auth.error) return auth.error;

	await auth.supabase.from('profiles').upsert(
		{ id: auth.user.id, email: auth.user.email || '' },
		{ onConflict: 'id' }
	);

	const { data, error } = await auth.supabase
		.from('user_prompts')
		.select('id, prompt_kind, language_mode, title, content, created_at, updated_at')
		.order('updated_at', { ascending: false });

	if (error) {
		console.error('prompts GET:', error.message);
		return json({ ok: false, error: '프롬프트를 불러오지 못했습니다.' }, { status: 500 });
	}

	/** @type {Record<string, { content: string, updatedAt: string }>} */
	const drafts = {};
	/** @type {ReturnType<typeof rowToSaved>[]} */
	const saved = [];

	for (const row of data ?? []) {
		if (row.prompt_kind === 'draft' && isLanguageMode(row.language_mode)) {
			drafts[row.language_mode] = rowToDraft(row);
		} else if (row.prompt_kind === 'saved' && row.title) {
			saved.push(rowToSaved(row));
		}
	}

	saved.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0));
	if (saved.length > MAX_SAVED) saved.length = MAX_SAVED;

	return json({
		ok: true,
		drafts,
		saved
	});
}

/** @type {import('./$types').RequestHandler} */
export async function PUT({ locals, request }) {
	const auth = await requireUser({ locals });
	if (auth.error) return auth.error;

	let body;
	try {
		body = await request.json();
	} catch {
		return json({ ok: false, error: 'JSON 본문을 읽을 수 없습니다.' }, { status: 400 });
	}

	const languageMode = body.languageMode;
	if (!isLanguageMode(languageMode)) {
		return json({ ok: false, error: 'languageMode가 올바르지 않습니다.' }, { status: 400 });
	}

	const content = normalizeContent(body.content);

	try {
		await upsertPromptDraft(auth.supabase, auth.user.id, languageMode, content);
	} catch (err) {
		console.error('prompts PUT draft:', err instanceof Error ? err.message : err);
		return json({ ok: false, error: '프롬프트 초안 저장에 실패했습니다.' }, { status: 500 });
	}

	return json({ ok: true });
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

	const languageMode = body.languageMode;
	const title = typeof body.title === 'string' ? body.title.trim() : '';
	const content = normalizeContent(body.content);

	if (!isLanguageMode(languageMode)) {
		return json({ ok: false, error: 'languageMode가 올바르지 않습니다.' }, { status: 400 });
	}
	if (!title) return json({ ok: false, error: '프롬프트 이름을 입력해 주세요.' }, { status: 400 });
	if (title.length > TITLE_MAX) {
		return json({ ok: false, error: `이름은 ${TITLE_MAX}자 이하여야 합니다.` }, { status: 400 });
	}
	if (!content.trim()) {
		return json({ ok: false, error: '프롬프트 내용이 비어 있습니다.' }, { status: 400 });
	}

	const { count, error: countError } = await auth.supabase
		.from('user_prompts')
		.select('id', { count: 'exact', head: true })
		.eq('prompt_kind', 'saved');

	if (countError) {
		console.error('prompts POST count:', countError.message);
		return json({ ok: false, error: '프롬프트 저장에 실패했습니다.' }, { status: 500 });
	}
	if ((count ?? 0) >= MAX_SAVED) {
		return json(
			{ ok: false, error: `저장 프롬프트는 최대 ${MAX_SAVED}개까지 가능합니다.` },
			{ status: 400 }
		);
	}

	const now = new Date().toISOString();
	const { data, error } = await auth.supabase
		.from('user_prompts')
		.insert({
			user_id: auth.user.id,
			prompt_kind: 'saved',
			title: title.slice(0, TITLE_MAX),
			language_mode: languageMode,
			content,
			updated_at: now
		})
		.select('id, title, language_mode, content, created_at, updated_at')
		.single();

	if (error) {
		console.error('prompts POST insert:', error.message);
		return json({ ok: false, error: '프롬프트 저장에 실패했습니다.' }, { status: 500 });
	}

	return json({ ok: true, prompt: rowToSaved(data) }, { status: 201 });
}

/** @type {import('./$types').RequestHandler} */
export async function DELETE({ locals, url }) {
	const auth = await requireUser({ locals });
	if (auth.error) return auth.error;

	const id = url.searchParams.get('id')?.trim();
	if (!id) return json({ ok: false, error: '삭제할 프롬프트 id가 필요합니다.' }, { status: 400 });

	const { error } = await auth.supabase
		.from('user_prompts')
		.delete()
		.eq('id', id)
		.eq('user_id', auth.user.id)
		.eq('prompt_kind', 'saved');

	if (error) {
		console.error('prompts DELETE:', error.message);
		return json({ ok: false, error: '프롬프트 삭제에 실패했습니다.' }, { status: 500 });
	}

	return json({ ok: true });
}
