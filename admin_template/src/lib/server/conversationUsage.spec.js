import { describe, expect, it } from 'vitest';
import { aggregateUsageByUser, usageFromBillingRow } from './conversationUsage.js';

describe('usageFromBillingRow', () => {
	it('prefers json usage when present', () => {
		const usage = usageFromBillingRow({
			user_id: 'u1',
			usage: { durationMs: 5000, responseCount: 2, inputTextTokens: 10 },
			usage_duration_ms: 1
		});
		expect(usage?.durationMs).toBe(5000);
		expect(usage?.responseCount).toBe(2);
	});
});

describe('aggregateUsageByUser', () => {
	it('sums measured conversations per user', () => {
		const rows = [
			{
				user_id: 'a',
				saved_at: '2026-01-02T00:00:00Z',
				usage: { durationMs: 1000, responseCount: 1, inputTextTokens: 5 },
				estimated_cost_usd: 0.01
			},
			{
				user_id: 'a',
				saved_at: '2026-01-03T00:00:00Z',
				usage: { durationMs: 2000, responseCount: 1, inputTextTokens: 3 },
				estimated_cost_usd: 0.02
			},
			{
				user_id: 'b',
				saved_at: '2026-01-01T00:00:00Z',
				usage: null
			}
		];

		const result = aggregateUsageByUser(rows);
		expect(result).toHaveLength(2);
		const userA = result.find((item) => item.userId === 'a');
		expect(userA?.conversationCount).toBe(2);
		expect(userA?.measuredCount).toBe(2);
		expect(userA?.usage.durationMs).toBe(3000);
		expect(userA?.storedCostUsd).toBeCloseTo(0.03);
		expect(userA?.lastActivityAt).toBe('2026-01-03T00:00:00Z');
	});
});
