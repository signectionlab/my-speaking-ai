import { fail, redirect } from '@sveltejs/kit';
import { safeRedirectPath, translateAuthError, validateLogin } from '$lib/server/supabaseConfig.js';

/** @type {import('./$types').PageServerLoad} */
export function load({ url }) {
	const code = url.searchParams.get('error');
	return {
		notice:
			code === 'confirm'
				? '이메일 인증에 실패했거나 링크가 만료되었습니다. 다시 로그인해 주세요.'
				: ''
	};
}

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ request, locals, url }) => {
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
	}
};
