/** @typedef {'privacy' | 'terms_of_service'} PolicyType */

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 */
export async function fetchCurrentLegalPolicies(supabase) {
	const { data, error } = await supabase
		.from('legal_policies')
		.select('id, policy_type, version, title, content, effective_at')
		.eq('is_current', true);
	if (error) throw error;
	return data ?? [];
}

/**
 * @param {import('@supabase/supabase-js').SupabaseClient} supabase
 * @param {PolicyType} policyType
 */
export async function fetchCurrentLegalPolicy(supabase, policyType) {
	const { data, error } = await supabase
		.from('legal_policies')
		.select('id, policy_type, version, title, content, effective_at')
		.eq('policy_type', policyType)
		.eq('is_current', true)
		.maybeSingle();
	if (error) throw error;
	return data;
}
