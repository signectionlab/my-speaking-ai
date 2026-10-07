import { describe, expect, it } from 'vitest';
import { checkDatabaseConnection } from './database.js';
import { resolveSupabaseConfig, translateAuthError, validateLogin } from './supabaseConfig.js';

describe('resolveSupabaseConfig', () => {
	it('reads the same env names as my-speaking-ai', () => {
		expect(
			resolveSupabaseConfig(
				{
					SUPABASE_DB_UR: ' https://example.supabase.co ',
					SUPABASE_DB_PUBLIC_KEY: 'sb_publishable_test'
				},
				{}
			)
		).toEqual({
			url: 'https://example.supabase.co',
			key: 'sb_publishable_test',
			configured: true
		});
	});
});

describe('validateLogin', () => {
	it('checks email and password length', () => {
		expect(validateLogin('not-an-email', '123456')).toBe('올바른 이메일 주소를 입력해 주세요.');
		expect(validateLogin('user@example.com', '12345')).toBe('비밀번호는 6자 이상이어야 합니다.');
		expect(validateLogin('user@example.com', '123456')).toBe('');
	});
});

describe('translateAuthError', () => {
	it('maps invalid credentials', () => {
		expect(translateAuthError('Invalid login credentials')).toBe(
			'이메일 또는 비밀번호가 올바르지 않습니다.'
		);
	});
});

describe('checkDatabaseConnection', () => {
	it('reports a missing client', async () => {
		await expect(checkDatabaseConnection(null)).resolves.toMatchObject({
			ok: false,
			configured: false
		});
	});

	it('treats a successful profiles query as connected', async () => {
		const supabase = {
			from() {
				return {
					select: async () => ({ error: null })
				};
			}
		};

		await expect(checkDatabaseConnection(supabase)).resolves.toMatchObject({
			ok: true,
			configured: true
		});
	});
});
