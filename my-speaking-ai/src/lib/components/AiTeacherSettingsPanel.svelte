<script>
	import {
		LEVEL_HINTS,
		LEVEL_LABELS,
		LANGUAGE_META,
		VAD_PRESET_META
	} from '$lib/realtime/tutorLevels.js';
	import {
		CUSTOM_PROMPT_MAX_LEN,
		DEFAULT_CUSTOM_PROMPT_KO,
		TEACHER_PERSONALITIES
	} from '$lib/realtime/tutorPersonalities.js';

	/** @typedef {import('$lib/realtime/tutorPersonalities.js').TeacherPersonalityId} TeacherPersonalityId */

	let {
		settingsLocked = false,
		level = 'beginner',
		languageMode = 'english',
		vadPreset = 'balanced',
		teacherPersonality = 'friendly',
		customPromptText = '',
		showCustomEditor = false,
		previewText = '',
		onSelectPersonality,
		onOpenCustom,
		onCustomPromptChange,
		onReset,
		onLevelChange,
		onLanguageModeChange,
		onVadChange,
		savedPrompts = [],
		promptCloudStatus = '',
		promptCloudError = '',
		onSaveNamedPrompt,
		onLoadSavedPrompt,
		onDeleteSavedPrompt,
		onRefreshSavedPrompts
	} = $props();

	let saveTitle = $state('');

	const levels = /** @type {const} */ (['beginner', 'intermediate', 'advanced']);
	const languageModes = /** @type {const} */ (['english', 'korean', 'mixed']);
	const vadPresets = /** @type {const} */ (['fast', 'balanced', 'patient']);
</script>

<div class="rounded-2xl bg-white px-4 py-5 shadow-sm ring-1 ring-[#e5e7eb]/80">
	<h2 class="text-[17px] font-bold text-[#111827]">AI 선생님 설정</h2>
	<p class="mt-3 text-[13px] font-medium text-[#6b7280]">선생님 성격 선택</p>

	<div class="mt-3 grid grid-cols-2 gap-2.5">
		{#each TEACHER_PERSONALITIES as persona (persona.id)}
			<button
				type="button"
				disabled={settingsLocked}
				class="rounded-xl border px-3 py-3 text-left transition {teacherPersonality === persona.id
					? 'border-[#4a90e2] bg-[#f8fbff] shadow-[0_0_0_1px_rgba(74,144,226,0.15)]'
					: 'border-[#e5e7eb] bg-[#fafafa] hover:border-[#cbd5e1]'}"
				onclick={() => onSelectPersonality?.(persona.id)}
			>
				<span class="text-xl leading-none" aria-hidden="true">{persona.emoji}</span>
				<p
					class="mt-2 text-[13px] font-bold {teacherPersonality === persona.id
						? 'text-[#2563eb]'
						: 'text-[#374151]'}"
				>
					{persona.title}
				</p>
				<p class="mt-0.5 text-[11px] leading-snug text-[#9ca3af]">{persona.subtitle}</p>
			</button>
		{/each}
	</div>

	<button
		type="button"
		disabled={settingsLocked}
		class="mt-3 w-full rounded-xl border border-dashed border-[#cbd5e1] bg-[#fafafa] px-4 py-3.5 text-left transition hover:border-[#94a3b8] hover:bg-white disabled:opacity-55"
		onclick={() => onOpenCustom?.()}
	>
		<p class="text-[13px] font-bold text-[#374151]">✏️ 직접 프롬프트 작성하기</p>
		<p class="mt-0.5 text-[11px] text-[#9ca3af]">원하는 선생님 스타일을 직접 설정해 보세요</p>
	</button>

	{#if showCustomEditor || teacherPersonality === 'custom'}
		<div class="mt-3">
			<label class="text-[12px] font-semibold text-[#374151]" for="custom-prompt">직접 작성</label>
			<textarea
				id="custom-prompt"
				class="mt-1.5 min-h-[120px] w-full rounded-xl border border-[#d1d5db] bg-white px-3 py-2.5 text-[12px] leading-relaxed text-[#374151] focus:border-[#4a90e2] focus:outline-none focus:ring-2 focus:ring-[#4a90e2]/20 disabled:bg-[#f3f4f6]"
				maxlength={CUSTOM_PROMPT_MAX_LEN}
				disabled={settingsLocked}
				placeholder={DEFAULT_CUSTOM_PROMPT_KO}
				value={customPromptText}
				oninput={(e) => onCustomPromptChange?.(e.currentTarget.value)}
			></textarea>
		</div>
	{/if}

	<div class="mt-4 rounded-xl border border-[#e5e7eb] bg-[#fafafa] px-3.5 py-3">
		<div class="flex items-center justify-between gap-2">
			<p class="text-[13px] font-semibold text-[#374151]">내 저장 프롬프트</p>
			<button
				type="button"
				class="text-[11px] font-semibold text-[#2563eb] hover:underline disabled:opacity-50"
				disabled={settingsLocked}
				onclick={() => onRefreshSavedPrompts?.()}
			>
				새로고침
			</button>
		</div>
		<p class="mt-0.5 text-[11px] text-[#9ca3af]">
			현재 대화 언어({LANGUAGE_META[languageMode].label})에 맞는 목록 · 계정에 자동 저장
		</p>
		{#if promptCloudError}
			<p class="mt-2 text-[12px] text-[#dc2626]">{promptCloudError}</p>
		{:else if promptCloudStatus}
			<p class="mt-2 text-[12px] text-[#059669]">{promptCloudStatus}</p>
		{/if}
		<div class="mt-2 flex gap-2">
			<input
				type="text"
				class="min-w-0 flex-1 rounded-lg border border-[#d1d5db] bg-white px-2.5 py-2 text-[12px] text-[#374151] focus:border-[#4a90e2] focus:outline-none disabled:bg-[#f3f4f6]"
				placeholder="저장할 이름 (예: 비즈니스 영어)"
				maxlength="80"
				disabled={settingsLocked}
				bind:value={saveTitle}
			/>
			<button
				type="button"
				class="shrink-0 rounded-lg bg-[#4a90e2] px-3 py-2 text-[12px] font-semibold text-white hover:bg-[#3b7bc8] disabled:opacity-50"
				disabled={settingsLocked || !saveTitle.trim() || !customPromptText.trim()}
				onclick={() => {
					const title = saveTitle.trim();
					if (!title) return;
					onSaveNamedPrompt?.(title);
					saveTitle = '';
				}}
			>
				저장
			</button>
		</div>
		{#if savedPrompts.length === 0}
			<p class="mt-3 text-[12px] text-[#9ca3af]">저장된 프롬프트가 없습니다. 직접 작성 후 이름을 붙여 저장해 보세요.</p>
		{:else}
			<ul class="mt-3 space-y-2">
				{#each savedPrompts as item (item.id)}
					<li
						class="flex items-start justify-between gap-2 rounded-lg border border-[#e5e7eb] bg-white px-2.5 py-2"
					>
						<div class="min-w-0 flex-1">
							<p class="truncate text-[12px] font-semibold text-[#374151]">{item.title}</p>
							<p class="mt-0.5 line-clamp-2 text-[11px] text-[#9ca3af]">{item.content}</p>
						</div>
						<div class="flex shrink-0 flex-col gap-1">
							<button
								type="button"
								class="rounded-md bg-[#eff6ff] px-2 py-1 text-[11px] font-semibold text-[#2563eb] hover:bg-[#dbeafe] disabled:opacity-50"
								disabled={settingsLocked}
								onclick={() => onLoadSavedPrompt?.(item)}
							>
								불러오기
							</button>
							<button
								type="button"
								class="rounded-md px-2 py-1 text-[11px] font-semibold text-[#dc2626] hover:bg-[#fef2f2] disabled:opacity-50"
								disabled={settingsLocked}
								onclick={() => onDeleteSavedPrompt?.(item.id)}
							>
								삭제
							</button>
						</div>
					</li>
				{/each}
			</ul>
		{/if}
	</div>

	<div class="mt-5">
		<p class="text-[13px] font-semibold text-[#374151]">현재 설정된 프롬프트</p>
		<div
			class="mt-2 max-h-36 overflow-y-auto rounded-xl bg-[#f3f4f6] px-3.5 py-3 text-[12px] leading-relaxed text-[#4b5563]"
		>
			{previewText}
		</div>
		<button
			type="button"
			class="mt-3 w-full rounded-xl bg-[#374151] py-3 text-[14px] font-semibold text-white transition hover:bg-[#1f2937] disabled:opacity-50"
			disabled={settingsLocked}
			onclick={() => onReset?.()}
		>
			기본값으로 초기화
		</button>
	</div>

	<div class="mt-4 rounded-xl bg-[#eff6ff] px-3.5 py-3 text-[12px] leading-relaxed text-[#1d4ed8]">
		<p class="font-bold">💡 프롬프트 작성 팁</p>
		<ul class="mt-2 list-disc space-y-1 pl-4">
			<li>선생님의 성격과 교수 스타일을 구체적으로 설명해 보세요</li>
			<li>원하는 대화 주제나 학습 목표를 명시해 보세요</li>
			<li>피드백 방식(즉시 교정 vs 대화 후 정리)을 정해 보세요</li>
			<li>한국어 사용 빈도도 조절할 수 있습니다</li>
		</ul>
	</div>

	<div class="mt-5 border-t border-[#e5e7eb] pt-4">
		<p class="text-[13px] font-semibold text-[#374151]">대화 환경</p>
		<p class="mt-0.5 text-[11px] text-[#9ca3af]">난이도 · 언어 · 턴 감지 (대화 중에는 변경 불가)</p>

		<p class="mt-3 text-[12px] font-medium text-[#6b7280]">난이도</p>
		<div class="mt-1.5 flex flex-wrap gap-2">
			{#each levels as lv}
				<button
					type="button"
					disabled={settingsLocked}
					class="rounded-full px-3 py-1.5 text-[12px] font-semibold {level === lv
						? 'bg-[#4a90e2] text-white'
						: 'bg-white text-[#374151] ring-1 ring-[#d1d5db]'}"
					onclick={() => onLevelChange?.(lv)}
				>
					{LEVEL_LABELS[lv]}
				</button>
			{/each}
		</div>
		<p class="mt-1 text-[11px] text-[#9ca3af]">{LEVEL_HINTS[level]}</p>

		<p class="mt-3 text-[12px] font-medium text-[#6b7280]">대화 언어</p>
		<div class="mt-1.5 flex flex-wrap gap-2">
			{#each languageModes as mode}
				<button
					type="button"
					disabled={settingsLocked}
					class="rounded-full px-3 py-1.5 text-[12px] font-semibold {languageMode === mode
						? 'bg-[#8b5cf6] text-white'
						: 'bg-white text-[#374151] ring-1 ring-[#d1d5db]'}"
					onclick={() => onLanguageModeChange?.(mode)}
				>
					{LANGUAGE_META[mode].label}
				</button>
			{/each}
		</div>

		<p class="mt-3 text-[12px] font-medium text-[#6b7280]">말 끊김 · VAD</p>
		<div class="mt-1.5 flex flex-wrap gap-2">
			{#each vadPresets as preset}
				<button
					type="button"
					disabled={settingsLocked}
					class="rounded-full px-3 py-1.5 text-[12px] font-semibold {vadPreset === preset
						? 'bg-[#22c55e] text-white'
						: 'bg-white text-[#374151] ring-1 ring-[#d1d5db]'}"
					onclick={() => onVadChange?.(preset)}
				>
					{VAD_PRESET_META[preset].label}
				</button>
			{/each}
		</div>
	</div>
</div>
