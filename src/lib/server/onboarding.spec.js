import { describe, expect, it } from 'vitest';
import {
	formatPhoneNumber,
	isOnboardingExemptPath,
	normalizePhoneNumber,
	validateOnboardingSubmission,
	validateProfileFields
} from './onboarding.js';

describe('isOnboardingExemptPath', () => {
	it('allows onboarding, legal, auth, and logout', () => {
		expect(isOnboardingExemptPath('/onboarding')).toBe(true);
		expect(isOnboardingExemptPath('/legal/privacy')).toBe(true);
		expect(isOnboardingExemptPath('/auth/callback')).toBe(true);
		expect(isOnboardingExemptPath('/logout')).toBe(true);
		expect(isOnboardingExemptPath('/')).toBe(false);
	});
});

describe('normalizePhoneNumber', () => {
	it('accepts Korean mobile numbers', () => {
		expect(normalizePhoneNumber('010-1234-5678')).toBe('01012345678');
		expect(normalizePhoneNumber('01012345678')).toBe('01012345678');
	});
	it('rejects invalid numbers', () => {
		expect(normalizePhoneNumber('123')).toBe(null);
		expect(normalizePhoneNumber('9123456789')).toBe(null);
	});
});

describe('formatPhoneNumber', () => {
	it('groups Korean phone digits', () => {
		expect(formatPhoneNumber('01012345678')).toBe('010-1234-5678');
		expect(formatPhoneNumber('0112345678')).toBe('011-234-5678');
	});
});

describe('validateProfileFields', () => {
	it('accepts a name and phone without consent flags', () => {
		expect(validateProfileFields('홍길동', '010-1234-5678')).toBe('');
		expect(validateProfileFields('김', '01012345678')).toMatch(/이름/);
	});
});

describe('validateOnboardingSubmission', () => {
	it('requires name, phone, and both consents', () => {
		expect(validateOnboardingSubmission('a', '01012345678', true, true)).toMatch(/이름/);
		expect(validateOnboardingSubmission('홍길동', '01012345678', false, true)).toMatch(/개인정보/);
		expect(validateOnboardingSubmission('홍길동', '01012345678', true, false)).toMatch(/이용약관/);
		expect(validateOnboardingSubmission('홍길동', '01012345678', true, true)).toBe('');
	});
});
