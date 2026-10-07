import { describe, expect, it } from 'vitest';
import { resolveEmailRedirect } from './authRedirect.js';

describe('resolveEmailRedirect', () => {
	it('keeps local and known production origins', () => {
		expect(resolveEmailRedirect('http://localhost:5173')).toBe('http://localhost:5173/auth/callback');
		expect(resolveEmailRedirect('https://myspeaking-ai.vercel.app/')).toBe(
			'https://myspeaking-ai.vercel.app/auth/callback'
		);
	});

	it('drops an unknown host instead of putting it in the email', () => {
		expect(resolveEmailRedirect('https://evil.example')).toBeNull();
		expect(resolveEmailRedirect('http://localhost:5174')).toBeNull();
	});

	it('accepts one extra origin from the server environment', () => {
		expect(resolveEmailRedirect('https://speaking.example', 'https://speaking.example')).toBe(
			'https://speaking.example/auth/callback'
		);
	});
});
