<script>
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import AuthScreen from '$lib/components/AuthScreen.svelte';

	let { data, form } = $props();
	let pending = $state(false);

	const displayName = $derived(form?.displayName ?? data.displayName ?? '');
	const phone = $derived(form?.phone ?? data.phoneNumber ?? '');
	const agreePrivacy = $derived(form?.agreePrivacy ?? false);
	const agreeTerms = $derived(form?.agreeTerms ?? false);
</script>

<svelte:head><title>추가 정보 · 실시간 AI 영어 회화</title></svelte:head>

<AuthScreen
	title="서비스 이용 동의"
	description="최초 로그인 시 개인정보·이용약관에 동의하고 연락처 정보를 입력해 주세요."
>
	<form
		method="POST"
		action="?redirect={encodeURIComponent(data.redirectTo)}"
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

		<p class="rounded-xl bg-[#f8fafc] px-3.5 py-3 text-[13px] leading-relaxed text-[#475569]">
			가입 이메일: <span class="font-semibold text-[#0f172a]">{data.email}</span>
		</p>

		<label class="block text-left text-[13px] font-semibold text-[#374151]">
			이름
			<input
				class="mt-1.5 w-full rounded-xl border border-[#d1d5db] bg-white px-3.5 py-3 text-[15px] font-normal text-black outline-none focus:border-[#4a90e2] focus:ring-2 focus:ring-[#4a90e2]/20"
				type="text"
				name="displayName"
				autocomplete="name"
				required
				minlength="2"
				maxlength="40"
				value={displayName}
			/>
		</label>

		<label class="block text-left text-[13px] font-semibold text-[#374151]">
			휴대전화번호
			<input
				class="mt-1.5 w-full rounded-xl border border-[#d1d5db] bg-white px-3.5 py-3 text-[15px] font-normal text-black outline-none focus:border-[#4a90e2] focus:ring-2 focus:ring-[#4a90e2]/20"
				type="tel"
				name="phone"
				autocomplete="tel"
				inputmode="numeric"
				required
				placeholder="01012345678"
				value={phone}
			/>
		</label>

		<fieldset class="space-y-3 rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-3.5 py-4">
			<legend class="px-1 text-[13px] font-semibold text-[#374151]">필수 동의</legend>

			<label class="flex cursor-pointer items-start gap-3 text-left text-[13px] leading-snug text-[#374151]">
				<input
					class="mt-0.5 h-4 w-4 shrink-0 rounded border-[#cbd5e1] text-[#4a90e2] focus:ring-[#4a90e2]/30"
					type="checkbox"
					name="agreePrivacy"
					required
					checked={agreePrivacy}
				/>
				<span>
					<a
						class="font-semibold text-[#4a90e2] hover:underline"
						href={resolve('/legal/privacy')}
						target="_blank"
						rel="noopener noreferrer"
					>
						개인정보 처리방침
					</a>
					(버전 {data.privacy.version})에 동의합니다.
				</span>
			</label>

			<label class="flex cursor-pointer items-start gap-3 text-left text-[13px] leading-snug text-[#374151]">
				<input
					class="mt-0.5 h-4 w-4 shrink-0 rounded border-[#cbd5e1] text-[#4a90e2] focus:ring-[#4a90e2]/30"
					type="checkbox"
					name="agreeTerms"
					required
					checked={agreeTerms}
				/>
				<span>
					<a
						class="font-semibold text-[#4a90e2] hover:underline"
						href={resolve('/legal/terms')}
						target="_blank"
						rel="noopener noreferrer"
					>
						서비스 이용약관
					</a>
					(버전 {data.terms.version})에 동의합니다.
				</span>
			</label>
		</fieldset>

		<button
			class="mt-2 flex min-h-[48px] w-full items-center justify-center rounded-xl bg-[#4a90e2] text-[15px] font-bold text-white shadow-sm transition hover:bg-[#3b7fcf] disabled:cursor-not-allowed disabled:opacity-60"
			type="submit"
			disabled={pending}
		>
			{pending ? '저장 중…' : '동의하고 시작하기'}
		</button>
	</form>
</AuthScreen>
