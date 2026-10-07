<script>
	let {
		label,
		name,
		autocomplete = 'current-password',
		minlength = 6,
		required = true,
		value = $bindable('')
	} = $props();

	let visible = $state(false);
</script>

<label class="block text-left text-[13px] font-semibold text-[#374151]">
	{label}
	<div class="relative mt-1.5">
		<input
			class="w-full rounded-xl border border-[#d1d5db] bg-white py-3 pl-3.5 pr-12 text-[15px] font-normal text-black outline-none focus:border-[#4a90e2] focus:ring-2 focus:ring-[#4a90e2]/20"
			type={visible ? 'text' : 'password'}
			{name}
			{autocomplete}
			{minlength}
			{required}
			bind:value
		/>
		<button
			type="button"
			class="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-xl text-[#6b7280] transition hover:text-[#374151] focus:outline-none focus-visible:text-[#4a90e2]"
			aria-label={visible ? '비밀번호 숨기기' : '비밀번호 표시'}
			aria-pressed={visible}
			onclick={() => (visible = !visible)}
		>
			{#if visible}
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
					<path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
					<path d="M1 1l22 22" />
					<path d="M9.88 9.88a3 3 0 0 0 4.24 4.24" />
				</svg>
			{:else}
				<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
					<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
					<circle cx="12" cy="12" r="3" />
				</svg>
			{/if}
		</button>
	</div>
</label>
