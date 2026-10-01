import { fail, redirect } from '@sveltejs/kit';
import { translateAuthError, validateSignup } from '$lib/server/supabaseConfig.js';

/** @type {import('./$types').Actions} */
export const actions = {
	default: async ({ request, locals, url }) => {
		const form = await request.formData();
		const email = String(form.get('email') ?? '').trim();
		const password = String(form.get('password') ?? '');
		const confirmPassword = String(form.get('confirmPassword') ?? '');
		const validationError = validateSignup(email, password, confirmPassword);
		if (validationError) return fail(400, { email, error: validationError });

		if (!locals.supabase) {
			return fail(503, {
				email,
				error: 'Supabase 설정이 없습니다. .env의 프로젝트 URL과 publishable 키를 확인해 주세요.'
			});
		}

		const { data, error } = await locals.supabase.auth.signUp({
			email,
			password,
			options: {
				emailRedirectTo: `${url.origin}/auth/callback`
			}
		});

		if (error) return fail(400, { email, error: translateAuthError(error.message) });

		if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
			return fail(400, { email, error: '이미 가입된 이메일입니다. 로그인해 주세요.' });
		}

		if (data.session) redirect(303, '/');

		return {
			email,
			success: '가입이 완료되었습니다. 이메일로 보낸 인증 링크를 누른 뒤 로그인해 주세요.'
		};
	}
};
