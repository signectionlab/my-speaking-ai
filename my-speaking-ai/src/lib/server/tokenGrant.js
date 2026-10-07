/**
 * consume_realtime_token_grant() 결과를 앱 응답으로 바꿉니다.
 * @param {unknown} payload
 */
export function interpretTokenGrant(payload) {
	const record = payload && typeof payload === 'object' ? /** @type {Record<string, unknown>} */ (payload) : {};
	if (record.allowed === true) {
		return { allowed: true, retryAfterSeconds: 0, reason: /** @type {null} */ (null) };
	}

	const retry = Number(record.retry_after_seconds);
	const reason = record.reason === 'unauthenticated' || record.reason === 'profile_missing'
		? record.reason
		: 'rate_limit';

	return {
		allowed: false,
		retryAfterSeconds: Number.isFinite(retry) && retry > 0 ? Math.ceil(retry) : 60,
		reason
	};
}

/** @param {number} retryAfterSeconds */
export function tokenGrantLimitMessage(retryAfterSeconds) {
	const minutes = Math.max(1, Math.ceil(retryAfterSeconds / 60));
	return `음성 세션 시작이 잠시 제한되었습니다. 약 ${minutes}분 후에 다시 시도해 주세요.`;
}

/** @param {string | undefined} message */
export function missingTokenGrantFunction(message) {
	return /consume_realtime_token_grant|does not exist|schema cache/i.test(message || '');
}
