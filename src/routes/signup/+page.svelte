<script>
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import AuthScreen from '$lib/components/AuthScreen.svelte';
	import PasswordField from '$lib/components/PasswordField.svelte';

	let { form } = $props();
	let pending = $state(false);

	let password = $state('');
	let confirmPassword = $state('');

	const MIN_PASSWORD_LENGTH = 6;

	const lengthStatus = $derived.by(() => {
		if (!password) {
			return { ok: false, muted: true, text: `비밀번호는 ${MIN_PASSWORD_LENGTH}자 이상이어야 합니다.` };
		}
		if (password.length < MIN_PASSWORD_LENGTH) {
			return {
				ok: false,
				muted: false,
				text: `${MIN_PASSWORD_LENGTH}자 이상 입력해 주세요. (현재 ${password.length}자)`
			};
		}
		return { ok: true, muted: false, text: `사용 가능한 길이입니다. (${password.length}자)` };
	});

	const matchStatus = $derived.by(() => {
		if (!confirmPassword) return null;
		if (password === confirmPassword) {
			return { ok: true, text: '비밀번호가 일치합니다.' };
		}
		return { ok: false, text: '비밀번호가 일치하지 않습니다.' };
	});
</script>

<svelte:head><title>회원가입 · 실시간 AI 영어 회화</title></svelte:head>

<AuthScreen title="회원가입" description="이메일과 비밀번호로 계정을 만든 뒤 튜터와 대화하세요.">
	<form
		method="POST"
		class="flex flex-col gap-4"
		use:enhance={() => {
			pending = true;
			return async ({ update }) => {
				pending = false;
				await update();
			};
		}}
	>
		{#if form?.error}
			<p class="rounded-xl bg-[#fef2f2] px-3.5 py-3 text-[13px] leading-relaxed text-[#b91c1c]" role="alert">
				{form.error}
			</p>
		{/if}
		{#if form?.success}
			<p class="rounded-xl bg-[#f0fdf4] px-3.5 py-3 text-[13px] leading-relaxed text-[#166534]" role="status">
				{form.success}
			</p>
		{/if}

		<label class="block text-left text-[13px] font-semibold text-[#374151]">
			이메일
			<input
				class="mt-1.5 w-full rounded-xl border border-[#d1d5db] bg-white px-3.5 py-3 text-[15px] font-normal text-black outline-none focus:border-[#4a90e2] focus:ring-2 focus:ring-[#4a90e2]/20"
				type="email"
				name="email"
				autocomplete="email"
				required
				value={form?.email ?? ''}
			/>
		</label>

		<div>
			<PasswordField
				label="비밀번호"
				name="password"
				autocomplete="new-password"
				bind:value={password}
			/>
			<p
				class="mt-1.5 flex items-center gap-1 text-[12px] font-medium {lengthStatus.muted
					? 'text-[#6b7280]'
					: lengthStatus.ok
						? 'text-[#166534]'
						: 'text-[#b91c1c]'}"
				role="status"
				aria-live="polite"
			>
				{#if !lengthStatus.muted}
					<span aria-hidden="true">{lengthStatus.ok ? '✓' : '✕'}</span>
				{/if}
				{lengthStatus.text}
			</p>
		</div>

		<div>
			<PasswordField
				label="비밀번호 확인"
				name="confirmPassword"
				autocomplete="new-password"
				bind:value={confirmPassword}
			/>
			{#if matchStatus}
				<p
					class="mt-1.5 flex items-center gap-1 text-[12px] font-medium {matchStatus.ok
						? 'text-[#166534]'
						: 'text-[#b91c1c]'}"
					role="status"
					aria-live="polite"
				>
					<span aria-hidden="true">{matchStatus.ok ? '✓' : '✕'}</span>
					{matchStatus.text}
				</p>
			{/if}
		</div>

		<button
			class="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#4a90e2] text-[15px] font-bold text-white shadow-sm transition hover:bg-[#3b7fcf] disabled:cursor-not-allowed disabled:opacity-60"
			type="submit"
			disabled={pending}
		>
			{pending ? '가입 중…' : '회원가입'}
		</button>
	</form>

	<p class="mt-6 text-center text-[14px] text-[#4b5563]">
		이미 계정이 있나요?
		<a class="font-semibold text-[#4a90e2] hover:underline" href={resolve('/login')}>로그인</a>
	</p>
</AuthScreen>
