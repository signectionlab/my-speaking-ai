import { json } from '@sveltejs/kit';
import { checkDatabaseConnection } from '$lib/server/database.js';
import { readProfileRole } from '$lib/server/profiles.js';

/** @type {import('./$types').RequestHandler} */
export async function GET({ locals }) {
	if (!locals.user || !locals.supabase) {
		return json({ ok: false, message: '로그인이 필요합니다.' }, { status: 401 });
	}

	const { role } = await readProfileRole(locals.supabase, locals.user.id);
	if (role !== 'admin') {
		return json({ ok: false, message: '관리자만 접근할 수 있습니다.' }, { status: 403 });
	}

	const status = await checkDatabaseConnection(locals.supabase);
	return json(status, { status: status.ok ? 200 : 503 });
}
