<script>
	/** @type {{ email: string }} */
	export let user;

	/** @type {string | null | undefined} */
	export let hint = null;
</script>

<div class="denied">
	<div class="card">
		<h1>접근 권한 없음</h1>
		<p>
			<strong>{user.email}</strong> 계정은 관리자(<code>admin</code>) 권한이 없습니다.<br />
			이미 관리자로 지정된 계정으로 로그인하거나, 운영 DB에서 해당 계정의 <code>role</code>을
			<code>admin</code>으로 설정한 뒤 다시 시도해 주세요.
		</p>
		{#if hint}
			<p class="hint" role="status">{hint}</p>
		{/if}
		<form method="POST" action="/logout">
			<button type="submit">로그아웃</button>
		</form>
	</div>
</div>

<style>
	.denied {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: #f8fafc;
		padding: 1rem;
	}

	.card {
		max-width: 28rem;
		background: white;
		border-radius: 12px;
		padding: 2rem;
		box-shadow: 0 1px 3px 0 rgb(0 0 0 / 0.1);
		text-align: center;
	}

	h1 {
		margin: 0 0 1rem;
		font-size: 1.25rem;
		color: #1e293b;
	}

	p {
		margin: 0 0 1.5rem;
		color: #64748b;
		line-height: 1.6;
		font-size: 0.9375rem;
	}

	.hint {
		margin: -0.75rem 0 1.25rem;
		padding: 0.65rem 0.75rem;
		background: #fef2f2;
		color: #b91c1c;
		border-radius: 8px;
		font-size: 0.875rem;
		text-align: left;
	}

	code {
		font-size: 0.8125rem;
		background: #f1f5f9;
		padding: 0.1rem 0.35rem;
		border-radius: 4px;
	}

	button {
		background: #64748b;
		color: white;
		border: none;
		padding: 0.625rem 1.25rem;
		border-radius: 8px;
		cursor: pointer;
		font-weight: 500;
	}

	button:hover {
		background: #475569;
	}
</style>
