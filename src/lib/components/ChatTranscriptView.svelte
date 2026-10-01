<script>
	import {
		dialogMessageClock,
		filterUserFacingSystemMessages,
		parseSystemMessageText
	} from '$lib/realtime/conversationRecords.js';

	/**
	 * @typedef {{ role: 'user' | 'assistant', text: string }} DialogMessage
	 * @typedef {{ role: 'system', text: string }} SystemMessage
	 */

	let {
		savedAt = '',
		dialogMessages = [],
		systemMessages = [],
		emptyText = '대화가 시작되면 말한 순서대로 여기에 표시됩니다.',
		compact = false
	} = $props();

	const clockBase = $derived(savedAt || new Date().toISOString());
	const displaySystemMessages = $derived(filterUserFacingSystemMessages(systemMessages));
</script>

{#if dialogMessages.length === 0 && displaySystemMessages.length === 0}
	<p class="py-8 text-center text-[13px] text-[#999999]">{emptyText}</p>
{:else}
	{#if dialogMessages.length > 0}
		<section class={compact ? 'mt-3' : ''}>
			<h3 class="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[#374151]">
				<svg class="h-4 w-4 text-[#6b7280]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path
						d="M12 14a3 3 0 0 0 3-3V6a3 3 0 1 0-6 0v5a3 3 0 0 0 3 3Z"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					/>
					<path
						d="M19 11v1a7 7 0 0 1-14 0v-1M12 18v3"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
					/>
				</svg>
				음성 대화
			</h3>
			<ul class="space-y-4">
				{#each dialogMessages as m, i (i)}
					<li class="flex gap-2.5">
						{#if m.role === 'user'}
							<span
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#4a90e2] text-[11px] font-bold text-white"
								aria-hidden="true"
							>나</span>
							<div class="min-w-0 flex-1">
								<p class="mb-1 text-[12px] font-medium text-[#374151]">
									나
									<span class="ml-1 font-normal text-[#9ca3af]">{dialogMessageClock(clockBase, i)}</span>
								</p>
								<p
									class="inline-block max-w-full rounded-2xl rounded-tl-md bg-[#f3f4f6] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#1f2937]"
								>
									{m.text}
								</p>
							</div>
						{:else}
							<span
								class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#22c55e] text-[10px] font-bold text-white"
								aria-hidden="true"
							>AI</span>
							<div class="min-w-0 flex-1">
								<p class="mb-1 text-[12px] font-medium text-[#374151]">
									AI 선생님
									<span class="ml-1 font-normal text-[#9ca3af]">{dialogMessageClock(clockBase, i)}</span>
								</p>
								<p
									class="inline-block max-w-full rounded-2xl rounded-tl-md bg-[#f3f4f6] px-3.5 py-2.5 text-[13px] leading-relaxed text-[#1f2937]"
								>
									{m.text}
								</p>
							</div>
						{/if}
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if displaySystemMessages.length > 0}
		<section class="mt-5 border-t border-[#e5e7eb] pt-4">
			<h3 class="mb-3 flex items-center gap-2 text-[13px] font-semibold text-[#374151]">
				<svg class="h-4 w-4 text-[#6b7280]" viewBox="0 0 24 24" fill="none" aria-hidden="true">
					<path
						d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
						stroke="currentColor"
						stroke-width="2"
					/>
					<path
						d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 5 15.4a1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 5.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 1 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.36 0 .71.07 1.03.2H21a2 2 0 1 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1Z"
						stroke="currentColor"
						stroke-width="2"
					/>
				</svg>
				시스템 메시지
			</h3>
			<ul class="space-y-2.5">
				{#each displaySystemMessages as log, i (i)}
					{@const parsed = parseSystemMessageText(log.text)}
					{#if parsed.body}
						<li
							class="rounded-md border border-[#dbeafe] border-l-[5px] border-l-[#3b82f6] bg-[#eef6ff] px-3.5 py-3"
						>
							<p class="text-[13px] font-medium text-[#374151]">
								시스템
								{#if parsed.time}
									<span class="ml-1 font-normal text-[#9ca3af]">{parsed.time}</span>
								{/if}
							</p>
							<p class="mt-1 text-[13px] leading-relaxed text-[#374151]">{parsed.body}</p>
						</li>
					{/if}
				{/each}
			</ul>
		</section>
	{/if}
{/if}
