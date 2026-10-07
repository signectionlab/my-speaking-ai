import { describe, expect, it, vi } from 'vitest';

vi.mock('@sveltejs/kit', () => ({
	error: (status, message) => {
		const err = new Error(message);
		err.status = status;
		throw err;
	},
	fail: (status, data) => ({ status, data }),
	redirect: (status, location) => {
		const err = new Error('redirect');
		err.status = status;
		err.location = location;
		throw err;
	}
}));

const { actions, load } = await import('./+page.server.js');

/** @param {Record<string, string>} fields */
function formRequest(fields) {
	const body = new FormData();
	for (const [key, value] of Object.entries(fields)) body.set(key, value);
	return new Request('http://localhost/account?/update', { method: 'POST', body });
}

describe('account profile update', () => {
	it('saves a trimmed name and normalized phone number', async () => {
		const eq = vi.fn();
		const select = vi.fn(() => ({
			maybeSingle: async () => ({
				data: { display_name: '홍길동', phone_number: '01012345678' },
				error: null
			})
		}));
		eq.mockReturnValue({ select });
		const update = vi.fn(() => ({ eq }));
		const from = vi.fn(() => ({ update }));

		const result = await actions.update({
			request: formRequest({ displayName: ' 홍길동 ', phone: '010-1234-5678' }),
			locals: {
				user: { id: 'user-1', email: 'learner@example.com' },
				supabase: { from }
			}
		});

		expect(update).toHaveBeenCalledWith({
			display_name: '홍길동',
			phone_number: '01012345678',
			updated_at: expect.any(String)
		});
		expect(eq).toHaveBeenCalledWith('id', 'user-1');
		expect(result).toMatchObject({
			displayName: '홍길동',
			phone: '010-1234-5678',
			success: '내 정보를 저장했습니다.'
		});
	});

	it('rejects an invalid phone number before writing', async () => {
		const from = vi.fn();
		const result = await actions.update({
			request: formRequest({ displayName: '홍길동', phone: '123' }),
			locals: { user: { id: 'user-1', email: 'learner@example.com' }, supabase: { from } }
		});

		expect(from).not.toHaveBeenCalled();
		expect(result).toMatchObject({
			status: 400,
			data: { error: expect.stringMatching(/휴대전화/) }
		});
	});
});

describe('account profile load', () => {
	it('returns the saved name, formatted phone, and consent records', async () => {
		const profileQuery = {
			select: vi.fn(() => profileQuery),
			eq: vi.fn(() => profileQuery),
			maybeSingle: async () => ({
				data: {
					display_name: '홍길동',
					phone_number: '01012345678',
					email: 'learner@example.com',
					created_at: '2025-06-03T01:28:35.000Z',
					updated_at: '2025-06-04T11:59:19.000Z'
				},
				error: null
			})
		};
		const consentQuery = {
			select: vi.fn(() => consentQuery),
			eq: vi.fn(() => consentQuery),
			order: async () => ({
				data: [
					{
						agreed_at: '2026-10-01T00:00:00.000Z',
						policy: {
							id: 'policy-1',
							title: '개인정보 처리방침',
							version: '1.0',
							policy_type: 'privacy',
							content: '수집 항목 안내',
							effective_at: '2025-10-01T00:00:00.000Z'
						}
					}
				],
				error: null
			})
		};
		const from = vi.fn((table) => (table === 'profiles' ? profileQuery : consentQuery));

		const data = await load({
			locals: {
				user: { id: 'user-1', email: 'learner@example.com' },
				supabase: { from }
			}
		});

		expect(data).toMatchObject({
			email: 'learner@example.com',
			displayName: '홍길동',
			phoneNumber: '010-1234-5678',
			createdAt: '2025-06-03T01:28:35.000Z',
			updatedAt: '2025-06-04T11:59:19.000Z',
			consents: [
				{
					id: 'policy-1',
					title: '개인정보 처리방침',
					version: '1.0',
					policyType: 'privacy',
					content: '수집 항목 안내',
					effectiveAt: '2025-10-01T00:00:00.000Z',
					agreedAt: '2026-10-01T00:00:00.000Z'
				}
			]
		});
	});
});
