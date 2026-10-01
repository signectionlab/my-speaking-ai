<script>
	import ChatTranscriptView from '$lib/components/ChatTranscriptView.svelte';
	import {
		countDialogMessages,
		formatRecordShortDate,
		formatSavedDateLong,
		splitSessionMessages
	} from '$lib/realtime/conversationRecords.js';

	/** @typedef {import('$lib/realtime/conversationRecords.js').SavedConversation} SavedConversation */

	let {
		history = [],
		loading = false,
		error = '',
		expandedIds = {},
		onRefresh,
		onToggleExpand,
		onEdit,
		onDelete
	} = $props();
</script>

<div class="flex items-center justify-between gap-3 border-b border-[#b8d4f0]/80 pb-3">
	<h2 class="text-[16px] font-bold text-[#111827]">대화 기록</h2>
	<button
		type="button"
		class="shrink-0 rounded-lg border border-[#4a90e2] px-3 py-1.5 text-[13px] font-semibold text-[#4a90e2] transition hover:bg-[#eff6ff] disabled:opacity-50"
		disabled={loading}
		onclick={() => onRefresh?.()}
	>
		새로고침
	</button>
</div>

{#if error}
	<p class="mt-3 text-[12px] text-red-600" role="alert">{error}</p>
{/if}

<div class="mt-4 space-y-3">
	{#if loading}
		<p class="py-6 text-center text-[13px] text-[#9ca3af]">기록 불러오는 중…</p>
	{:else if history.length === 0}
		<p class="py-6 text-center text-[13px] text-[#9ca3af]">저장된 대화 세션이 없습니다.</p>
	{:else}
		{#each history as entry (entry.id)}
			{@const expanded = expandedIds[entry.id] === true}
			{@const { dialog, system } = splitSessionMessages(entry.messages)}
			{@const dialogCount = countDialogMessages(entry)}
			<article class="overflow-hidden rounded-xl border border-[#e5e7eb] bg-white shadow-sm">
				<header class="border-b border-[#f3f4f6] px-4 py-3">
					<div class="flex items-start justify-between gap-2">
						<div class="min-w-0 flex-1">
							<p class="truncate text-[14px] font-bold text-[#111827]">
								영어회화 기록 - {formatRecordShortDate(entry.savedAt)}
							</p>
							<p class="mt-1.5 flex items-center gap-1.5 text-[12px] text-[#6b7280]">
								<svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
									<rect x="3" y="4" width="18" height="18" rx="2" stroke="currentColor" stroke-width="2" />
									<path d="M16 2v4M8 2v4M3 10h18" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
								</svg>
								{formatSavedDateLong(entry.savedAt)}
							</p>
							<p class="mt-1 flex items-center gap-1.5 text-[12px] text-[#6b7280]">
								<svg class="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24" fill="none" aria-hidden="true">
									<path
										d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5Z"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
								{dialogCount}개 메시지
							</p>
						</div>
						<div class="flex shrink-0 items-center gap-1">
							<button
								type="button"
								class="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6] hover:text-[#374151]"
								title="현재 대화에서 보기"
								aria-label="현재 대화에서 보기"
								onclick={() => onEdit?.(entry)}
							>
								<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
									<path
										d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5Z"
										stroke="currentColor"
										stroke-width="2"
										stroke-linecap="round"
										stroke-linejoin="round"
									/>
								</svg>
							</button>
							<button
								type="button"
								class="rounded-lg p-2 text-[#6b7280] hover:bg-[#fef2f2] hover:text-[#dc2626]"
								title="삭제"
								aria-label="기록 삭제"
								onclick={() => onDelete?.(entry)}
							>
								<svg class="h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
									<path d="M3 6h18M8 6V4h8v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
									<path d="M10 11v6M14 11v6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
								</svg>
							</button>
							<button
								type="button"
								class="rounded-lg p-2 text-[#6b7280] hover:bg-[#f3f4f6]"
								aria-expanded={expanded}
								aria-label={expanded ? '접기' : '펼치기'}
								onclick={() => onToggleExpand?.(entry.id)}
							>
								<svg
									class="h-4 w-4 transition-transform {expanded ? 'rotate-180' : ''}"
									viewBox="0 0 24 24"
									fill="none"
									aria-hidden="true"
								>
									<path d="m6 9 6 6 6-6" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
								</svg>
							</button>
						</div>
					</div>
				</header>

				{#if expanded}
					<div class="px-4 py-4">
						<ChatTranscriptView
							savedAt={entry.savedAt}
							dialogMessages={dialog}
							systemMessages={system}
							compact
							emptyText="이 세션에 저장된 음성 대화가 없습니다."
						/>
					</div>
				{/if}
			</article>
		{/each}
	{/if}
</div>
