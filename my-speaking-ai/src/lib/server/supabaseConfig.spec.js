import { describe, expect, it } from 'vitest';
import {
	resolveSupabaseConfig,
	safeRedirectPath,
	translateAuthError,
	validateLogin,
	validateSignup
} from './supabaseConfig.js';

describe('resolveSupabaseConfig', () => {
	it('reads the existing env names and the public names', () => {
		expect(
			resolveSupabaseConfig(
				{ SUPABASE_DB_UR: ' https://example.supabase.co ', SUPABASE_DB_PUBLIC_KEY: 'sb_publishable_test' },
				{}
			)
		).toEqual({
			url: 'https://example.supabase.co',
			key: 'sb_publishable_test',
			configured: true
		});

		expect(
			resolveSupabaseConfig({}, { PUBLIC_SUPABASE_URL: 'https://public.supabase.co', PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'pk' })
		).toMatchObject({ configured: true, url: 'https://public.supabase.co', key: 'pk' });
	});
});

describe('safeRedirectPath', () => {
	it('allows same-site paths only', () => {
		expect(safeRedirectPath('/live')).toBe('/live');
		expect(safeRedirectPath('https://evil.example')).toBe('/');
		expect(safeRedirectPath('//evil.example')).toBe('/');
		expect(safeRedirectPath(null)).toBe('/');
	});
});

describe('validate credentials', () => {
	it('checks email, password length, and confirmation', () => {
		expect(validateLogin('not-an-email', '123456')).toBe('올바른 이메일 주소를 입력해 주세요.');
		expect(validateLogin('a@b.co', '12345')).toBe('비밀번호는 6자 이상이어야 합니다.');
		expect(validateLogin('a@b.co', '123456')).toBe('');
		expect(validateSignup('a@b.co', '123456', '123457')).toBe('비밀번호가 서로 다릅니다.');
	});
});

describe('translateAuthError', () => {
	it('maps common Supabase messages', () => {
		expect(translateAuthError('Invalid login credentials')).toBe(
			'이메일 또는 비밀번호가 올바르지 않습니다.'
		);
		expect(translateAuthError('Email not confirmed')).toBe(
			'이메일 인증이 필요합니다. 받은 편지함을 확인해 주세요.'
		);
	});
});
