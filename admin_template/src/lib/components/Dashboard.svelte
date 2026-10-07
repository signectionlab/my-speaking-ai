<script>
	import { enhance } from '$app/forms';
	import { invalidateAll } from '$app/navigation';
	import UsageAdminSection from './UsageAdminSection.svelte';

	/** @type {{ id: string, email: string }} */
	export let user;

	/** @type {import('$lib/server/profiles.js').ProfileRow[]} */
	export let profiles = [];

	/** @type {string | null} */
	export let profilesError = null;

	/** @type {{ roleMessage?: string, roleMessageKind?: 'success' | 'error' } | null | undefined} */
	export let form = null;

	/** @type {import('$lib/server/conversationUsage.js').UserUsageAggregate[]} */
	export let usageByUser = [];

	/** @type {boolean} */
	export let usageReady = true;

	/** @type {string | null} */
	export let usageError = null;

	/** @type {string | null} */
	export let usageAccessError = null;

	/** @type {{ rate: number, date: string } | null} */
	export let exchange = null;

	/** @type {number} */
	export let usageRowsLoaded = 0;

	/** @type {string} */
	export let selectedUserId = '';

	/** @type {import('$lib/server/conversationUsage.js').ConversationUsageItem[]} */
	export let selectedConversations = [];

	$: adminCount = profiles.filter((profile) => profile.role === 'admin').length;

	const dateFormatter = new Intl.DateTimeFormat('ko-KR', {
		dateStyle: 'medium',
		timeStyle: 'short'
	});

	/** @param {string | null | undefined} value */
	function formatDate(value) {
		if (!value) return '—';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '—';
		return dateFormatter.format(date);
	}


</script>

<div class="dashboard">
	<header class="header">
		<div class="header-content">
			<h1>사용자 관리</h1>
			<div class="user-info">
				<span class="you">로그인: {user.email || '관리자'}</span>
				<form method="POST" action="/logout">
					<button type="submit" class="logout-btn">로그아웃</button>
				</form>
			</div>
		</div>
	</header>

	<main class="main-content">
		<div class="summary-grid">
			<div class="summary">
				<p class="summary-label">전체 사용자</p>
				<p class="summary-value">{profiles.length.toLocaleString('ko-KR')}명</p>
			</div>
			<div class="summary">
				<p class="summary-label">관리자</p>
				<p class="summary-value accent">{adminCount.toLocaleString('ko-KR')}명</p>
			</div>
		</div>

		{#if form?.roleMessage}
			<div
				class="banner"
				class:success={form.roleMessageKind === 'success'}
				class:error={form.roleMessageKind !== 'success'}
				role="status"
			>
				{form.roleMessage}
			</div>
		{/if}

		{#if profilesError}
			<div class="banner error" role="alert">{profilesError}</div>
		{/if}

		<section class="table-section">
			<div class="table-wrap">
				<table>
					<thead>
						<tr>
							<th>이름</th>
							<th>이메일</th>
							<th>연락처</th>
							<th>권한</th>
							<th>가입일</th>
							<th>온보딩 완료</th>
						</tr>
					</thead>
					<tbody>
						{#if profiles.length === 0}
							<tr>
								<td colspan="6" class="empty">표시할 사용자가 없습니다.</td>
							</tr>
						{:else}
							{#each profiles as profile (profile.id)}
								<tr class:highlight={profile.id === user.id}>
									<td>{profile.display_name?.trim() || '—'}</td>
									<td class="mono">{profile.email}</td>
									<td>{profile.phone_number?.trim() || '—'}</td>
									<td>
										{#if profile.id === user.id}
											<span class="badge" class:admin={profile.role === 'admin'}>
												{profile.role === 'admin' ? '관리자' : '일반'} (본인)
											</span>
										{:else}
											<form
												method="POST"
												action="?/setRole"
												class="role-form"
												use:enhance={() => {
													return async ({ result, update }) => {
														await update();
														if (result.type === 'success') {
															await invalidateAll();
														}
													};
												}}
											>
												<input type="hidden" name="userId" value={profile.id} />
												<select
													name="role"
													class="role-select"
													value={profile.role}
													on:change={(event) => event.currentTarget.form?.requestSubmit()}
												>
													<option value="user">일반</option>
													<option value="admin">관리자</option>
												</select>
											</form>
										{/if}
									</td>
									<td>{formatDate(profile.created_at)}</td>
									<td>{formatDate(profile.onboarding_completed_at)}</td>
								</tr>
							{/each}
						{/if}
					</tbody>
				</table>
			</div>
			<p class="table-footnote">
				다른 사용자의 권한을 바꾸면 즉시 저장됩니다. 본인 권한은 실수 방지를 위해 이 목록에서 변경할 수
				없습니다.
			</p>
		</section>

		<UsageAdminSection
			{profiles}
			byUser={usageByUser}
			{selectedUserId}
			{selectedConversations}
			{usageReady}
			{usageError}
			{usageAccessError}
			{exchange}
			rowsLoaded={usageRowsLoaded}
		/>
	</main>
</div>

<style>
	.dashboard {
		min-height: 100vh;
		background: #f8fafc;
	}

	.header {
		background: white;
		border-bottom: 1px solid #e2e8f0;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
	}

	.header-content {
		max-width: 1200px;
		margin: 0 auto;
		padding: 1rem 2rem;
		display: flex;
		justify-content: space-between;
		align-items: center;
		gap: 1rem;
	}

	.header h1 {
		font-size: 1.5rem;
		font-weight: 600;
		color: #1e293b;
		margin: 0;
	}

	.user-info {
		display: flex;
		align-items: center;
		gap: 1rem;
		flex-wrap: wrap;
	}

	.user-info form {
		margin: 0;
	}

	.you {
		color: #64748b;
		font-weight: 500;
		font-size: 0.9375rem;
	}

	.logout-btn {
		background: #ef4444;
		color: white;
		border: none;
		padding: 0.5rem 1rem;
		border-radius: 6px;
		cursor: pointer;
		font-weight: 500;
		transition: background-color 0.2s;
	}

	.logout-btn:hover {
		background: #dc2626;
	}

	.main-content {
		max-width: 1200px;
		margin: 0 auto;
		padding: 2rem;
	}

	.summary-grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
		gap: 1rem;
		margin-bottom: 1.5rem;
	}

	.summary {
		background: white;
		border-radius: 12px;
		padding: 1.25rem 1.5rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
	}

	.summary-label {
		margin: 0;
		font-size: 0.875rem;
		color: #64748b;
	}

	.summary-value {
		margin: 0.25rem 0 0;
		font-size: 1.75rem;
		font-weight: 700;
		color: #1e293b;
	}

	.summary-value.accent {
		color: #1d4ed8;
	}

	.banner {
		border-radius: 8px;
		padding: 0.75rem 1rem;
		margin-bottom: 1rem;
		font-size: 0.9375rem;
	}

	.banner.error {
		background: #fef2f2;
		color: #b91c1c;
		border: 1px solid #fecaca;
	}

	.banner.success {
		background: #ecfdf5;
		color: #047857;
		border: 1px solid #a7f3d0;
	}

	.table-section {
		background: white;
		border-radius: 12px;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
		overflow: hidden;
	}

	.table-wrap {
		overflow-x: auto;
	}

	table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.875rem;
	}

	th,
	td {
		padding: 0.875rem 1rem;
		text-align: left;
		border-bottom: 1px solid #e2e8f0;
		vertical-align: middle;
	}

	th {
		background: #f8fafc;
		color: #475569;
		font-weight: 600;
		white-space: nowrap;
	}

	tbody tr:last-child td {
		border-bottom: none;
	}

	tr.highlight {
		background: #f0f9ff;
	}

	td.empty {
		text-align: center;
		color: #64748b;
		padding: 2.5rem 1rem;
	}

	td.mono {
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.8125rem;
	}

	.role-form {
		margin: 0;
	}

	.role-select {
		font-size: 0.8125rem;
		padding: 0.35rem 0.5rem;
		border-radius: 6px;
		border: 1px solid #cbd5e1;
		background: white;
		color: #334155;
		min-width: 6.5rem;
	}

	.role-select:focus {
		outline: 2px solid #93c5fd;
		outline-offset: 1px;
	}

	.badge {
		display: inline-block;
		padding: 0.2rem 0.55rem;
		border-radius: 999px;
		font-size: 0.75rem;
		font-weight: 600;
		background: #e2e8f0;
		color: #475569;
	}

	.badge.admin {
		background: #dbeafe;
		color: #1d4ed8;
	}

	.table-footnote {
		margin: 0;
		padding: 0.875rem 1rem 1rem;
		font-size: 0.8125rem;
		color: #64748b;
		border-top: 1px solid #e2e8f0;
	}

	@media (max-width: 768px) {
		.header-content,
		.main-content {
			padding: 1rem;
		}
	}
</style>
