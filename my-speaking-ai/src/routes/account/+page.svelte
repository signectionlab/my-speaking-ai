<script>
	import { enhance } from '$app/forms';

	let { data, form } = $props();
	let pending = $state(false);
	let editing = $state(Boolean(form?.error));
	let nameInput = $state(form?.displayName ?? data.displayName ?? '');
	let phoneInput = $state(form?.phone ?? data.phoneNumber ?? '');

	/** @type {HTMLDialogElement | null} */
	let policyDialog = $state(null);
	/** @type {(typeof data.consents)[number] | null} */
	let selectedConsent = $state(null);

	/** @param {string} value */
	function formatStamp(value) {
		if (!value) return '-';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '-';
		const pad = (part) => String(part).padStart(2, '0');
		return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}, ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
	}

	/** @param {string} value */
	function formatEffective(value) {
		if (!value) return '';
		const date = new Date(value);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
	}

	function startEdit() {
		nameInput = data.displayName ?? '';
		phoneInput = data.phoneNumber ?? '';
		editing = true;
	}

	function cancelEdit() {
		editing = false;
	}

	/** @param {(typeof data.consents)[number]} consent */
	function openConsent(consent) {
		selectedConsent = consent;
		policyDialog?.showModal();
	}

	function closeConsent() {
		policyDialog?.close();
		selectedConsent = null;
	}

	/** @param {MouseEvent} event */
	function onDialogClick(event) {
		if (event.target === policyDialog) closeConsent();
	}
</script>

<svelte:head><title>내 프로필 · 실시간 AI 영어 회화</title></svelte:head>

<main class="px-4 py-8 sm:py-10">
	<section class="mx-auto w-full max-w-md">
		<div class="overflow-hidden rounded-[22px] bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
			<header class="flex items-center justify-between gap-3 bg-[#2f6cf6] px-5 py-4">
				<h1 class="text-[18px] font-bold tracking-tight text-white">내 프로필</h1>
				{#if editing}
					<div class="flex items-center gap-2">
						<button
							class="rounded-lg bg-white/15 px-3 py-1.5 text-[13px] font-semibold text-white transition hover:bg-white/25"
							type="button"
							onclick={cancelEdit}
							disabled={pending}
						>
							취소
						</button>
						<button
							class="rounded-lg bg-white px-3.5 py-1.5 text-[13px] font-bold text-[#2f6cf6] shadow-sm transition hover:bg-[#f8fbff] disabled:opacity-60"
							type="submit"
							form="profile-form"
							disabled={pending}
						>
							{pending ? '저장 중…' : '저장하기'}
						</button>
					</div>
				{:else}
					<button
						class="rounded-lg bg-white px-3.5 py-1.5 text-[13px] font-bold text-[#2f6cf6] shadow-sm transition hover:bg-[#f8fbff]"
						type="button"
						onclick={startEdit}
					>
						수정하기
					</button>
				{/if}
			</header>

			<div class="px-5 pb-6 pt-5">
				{#if form?.error}
					<p class="mb-4 rounded-xl bg-[#fef2f2] px-3.5 py-3 text-[13px] leading-relaxed text-[#b91c1c]" role="alert">
						{form.error}
					</p>
				{:else if form?.success && !editing}
					<p class="mb-4 rounded-xl bg-[#ecfdf5] px-3.5 py-3 text-[13px] leading-relaxed text-[#047857]" role="status">
						{form.success}
					</p>
				{/if}

				<form
					id="profile-form"
					method="POST"
					action="?/update"
					use:enhance={() => {
						pending = true;
						return async ({ result, update }) => {
							await update();
							pending = false;
							if (result.type === 'success') editing = false;
						};
					}}
				>
					<h2 class="text-[16px] font-bold text-[#1f2937]">기본 정보</h2>
					<div class="mt-3 space-y-2.5">
						<div class="rounded-xl bg-[#f4f7fb] px-4 py-3">
							<p class="text-[12px] font-medium text-[#98a2b3]">이메일</p>
							<p class="mt-1 break-all text-[15px] font-medium text-[#1f2937]">{data.email || '-'}</p>
						</div>

						<div class="rounded-xl bg-[#f4f7fb] px-4 py-3">
							<p class="text-[12px] font-medium text-[#98a2b3]">이름</p>
							{#if editing}
								<input
									id="displayName"
									class="mt-1 w-full bg-transparent text-[15px] font-medium text-[#1f2937] outline-none"
									type="text"
									name="displayName"
									autocomplete="name"
									aria-label="이름"
									required
									minlength="2"
									maxlength="40"
									bind:value={nameInput}
								/>
							{:else}
								<p class="mt-1 text-[15px] font-medium text-[#1f2937]">{data.displayName || '-'}</p>
							{/if}
						</div>

						<div class="rounded-xl bg-[#f4f7fb] px-4 py-3">
							<p class="text-[12px] font-medium text-[#98a2b3]">전화번호</p>
							{#if editing}
								<input
									id="phone"
									class="mt-1 w-full bg-transparent text-[15px] font-medium text-[#1f2937] outline-none"
									type="tel"
									name="phone"
									autocomplete="tel"
									inputmode="tel"
									aria-label="전화번호"
									required
									placeholder="010-1234-5678"
									bind:value={phoneInput}
								/>
							{:else}
								<p class="mt-1 text-[15px] font-medium text-[#1f2937]">{data.phoneNumber || '-'}</p>
							{/if}
						</div>

						<div class="rounded-xl bg-[#f4f7fb] px-4 py-3">
							<p class="text-[12px] font-medium text-[#98a2b3]">가입일</p>
							<p class="mt-1 text-[15px] font-medium text-[#1f2937]">{formatStamp(data.createdAt)}</p>
						</div>

						<div class="rounded-xl bg-[#f4f7fb] px-4 py-3">
							<p class="text-[12px] font-medium text-[#98a2b3]">최근 프로필 수정일</p>
							<p class="mt-1 text-[15px] font-medium text-[#1f2937]">{formatStamp(data.updatedAt)}</p>
						</div>
					</div>
				</form>

				<section class="mt-7">
					<h2 class="text-[16px] font-bold text-[#1f2937]">이용약관 동의 내역</h2>
					<div class="mt-3 overflow-hidden rounded-xl border border-[#e7edf4]">
						<div class="grid grid-cols-[minmax(0,1fr)_3.25rem_5.5rem] bg-[#f8fafc] text-[12px] font-medium text-[#98a2b3]">
							<div class="px-3 py-2.5">약관 종류</div>
							<div class="px-1 py-2.5 text-center">버전</div>
							<div class="px-2 py-2.5 text-center">동의 여부</div>
						</div>
						{#if data.consents.length === 0}
							<p class="border-t border-[#eef2f6] px-3 py-4 text-[13px] text-[#64748b]">동의한 약관이 없습니다.</p>
						{:else}
							{#each data.consents as consent (consent.id + consent.agreedAt)}
								<button
									class="grid w-full grid-cols-[minmax(0,1fr)_3.25rem_5.5rem] items-center border-t border-[#eef2f6] text-left transition hover:bg-[#f8fbff]"
									type="button"
									aria-label="{consent.title} 전문 보기"
									onclick={() => openConsent(consent)}
								>
									<span class="truncate px-3 py-3.5 text-[13px] font-medium text-[#1f2937]">{consent.title}</span>
									<span class="px-1 py-3.5 text-center text-[13px] text-[#475569]">{consent.version}</span>
									<span class="px-2 py-3.5 text-center">
										<span class="inline-flex rounded-full bg-[#e8f8ef] px-2.5 py-1 text-[12px] font-semibold text-[#1f9d55]">
											동의함
										</span>
									</span>
								</button>
							{/each}
						{/if}
					</div>
					{#if data.consents.length > 0}
						<p class="mt-2 text-[12px] text-[#98a2b3]">약관 이름을 누르면 동의한 전문을 볼 수 있습니다.</p>
					{/if}
				</section>
			</div>
		</div>
	</section>
</main>

<dialog
	bind:this={policyDialog}
	class="w-[min(100%-2rem,36rem)] rounded-2xl border-0 p-0 shadow-[0_24px_60px_rgba(15,23,42,0.18)] backdrop:bg-[#0f172a]/40"
	aria-labelledby="policy-dialog-title"
	onclick={onDialogClick}
	onclose={() => (selectedConsent = null)}
>
	{#if selectedConsent}
		<article class="max-h-[min(80vh,40rem)] overflow-y-auto">
			<header class="sticky top-0 flex items-start justify-between gap-3 border-b border-[#e5e7eb] bg-white px-5 py-4">
				<div>
					<h2 id="policy-dialog-title" class="text-[18px] font-bold text-[#111827]">{selectedConsent.title}</h2>
					<p class="mt-1 text-[13px] text-[#6b7280]">
						버전 {selectedConsent.version}
						{#if formatEffective(selectedConsent.effectiveAt)}
							· 시행일 {formatEffective(selectedConsent.effectiveAt)}
						{/if}
						{#if formatStamp(selectedConsent.agreedAt) !== '-'}
							· {formatStamp(selectedConsent.agreedAt)} 동의
						{/if}
					</p>
				</div>
				<button
					class="shrink-0 rounded-lg bg-[#2f6cf6] px-3 py-1.5 text-[13px] font-bold text-white"
					type="button"
					onclick={closeConsent}
				>
					닫기
				</button>
			</header>
			<div class="whitespace-pre-wrap px-5 py-5 text-[14px] leading-relaxed text-[#374151]">
				{selectedConsent.content || '이 버전의 약관 본문을 찾지 못했습니다.'}
			</div>
		</article>
	{/if}
</dialog>
