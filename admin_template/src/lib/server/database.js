/**
 * profiles는 my-speaking-ai의 기본 테이블입니다.
 * 행이 보이지 않아도 오류가 없으면 연결 자체는 된 상태입니다.
 * @param {import('@supabase/supabase-js').SupabaseClient | null} supabase
 */
export async function checkDatabaseConnection(supabase) {
	if (!supabase) {
		return {
			ok: false,
			configured: false,
			message: 'Supabase 설정이 없습니다.'
		};
	}

	const { error } = await supabase.from('profiles').select('id', { head: true, count: 'exact' });

	if (error) {
		return {
			ok: false,
			configured: true,
			message: error.message || '데이터베이스에 연결하지 못했습니다.'
		};
	}

	return {
		ok: true,
		configured: true,
		message: 'my-speaking-ai 데이터베이스에 연결되었습니다.'
	};
}
