import { fail, redirect } from '@sveltejs/kit';
import { loadAdminUsageSummary, listUserConversationUsage } from '$lib/server/conversationUsage.js';
import { checkDatabaseConnection } from '$lib/server/database.js';
import { listProfilesForAdmin, readProfileRole, setProfileRole } from '$lib/server/profiles.js';
import { safeRedirectPath, translateAuthError, validateLogin } from '$lib/server/supabaseConfig.js';
import { readUsdKrwRate } from '$lib/server/usdKrwRate.js';

/** @param {boolean} configured */
function signedOutDatabaseStatus(configured) {
	return {
		ok: false,
		configured,
		message: configured
			? '로그인하면 연결 상태를 확인합니다.'
			: 'Supabase 설정이 없습니다. .env의 프로젝트 URL과 publishable 키를 확인해 주세요.'
	};
}

/** @type {import('./$types').PageServerLoad} */
export async function load({ locals, url, fetch }) {
	if (!locals.user || !locals.supabase) {
		return {
			user: locals.user,
			db: signedOutDatabaseStatus(Boolean(locals.supabase)),
			isAdmin: false,
			profiles: [],
			profilesError: null,
			usageByUser: [],
			usageReady: true,
			usageError: null,
			usageAccessError: null,
			exchange: null,
			usageRowsLoaded: 0,
			selectedUserId: '',
			selectedConversations: []
		};
	}

	const { role, error: roleError } = await readProfileRole(locals.supabase, locals.user.id);
	const isAdmin = role === 'admin';

	if (!isAdmin) {
		return {
			user: locals.user,
			db: { ok: false, configured: true, message: '' },
			isAdmin: false,
			profiles: [],
			profilesError: roleError,
			usageByUser: [],
			usageReady: true,
			usageError: null,
			usageAccessError: null,
			exchange: null,
			usageRowsLoaded: 0,
			selectedUserId: '',
			selectedConversations: []
		};
	}

	const db = await checkDatabaseConnection(locals.supabase);
	const { profiles, error: profilesError } = await listProfilesForAdmin(locals.supabase);
	const exchange = await readUsdKrwRate(fetch);

	const usageClient = locals.supabase;
	/** @type {import('$lib/server/conversationUsage.js').UserUsageAggregate[]} */
	let usageByUser = [];
	/** @type {import('$lib/server/conversationUsage.js').ConversationUsageItem[]} */
	let selectedConversations = [];
	let usageReady = true;
	/** @type {string | null} */
	let usageError = null;
	/** @type {string | null} */
	let usageAccessError = null;
	let usageRowsLoaded = 0;

	let selectedUserId = url.searchParams.get('usageUser')?.trim() || '';
	if (!profiles.some((profile) => profile.id === selectedUserId)) {
		selectedUserId = profiles[0]?.id ?? '';
	}

	if (!usageClient) {
		usageAccessError =
			'Supabase 클라이언트를 만들 수 없습니다. .env의 URL과 publishable 키를 확인해 주세요.';
	} else {
		const summary = await loadAdminUsageSummary(usageClient, profiles);
		usageByUser = summary.byUser;
		usageReady = summary.usageReady;
		usageError = summary.error;
		usageRowsLoaded = summary.rowsLoaded;

		if (selectedUserId) {
			const detail = await listUserConversationUsage(usageClient, selectedUserId);
			selectedConversations = detail.conversations;
			if (!usageError && detail.error) {
				usageError = detail.error;
			}
		}
	}

	return {
		user: locals.user,
		db,
		isAdmin: true,
		profiles,
		profilesError: profilesError ?? roleError,
		usageByUser,
		usageReady,
		usageError,
		usageAccessError,
		exchange,
		usageRowsLoaded,
		selectedUserId,
		selectedConversations
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	login: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const validationError = validateLogin(email, password);
		if (validationError) return fail(400, { email, error: validationError });

		if (!locals.supabase) {
			return fail(503, {
				email,
				error: 'Supabase 설정이 없습니다. .env의 프로젝트 URL과 publishable 키를 확인해 주세요.'
			});
		}

		const { error } = await locals.supabase.auth.signInWithPassword({ email, password });
		if (error) return fail(400, { email, error: translateAuthError(error.message) });

		redirect(303, safeRedirectPath(url.searchParams.get('redirect')));
	},

	setRole: async ({ request, locals }) => {
		if (!locals.user || !locals.supabase) {
			return fail(401, { roleMessage: '로그인이 필요합니다.', roleMessageKind: 'error' });
		}

		const { role: myRole } = await readProfileRole(locals.supabase, locals.user.id);
		if (myRole !== 'admin') {
			return fail(403, {
				roleMessage: '관리자만 권한을 변경할 수 있습니다.',
				roleMessageKind: 'error'
			});
		}

		const form = await request.formData();
		const userId = String(form.get('userId') ?? '').trim();
		const newRole = String(form.get('role') ?? '');

		if (!userId) {
			return fail(400, {
				roleMessage: '대상 사용자를 찾을 수 없습니다.',
				roleMessageKind: 'error'
			});
		}
		if (newRole !== 'user' && newRole !== 'admin') {
			return fail(400, { roleMessage: '올바르지 않은 권한입니다.', roleMessageKind: 'error' });
		}
		if (userId === locals.user.id) {
			return fail(400, {
				roleMessage: '본인 권한은 이 화면에서 바꿀 수 없습니다.',
				roleMessageKind: 'error'
			});
		}

		const result = await setProfileRole(locals.supabase, userId, newRole);
		if (!result.ok) {
			return fail(400, { roleMessage: result.error, roleMessageKind: 'error' });
		}

		return { roleMessage: '권한을 저장했습니다.', roleMessageKind: 'success' };
	}
};
