const RATE_URL = 'https://api.frankfurter.dev/v2/rate/usd/krw';
const CACHE_MS = 6 * 60 * 60 * 1000;

/** @type {{ rate: number, date: string, fetchedAt: number }} */
let cache = { rate: 0, date: '', fetchedAt: 0 };

/**
 * Frankfurter USD/KRW 응답에서 환율만 꺼냅니다.
 * @param {unknown} body
 * @returns {{ rate: number, date: string } | null}
 */
export function parseUsdKrwRate(body) {
	if (!body || typeof body !== 'object') return null;
	const record = /** @type {Record<string, unknown>} */ (body);
	const base = String(record.base || '').toUpperCase();
	const quote = String(record.quote || '').toUpperCase();
	const rate = Number(record.rate);
	if (base !== 'USD' || quote !== 'KRW') return null;
	if (!Number.isFinite(rate) || rate <= 0 || rate > 10000) return null;
	return { rate, date: typeof record.date === 'string' ? record.date : '' };
}

/**
 * @param {typeof fetch} [fetchImpl]
 * @returns {Promise<{ rate: number, date: string } | null>}
 */
export async function readUsdKrwRate(fetchImpl = fetch) {
	if (cache.rate > 0 && Date.now() - cache.fetchedAt < CACHE_MS) {
		return { rate: cache.rate, date: cache.date };
	}

	try {
		const res = await fetchImpl(RATE_URL);
		if (!res.ok) return cachedRate();
		const parsed = parseUsdKrwRate(await res.json());
		if (!parsed) return cachedRate();
		cache = { rate: parsed.rate, date: parsed.date, fetchedAt: Date.now() };
		return parsed;
	} catch {
		return cachedRate();
	}
}

function cachedRate() {
	return cache.rate > 0 ? { rate: cache.rate, date: cache.date } : null;
}
