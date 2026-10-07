import { describe, expect, it } from 'vitest';
import { formatKrw, usdToKrw } from '../realtime/realtimeUsage.js';
import { parseUsdKrwRate } from './usdKrwRate.js';

describe('KRW conversion', () => {
	it('parses a Frankfurter USD/KRW quote', () => {
		expect(parseUsdKrwRate({ date: '2026-10-01', base: 'USD', quote: 'KRW', rate: 1354.74 })).toEqual({
			rate: 1354.74,
			date: '2026-10-01'
		});
		expect(parseUsdKrwRate({ base: 'EUR', quote: 'KRW', rate: 1500 })).toBeNull();
	});

	it('formats won from a dollar amount', () => {
		expect(usdToKrw(1, 1354.74)).toBeCloseTo(1354.74, 2);
		expect(formatKrw(1, 1354.74)).toBe('1,355원');
		expect(formatKrw(0.0001, 1354.74)).toBe('1원 미만');
		expect(formatKrw(0, 1354.74)).toBe('0원');
	});
});