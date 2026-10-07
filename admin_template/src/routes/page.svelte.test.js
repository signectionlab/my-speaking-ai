import { describe, test, expect } from 'vitest';
import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/svelte';
import Page from './+page.svelte';

describe('/+page.svelte', () => {
	test('should render h1', () => {
		render(Page, {
			props: {
				data: {
					user: null,
					db: { ok: false, configured: false, message: '' },
					isAdmin: false,
					profiles: [],
					profilesError: null,
					usageByUser: [],
					usageReady: true,
					usageError: null,
					usageAccessError: null,
					exchange: null,
					usageRowsLoaded: 0,
					selectedUserId: '',
					selectedConversations: []
				},
				form: null
			}
		});
		expect(screen.getByRole('heading', { level: 1 })).toBeInTheDocument();
	});
});
