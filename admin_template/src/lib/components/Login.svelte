<script>
	import { enhance } from '$app/forms';

	/** @type {{ ok: boolean, configured: boolean, message: string } | null} */
	export let db = null;
	/** @type {{ email?: string, error?: string } | null | undefined} */
	export let form = null;

	let pending = false;
</script>

<div class="login-container">
	<div class="login-card">
		<div class="login-header">
			<h1>관리자 로그인</h1>
			<p>my-speaking-ai에 가입한 이메일과 비밀번호로 로그인하세요</p>
			{#if db}
				<p class="db-status" class:ok={db.ok}>{db.message}</p>
			{/if}
		</div>

		<form
			method="POST"
			action="?/login"
			use:enhance={() => {
				pending = true;
				return async ({ update }) => {
					pending = false;
					await update();
				};
			}}
		>
			<div class="form-group">
				<label for="email">이메일</label>
				<input
					type="email"
					id="email"
					name="email"
					autocomplete="email"
					value={form?.email ?? ''}
					placeholder="you@example.com"
					required
				/>
			</div>

			<div class="form-group">
				<label for="password">비밀번호</label>
				<input
					type="password"
					id="password"
					name="password"
					autocomplete="current-password"
					placeholder="비밀번호를 입력하세요"
					required
				/>
			</div>

			{#if form?.error}
				<div class="error-message" role="alert">{form.error}</div>
			{/if}

			<button type="submit" class="login-btn" disabled={pending}>
				{pending ? '로그인 중…' : '로그인'}
			</button>
		</form>
	</div>
</div>

<style>
	.login-container {
		min-height: 100vh;
		display: flex;
		align-items: center;
		justify-content: center;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		padding: 1rem;
	}

	.login-card {
		background: white;
		border-radius: 12px;
		box-shadow: 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1);
		padding: 2rem;
		width: 100%;
		max-width: 400px;
	}

	.login-header {
		text-align: center;
		margin-bottom: 2rem;
	}

	.login-header h1 {
		font-size: 1.875rem;
		font-weight: 700;
		color: #1f2937;
		margin-bottom: 0.5rem;
	}

	.login-header p {
		color: #6b7280;
		margin: 0;
	}

	.db-status {
		margin-top: 0.75rem;
		font-size: 0.875rem;
		color: #b91c1c;
	}

	.db-status.ok {
		color: #047857;
	}

	.form-group {
		margin-bottom: 1.5rem;
	}

	label {
		display: block;
		font-weight: 500;
		color: #374151;
		margin-bottom: 0.5rem;
	}

	input {
		width: 100%;
		padding: 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 6px;
		font-size: 1rem;
		transition: border-color 0.2s, box-shadow 0.2s;
	}

	input:focus {
		outline: none;
		border-color: #667eea;
		box-shadow: 0 0 0 3px rgb(102 126 234 / 0.1);
	}

	.login-btn {
		width: 100%;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: white;
		border: none;
		padding: 0.75rem;
		border-radius: 6px;
		font-size: 1rem;
		font-weight: 500;
		cursor: pointer;
		transition: transform 0.2s, box-shadow 0.2s;
	}

	.login-btn:hover:not(:disabled) {
		transform: translateY(-1px);
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1);
	}

	.login-btn:disabled {
		opacity: 0.65;
		cursor: not-allowed;
	}

	.error-message {
		background: #fef2f2;
		color: #dc2626;
		padding: 0.75rem;
		border-radius: 6px;
		margin-bottom: 1rem;
		font-size: 0.875rem;
		border: 1px solid #fecaca;
	}
</style>
