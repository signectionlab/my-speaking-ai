import { describe, expect, it } from 'vitest';
import { setProfileRole } from './profiles.js';

describe('setProfileRole', () => {
	it('maps missing RPC to a clear message', async () => {
		const supabase = {
			rpc: async () => ({
				error: { message: 'function admin_set_profile_role(uuid, text) does not exist' }
			})
		};

		const result = await setProfileRole(supabase, '00000000-0000-0000-0000-000000000001', 'admin');
		expect(result.ok).toBe(false);
		expect(result.error).toMatch(/010_admin_set_profile_role/);
	});
});
