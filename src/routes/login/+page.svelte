<script>
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import AuthScreen from '$lib/components/AuthScreen.svelte';
	import PasswordField from '$lib/components/PasswordField.svelte';

	let { data, form } = $props();
	let pending = $state(false);
	const message = $derived(form?.error || data.notice);
</script>

<svelte:head><title>로그인 · 실시간 AI 영어 회화</title></svelte:head>

<AuthScreen
	title="로그인"
	description="가입한 이메일과 비밀번호로 영어 회화를 시작하세요."
>
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
		{#if message}
			<p class="rounded-xl bg-[#fef2f2] px-3.5 py-3 text-[13px] leading-relaxed text-[#b91c1c]" role="alert">
				{message}
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
			<PasswordField label="비밀번호" name="password" autocomplete="current-password" />
			<p class="mt-1.5 text-[12px] font-medium text-[#6b7280]">비밀번호는 6자 이상이어야 합니다.</p>
		</div>

		<button
			class="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#4a90e2] text-[15px] font-bold text-white shadow-sm transition hover:bg-[#3b7fcf] disabled:cursor-not-allowed disabled:opacity-60"
			type="submit"
			disabled={pending}
		>
			{pending ? '로그인 중…' : '로그인'}
		</button>
	</form>

	<p class="mt-6 text-center text-[14px] text-[#4b5563]">
		계정이 없나요?
		<a class="font-semibold text-[#4a90e2] hover:underline" href={resolve('/signup')}>회원가입</a>
	</p>
</AuthScreen>
