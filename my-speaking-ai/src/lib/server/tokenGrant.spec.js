import { describe, expect, it } from 'vitest';
import {
	interpretTokenGrant,
	missingTokenGrantFunction,
	tokenGrantLimitMessage
} from './tokenGrant.js';

describe('interpretTokenGrant', () => {
	it('accepts an allowed grant', () => {
		expect(interpretTokenGrant({ allowed: true })).toEqual({
			allowed: true,
			retryAfterSeconds: 0,
			reason: null
		});
	});

	it('turns a rate limit into a wait time', () => {
		expect(
			interpretTokenGrant({ allowed: false, reason: 'rate_limit', retry_after_seconds: 90.2 })
		).toEqual({
			allowed: false,
			retryAfterSeconds: 91,
			reason: 'rate_limit'
		});
	});

	it('uses a short default wait when the payload is empty', () => {
		expect(interpretTokenGrant(null)).toMatchObject({
			allowed: false,
			retryAfterSeconds: 60,
			reason: 'rate_limit'
		});
	});
});

describe('tokenGrantLimitMessage', () => {
	it('rounds the wait up to minutes', () => {
		expect(tokenGrantLimitMessage(61)).toContain('2분');
		expect(tokenGrantLimitMessage(1)).toContain('1분');
	});
});

describe('missingTokenGrantFunction', () => {
	it('detects a migration that has not been applied', () => {
		expect(missingTokenGrantFunction('function consume_realtime_token_grant() does not exist')).toBe(
			true
		);
		expect(missingTokenGrantFunction('rate limit')).toBe(false);
	});
});
