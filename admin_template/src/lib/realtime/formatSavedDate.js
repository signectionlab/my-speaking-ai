/** @param {string} iso */
export function formatSavedDateLong(iso) {
	try {
		return new Intl.DateTimeFormat('ko-KR', {
			year: 'numeric',
			month: 'long',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit'
		}).format(new Date(iso));
	} catch {
		return iso;
	}
}
