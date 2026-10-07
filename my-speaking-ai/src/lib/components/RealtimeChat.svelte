<script>
	import { onDestroy, onMount, tick } from 'svelte';
	import AiTeacherSettingsPanel from '$lib/components/AiTeacherSettingsPanel.svelte';
	import {
		defaultPromptStyles,
		defaultPromptStylesByMode,
		normalizePromptStyles,
		normalizePromptStylesByMode
	} from '$lib/realtime/tutorPromptFields.js';
	import {
		DEFAULT_CUSTOM_PROMPT_KO,
		applyPersonalityToStyles,
		previewPromptKo
	} from '$lib/realtime/tutorPersonalities.js';
	import ChatTranscriptView from '$lib/components/ChatTranscriptView.svelte';
	import ConversationHistoryPanel from '$lib/components/ConversationHistoryPanel.svelte';
	import { createConversation, deleteConversation, fetchConversations } from '$lib/realtime/conversationApi.js';
	import {
		createSavedPrompt,
		deleteSavedPrompt,
		fetchUserPrompts,
		savePromptDraft
	} from '$lib/realtime/promptApi.js';
	import {
		buildConversationInsertPayload,
		createUserSystemMessage,
		filterUserFacingSystemMessages,
		formatSavedDateLong,
		getSessionAiSettingsView,
		splitSessionMessages
	} from '$lib/realtime/conversationRecords.js';
	import { loadPrefs, savePrefs } from '$lib/realtime/conversationStorage.js';
	import {
		addResponseUsage,
		addTranscriptionUsage,
		createEmptyUsage,
		describeResponseTurn,
		describeTranscriptionTurn,
		REALTIME_MODEL,
		TRANSCRIPTION_MODEL,
		withDuration
	} from '$lib/realtime/realtimeUsage.js';
	import {
		SESSION_CLOSE_TIMEOUT_MS,
		verifyLocalTeardown
	} from '$lib/realtime/sessionLifecycle.js';

	let { embedded = false } = $props();

	let status = $state('idle');
	let statusText = $state('AI 튜터 설정 후 대화를 시작해 주세요.');
	let errorMessage = $state('');

	/** @type {'none' | 'active' | 'closing' | 'confirmed' | 'uncertain'} */
	let shutdownState = $state('none');
	let shutdownMessage = $state('');
	/** @type {{ micStopped: boolean, dataChannelClosed: boolean, peerClosed: boolean } | null} */
	let teardownCheck = $state(null);

	/** @type {((value: unknown) => void) | null} */
	let resolveSessionClosed = null;
	/** @type {ReturnType<typeof setTimeout> | null} */
	let sessionCloseTimeoutId = null;
	let stopInProgress = false;

	/** @typedef {{ id: string, t: string, level: 'info' | 'ok' | 'warn' | 'error', step: string, detail: string }} DebugEntry */
	/** @type {DebugEntry[]} */
	let debugLogs = $state([]);
	let showDebug = $state(false);
	let debugErrorsOnly = $state(false);
	/** @type {HTMLDivElement | null} */
	let debugScrollEl = $state(null);

	let level = $state('beginner');
	let vadPreset = $state('fast');
	let languageMode = $state('english');
	/** @type {Record<import('$lib/realtime/tutorPromptFields.js').LanguageMode, import('$lib/realtime/tutorPromptFields.js').PromptStyleSelection>} */
	let promptStylesByMode = $state(defaultPromptStylesByMode());
	/** @type {import('$lib/realtime/tutorPersonalities.js').TeacherPersonalityId} */
	let teacherPersonality = $state('friendly');
	/** @type {Record<import('$lib/realtime/tutorPromptFields.js').LanguageMode, string>} */
	let customPromptByMode = $state({ english: '', korean: '', mixed: '' });
	let showCustomPromptEditor = $state(false);
	/** @type {import('$lib/realtime/promptApi.js').SavedPrompt[]} */
	let savedPrompts = $state([]);
	let promptCloudStatus = $state('');
	let promptCloudError = $state('');
	/** @type {ReturnType<typeof setTimeout> | null} */
	let draftSaveTimer = null;

	/** @type {Array<{ role: 'user' | 'assistant', text: string }>} */
	let messages = $state([]);
	let history = $state([]);
	/** @type {{ rate: number, date: string } | null} */
	let usdKrw = $state(null);
	/** @type {'current' | 'history' | 'settings'} */
	let chatPanelTab = $state('current');
	/** @type {Record<string, boolean>} */
	let expandedHistoryIds = $state({});
	let historyLoading = $state(false);
	let historyError = $state('');
	let saveError = $state('');
	let lastSavedId = $state('');
	let viewingSavedAt = $state('');
	/** @type {ReturnType<typeof getSessionAiSettingsView> | null} */
	let viewingAiSettings = $state(null);
	let sessionStartedAt = $state('');
	/** @type {import('$lib/realtime/realtimeUsage.js').RealtimeUsage} */
	let sessionUsage = $state(createEmptyUsage());
	let sessionDebugLogStart = $state(0);
	/** @type {import('$lib/realtime/conversationRecords.js').ChatMessage[]} */
	let sessionSystemMessages = $state([]);

	/** @type {HTMLDivElement | null} */
	let chatScrollEl = $state(null);
	/** @type {HTMLCanvasElement | null} */
	let waveformCanvas = $state(null);

	let pc = null;
	let dc = null;
	let micStream = null;
	let audioEl = null;
	let audioContext = null;
	let analyser = null;
	let animationFrameId = null;

	let assistantIndex = -1;
	let pendingResponseMessageIndex = -1;
	let pendingAssistant = $state('');

	const BAR_COUNT = 72;
	const WAVE_COLOR = '#4a90e2';
	const isSessionActive = $derived(
		status === 'connecting' || status === 'live' || status === 'ending'
	);
	const settingsLocked = $derived(isSessionActive);
	const activeCustomPrompt = $derived(customPromptByMode[languageMode] ?? '');
	const settingsPreviewText = $derived(
		previewPromptKo({
			personalityId: teacherPersonality,
			customPromptText: activeCustomPrompt,
			languageMode
		})
	);
	const savedPromptsForMode = $derived(
		savedPrompts.filter((p) => p.languageMode === languageMode)
	);

	/** @type {'idle' | 'waiting' | 'connected'} */
	const apiLinkState = $derived.by(() => {
		if (status === 'live') return 'connected';
		if (status === 'connecting' || status === 'ending' || shutdownState === 'closing') {
			return 'waiting';
		}
		return 'idle';
	});

	onMount(() => {
		const prefs = loadPrefs();
		if (prefs.level === 'intermediate' || prefs.level === 'advanced') level = prefs.level;
		if (prefs.vadPreset === 'fast' || prefs.vadPreset === 'balanced' || prefs.vadPreset === 'patient') {
			vadPreset = prefs.vadPreset;
		}
		if (prefs.languageMode === 'english' || prefs.languageMode === 'korean' || prefs.languageMode === 'mixed') {
			languageMode = prefs.languageMode;
		}
		promptStylesByMode = normalizePromptStylesByMode(prefs.promptStylesByMode);
		if (
			prefs.teacherPersonality === 'friendly' ||
			prefs.teacherPersonality === 'strict' ||
			prefs.teacherPersonality === 'business' ||
			prefs.teacherPersonality === 'casual' ||
			prefs.teacherPersonality === 'custom'
		) {
			teacherPersonality = prefs.teacherPersonality;
		}
		if (prefs.customPromptByMode && typeof prefs.customPromptByMode === 'object') {
			customPromptByMode = {
				english: String(prefs.customPromptByMode.english ?? ''),
				korean: String(prefs.customPromptByMode.korean ?? ''),
				mixed: String(prefs.customPromptByMode.mixed ?? '')
			};
		}
		void refreshHistory();
		void loadUserPromptsFromCloud();
		logDebug('info', '디버그 패널 준비됨', { href: location.href });
		window.addEventListener('resize', handleResize);
		return () => window.removeEventListener('resize', handleResize);
	});

	function persistPrefs() {
		savePrefs({
			level,
			vadPreset,
			languageMode,
			teacherPersonality,
			customPromptByMode,
			promptStylesByMode: normalizePromptStylesByMode(promptStylesByMode)
		});
	}

	/** @param {import('$lib/realtime/tutorPersonalities.js').TeacherPersonalityId} id */
	function selectTeacherPersonality(id) {
		teacherPersonality = id;
		showCustomPromptEditor = id === 'custom';
		promptStylesByMode = {
			...promptStylesByMode,
			[languageMode]: applyPersonalityToStyles(id, languageMode)
		};
		persistPrefs();
	}

	function openCustomPromptEditor() {
		teacherPersonality = 'custom';
		showCustomPromptEditor = true;
		if (!customPromptByMode[languageMode]?.trim()) {
			customPromptByMode = {
				...customPromptByMode,
				[languageMode]: DEFAULT_CUSTOM_PROMPT_KO
			};
		}
		persistPrefs();
	}

	/** @param {string} value */
	function updateCustomPrompt(value) {
		customPromptByMode = { ...customPromptByMode, [languageMode]: value };
		teacherPersonality = 'custom';
		persistPrefs();
		schedulePromptDraftSave();
	}

	async function loadUserPromptsFromCloud() {
		promptCloudError = '';
		try {
			const bundle = await fetchUserPrompts();
			savedPrompts = bundle.saved;
			customPromptByMode = {
				english: bundle.drafts.english?.content ?? customPromptByMode.english,
				korean: bundle.drafts.korean?.content ?? customPromptByMode.korean,
				mixed: bundle.drafts.mixed?.content ?? customPromptByMode.mixed
			};
			persistPrefs();
		} catch (err) {
			promptCloudError =
				err instanceof Error ? err.message : '클라우드 프롬프트를 불러오지 못했습니다.';
		}
	}

	function schedulePromptDraftSave() {
		if (draftSaveTimer !== null) clearTimeout(draftSaveTimer);
		draftSaveTimer = setTimeout(() => {
			void persistPromptDraftToCloud();
		}, 900);
	}

	async function persistPromptDraftToCloud() {
		promptCloudError = '';
		try {
			await savePromptDraft(languageMode, customPromptByMode[languageMode] ?? '');
			promptCloudStatus = '작성 중인 프롬프트가 계정에 저장되었습니다.';
		} catch (err) {
			promptCloudError =
				err instanceof Error ? err.message : '프롬프트 초안 저장에 실패했습니다.';
		}
	}

	/** @param {string} title */
	async function saveNamedPromptToCloud(title) {
		promptCloudError = '';
		promptCloudStatus = '';
		try {
			await createSavedPrompt({
				title,
				languageMode,
				content: customPromptByMode[languageMode] ?? ''
			});
			await loadUserPromptsFromCloud();
			promptCloudStatus = '「' + title.trim() + '」 프롬프트를 저장했습니다.';
		} catch (err) {
			promptCloudError = err instanceof Error ? err.message : '프롬프트 저장에 실패했습니다.';
		}
	}

	/** @param {import('$lib/realtime/promptApi.js').SavedPrompt} item */
	function loadSavedPromptFromCloud(item) {
		customPromptByMode = { ...customPromptByMode, [item.languageMode]: item.content };
		languageMode = item.languageMode;
		teacherPersonality = 'custom';
		showCustomPromptEditor = true;
		persistPrefs();
		void persistPromptDraftToCloud();
		promptCloudStatus = '「' + item.title + '」 프롬프트를 불러왔습니다.';
	}

	/** @param {string} id */
	async function deleteSavedPromptFromCloud(id) {
		promptCloudError = '';
		try {
			await deleteSavedPrompt(id);
			savedPrompts = savedPrompts.filter((p) => p.id !== id);
			promptCloudStatus = '저장 프롬프트를 삭제했습니다.';
		} catch (err) {
			promptCloudError = err instanceof Error ? err.message : '프롬프트 삭제에 실패했습니다.';
		}
	}

	function resetTeacherSettings() {
		teacherPersonality = 'friendly';
		showCustomPromptEditor = false;
		customPromptByMode = { english: '', korean: '', mixed: '' };
		promptStylesByMode = defaultPromptStylesByMode();
		persistPrefs();
	}

	function redactSecrets(value) {
		const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2);
		return text
			.replace(/sk-[A-Za-z0-9_-]{8,}/g, 'sk-***')
			.replace(/ek_[A-Za-z0-9_-]{8,}/g, 'ek_***')
			.replace(/Bearer\s+\S+/gi, 'Bearer ***');
	}

	function truncate(text, max = 1400) {
		if (text.length <= max) return text;
		return `${text.slice(0, max)}… (${text.length}자)`;
	}

	function formatTime(iso) {
		try {
			return new Intl.DateTimeFormat('ko-KR', {
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit'
			}).format(new Date(iso));
		} catch {
			return iso;
		}
	}

	/**
	 * @param {'info' | 'ok' | 'warn' | 'error'} levelName
	 * @param {string} step
	 * @param {unknown} [detail]
	 */
	function logDebug(levelName, step, detail) {
		const text = detail === undefined || detail === '' ? '' : truncate(redactSecrets(detail));
		debugLogs = [
			...debugLogs.slice(-199),
			{
				id: crypto.randomUUID(),
				t: new Date().toISOString(),
				level: levelName,
				step,
				detail: text
			}
		];
		tick().then(() => {
			if (debugScrollEl) debugScrollEl.scrollTop = debugScrollEl.scrollHeight;
		});
	}

	function summarizeRealtimeEvent(event) {
		if (!event || typeof event !== 'object') return { raw: String(event) };
		const type = event.type ?? '(no type)';
		if (type === 'response.output_audio_transcript.delta') {
			return { type, deltaChars: (event.delta ?? '').length };
		}
		if (type === 'response.output_audio.delta') {
			return { type, audioDelta: true };
		}
		const copy = { ...event };
		if (typeof copy.delta === 'string' && copy.delta.length > 80) {
			copy.delta = `${copy.delta.slice(0, 80)}…`;
		}
		if (typeof copy.transcript === 'string' && copy.transcript.length > 160) {
			copy.transcript = `${copy.transcript.slice(0, 160)}…`;
		}
		return copy;
	}

	async function readResponseBody(res) {
		const raw = await res.text();
		try {
			return { raw, json: JSON.parse(raw) };
		} catch {
			return { raw, json: null };
		}
	}

	function copyDebugLogs() {
		const text = debugLogs
			.map((e) => `[${formatTime(e.t)}] ${e.level.toUpperCase()} ${e.step}${e.detail ? `\n${e.detail}` : ''}`)
			.join('\n\n');
		navigator.clipboard?.writeText(text).then(
			() => logDebug('ok', '디버그 로그 복사됨'),
			() => logDebug('warn', '클립보드 복사 실패')
		);
	}

	function scrollChatToBottom() {
		tick().then(() => {
			if (chatScrollEl) chatScrollEl.scrollTop = chatScrollEl.scrollHeight;
		});
	}

	function appendMessage(
		/** @type {'user' | 'assistant'} */ role,
		/** @type {string} */ text,
		/** @type {import('$lib/realtime/realtimeUsage.js').MessageTurnUsage | null} */ turnUsage = null
	) {
		messages = [...messages, turnUsage ? { role, text, turnUsage } : { role, text }];
		const idx = messages.length - 1;
		scrollChatToBottom();
		return idx;
	}

	function attachTurnUsage(
		/** @type {number} */ index,
		/** @type {import('$lib/realtime/realtimeUsage.js').MessageTurnUsage | null} */ turnUsage
	) {
		if (!turnUsage || index < 0 || index >= messages.length) return;
		messages = messages.map((m, i) => (i === index ? { ...m, turnUsage } : m));
	}

	function updateMessage(/** @type {number} */ index, /** @type {string} */ text) {
		if (index < 0 || index >= messages.length) return;
		messages = messages.map((m, i) => (i === index ? { ...m, text } : m));
		scrollChatToBottom();
	}

	function flushPendingAssistant() {
		if (!pendingAssistant.trim()) {
			pendingAssistant = '';
			return;
		}
		assistantIndex = appendMessage('assistant', pendingAssistant.trim());
		pendingResponseMessageIndex = assistantIndex;
		pendingAssistant = '';
	}

	function handleServerEvent(
		/** @type {{ type: string, delta?: string, transcript?: string, usage?: unknown, response?: { usage?: unknown, model?: string }, error?: { message?: string } }} */ event
	) {
		switch (event.type) {
			case 'response.output_audio_transcript.delta': {
				const delta = event.delta ?? '';
				if (assistantIndex >= 0) {
					updateMessage(assistantIndex, (messages[assistantIndex]?.text ?? '') + delta);
				} else if (pendingAssistant || delta) {
					pendingAssistant += delta;
					scrollChatToBottom();
				}
				break;
			}
			case 'response.output_audio_transcript.done': {
				if (assistantIndex === -1 && pendingAssistant.trim()) {
					flushPendingAssistant();
				} else if (assistantIndex >= 0) {
					pendingResponseMessageIndex = assistantIndex;
				}
				assistantIndex = -1;
				pendingAssistant = '';
				break;
			}
			case 'response.done': {
				if (event.response?.usage) sessionUsage = addResponseUsage(sessionUsage, event.response.usage);
				if (assistantIndex === -1 && pendingAssistant.trim()) {
					flushPendingAssistant();
				} else if (assistantIndex >= 0) {
					pendingResponseMessageIndex = assistantIndex;
				}
				const responseModel =
					typeof event.response?.model === 'string' && event.response.model.trim()
						? event.response.model.trim()
						: REALTIME_MODEL;
				attachTurnUsage(
					pendingResponseMessageIndex,
					describeResponseTurn(event.response?.usage ?? {}, responseModel)
				);
				assistantIndex = -1;
				pendingResponseMessageIndex = -1;
				break;
			}
			case 'conversation.item.input_audio_transcription.completed': {
				if (event.usage) sessionUsage = addTranscriptionUsage(sessionUsage, event.usage);
				const text = event.transcript?.trim();
				if (!text) break;
				appendMessage(
					'user',
					text,
					describeTranscriptionTurn(event.usage ?? {}, TRANSCRIPTION_MODEL)
				);
				logDebug('ok', '사용자 음성 전사 완료', text);
				if (pendingAssistant.trim()) {
					flushPendingAssistant();
				}
				break;
			}
			case 'session.closed': {
				logDebug('ok', 'Realtime ← session.closed (과금 세션 종료 확인)', summarizeRealtimeEvent(event));
				resolveGracefulClose(event);
				break;
			}
			case 'error': {
				errorMessage = event.error?.message ?? '대화 중 오류가 발생했습니다.';
				logDebug('error', 'Realtime error 이벤트', event);
				break;
			}
			default:
				if (
					event.type &&
					!String(event.type).includes('delta') &&
					event.type !== 'response.output_audio.done'
				) {
					logDebug('info', `Realtime ← ${event.type}`, summarizeRealtimeEvent(event));
				}
				break;
		}
	}

	function stopVisualization() {
		if (animationFrameId !== null) {
			cancelAnimationFrame(animationFrameId);
			animationFrameId = null;
		}
		if (audioContext) {
			audioContext.close().catch(() => {});
			audioContext = null;
		}
		analyser = null;
		drawWaveform(null);
	}

	function setupVisualization(/** @type {MediaStream} */ mediaStream) {
		stopVisualization();
		audioContext = new AudioContext();
		analyser = audioContext.createAnalyser();
		analyser.fftSize = 512;
		analyser.smoothingTimeConstant = 0.75;
		const source = audioContext.createMediaStreamSource(mediaStream);
		source.connect(analyser);
		const dataArray = new Uint8Array(analyser.frequencyBinCount);
		const loop = () => {
			if (!analyser) return;
			analyser.getByteFrequencyData(dataArray);
			drawWaveform(dataArray);
			animationFrameId = requestAnimationFrame(loop);
		};
		animationFrameId = requestAnimationFrame(loop);
	}

	function resizeCanvas() {
		const canvas = waveformCanvas;
		if (!canvas) return;
		const rect = canvas.getBoundingClientRect();
		const dpr = window.devicePixelRatio || 1;
		canvas.width = Math.max(1, Math.floor(rect.width * dpr));
		canvas.height = Math.max(1, Math.floor(rect.height * dpr));
	}

	function sampleBars(/** @type {Uint8Array | null} */ data) {
		/** @type {number[]} */
		const bars = [];
		if (!data?.length) {
			for (let i = 0; i < BAR_COUNT; i++) {
				const t = i / BAR_COUNT;
				bars.push(32 + Math.sin(t * Math.PI * 5) * 18);
			}
			return bars;
		}
		const step = Math.max(1, Math.floor(data.length / BAR_COUNT));
		for (let i = 0; i < BAR_COUNT; i++) {
			bars.push(data[Math.min(data.length - 1, i * step)] ?? 0);
		}
		return bars;
	}

	function drawWaveform(/** @type {Uint8Array | null} */ frequencyData) {
		const canvas = waveformCanvas;
		if (!canvas) return;
		resizeCanvas();
		const ctx = canvas.getContext('2d');
		if (!ctx) return;
		const dpr = window.devicePixelRatio || 1;
		const width = canvas.width;
		const height = canvas.height;
		ctx.fillStyle = '#000';
		ctx.fillRect(0, 0, width, height);
		const bars = sampleBars(frequencyData);
		const gap = 2 * dpr;
		const barWidth = (width - gap * (BAR_COUNT - 1)) / BAR_COUNT;
		ctx.fillStyle = WAVE_COLOR;
		for (let i = 0; i < BAR_COUNT; i++) {
			const barHeight = Math.max(4 * dpr, (bars[i] / 255) * height * 0.92);
			ctx.fillRect(i * (barWidth + gap), height - barHeight, barWidth, barHeight);
		}
	}

	function handleResize() {
		if (status === 'live') return;
		drawWaveform(null);
	}

	function stopMicSend() {
		try {
			micStream?.getAudioTracks().forEach((t) => {
				t.enabled = false;
				t.stop();
			});
		} catch {}
		logDebug('ok', '마이크 송신 중지', { tracks: micStream?.getAudioTracks().length ?? 0 });
	}

	function clearSessionCloseWait() {
		if (sessionCloseTimeoutId !== null) {
			clearTimeout(sessionCloseTimeoutId);
			sessionCloseTimeoutId = null;
		}
		resolveSessionClosed = null;
	}

	/** @param {{ type: string }} payload */
	function resolveGracefulClose(payload) {
		if (!resolveSessionClosed) return;
		resolveSessionClosed(payload);
		resolveSessionClosed = null;
		if (sessionCloseTimeoutId !== null) {
			clearTimeout(sessionCloseTimeoutId);
			sessionCloseTimeoutId = null;
		}
	}

	function finalizeCleanup() {
		stopVisualization();
		stopMicSend();
		try {
			if (dc && dc.readyState !== 'closed') dc.close();
		} catch {}
		try {
			if (pc && pc.connectionState !== 'closed') pc.close();
		} catch {}
		const check = verifyLocalTeardown(pc, dc, micStream);
		teardownCheck = {
			micStopped: check.micStopped,
			dataChannelClosed: check.dataChannelClosed,
			peerClosed: check.peerClosed
		};
		logDebug(
			check.micStopped && check.dataChannelClosed && check.peerClosed ? 'ok' : 'warn',
			'로컬 연결 해제 검증',
			check
		);
		micStream = null;
		dc = null;
		pc = null;
		assistantIndex = -1;
		pendingResponseMessageIndex = -1;
		pendingAssistant = '';
		if (audioEl) audioEl.srcObject = null;
		clearSessionCloseWait();
	}

	/** @param {boolean} [force] */
	function cleanup(force = false) {
		if (!force && stopInProgress) return;
		finalizeCleanup();
	}

	/** @param {string} body */
	function appendSessionSystemMessage(body) {
		sessionSystemMessages = [
			...sessionSystemMessages,
			createUserSystemMessage(new Date().toISOString(), body)
		];
	}

	async function refreshHistory() {
		historyLoading = true;
		historyError = '';
		try {
			const listed = await fetchConversations();
			history = listed.conversations;
			usdKrw = listed.exchange;
		} catch (err) {
			history = [];
			usdKrw = null;
			historyError = err instanceof Error ? err.message : '대화 기록을 불러오지 못했습니다.';
			logDebug('error', '대화 기록 불러오기 실패', historyError);
		} finally {
			historyLoading = false;
		}
	}

	/** @param {string} id */
	function toggleHistoryExpand(id) {
		expandedHistoryIds = { ...expandedHistoryIds, [id]: !expandedHistoryIds[id] };
	}

	/** @param {import('$lib/realtime/conversationRecords.js').SavedConversation} entry */
	async function deleteHistoryEntry(entry) {
		if (!confirm('이 대화 기록을 삭제할까요?')) return;
		historyError = '';
		try {
			await deleteConversation(entry.id);
			if (lastSavedId === entry.id) clearSavedSessionView();
			const next = { ...expandedHistoryIds };
			delete next[entry.id];
			expandedHistoryIds = next;
			await refreshHistory();
		} catch (err) {
			historyError = err instanceof Error ? err.message : '대화 기록을 삭제하지 못했습니다.';
		}
	}

	/** @returns {Promise<boolean>} */
	async function persistCurrentChat() {
		const systemToSave = filterUserFacingSystemMessages(sessionSystemMessages);
		if (messages.length === 0 && systemToSave.length === 0) return false;

		saveError = '';
		const started = Date.parse(sessionStartedAt);
		const durationMs = Number.isNaN(started) ? 0 : Date.now() - started;
		const payload = buildConversationInsertPayload({
			sessionStartedAt: sessionStartedAt || new Date().toISOString(),
			level,
			vadPreset,
			languageMode,
			teacherPersonality,
			customPromptText:
				teacherPersonality === 'custom' ? (customPromptByMode[languageMode] ?? '') : undefined,
			dialogMessages: messages,
			systemMessages: systemToSave,
			usage: withDuration(sessionUsage, durationMs)
		});

		try {
			const saved = await createConversation(payload);
			lastSavedId = saved.id;
			await refreshHistory();
			logDebug('ok', '대화 세션 저장됨', { id: saved.id, savedAt: payload.savedAt });
			return true;
		} catch (err) {
			saveError = err instanceof Error ? err.message : '대화 저장에 실패했습니다.';
			logDebug('error', '대화 세션 저장 실패', saveError);
			return false;
		}
	}

	async function start() {
		if (isSessionActive) return;
		errorMessage = '';
		messages = [];
		sessionSystemMessages = [];
		viewingSavedAt = '';
		viewingAiSettings = null;
		lastSavedId = '';
		sessionStartedAt = new Date().toISOString();
		sessionUsage = createEmptyUsage();
		sessionDebugLogStart = debugLogs.length;
		assistantIndex = -1;
		pendingResponseMessageIndex = -1;
		pendingAssistant = '';
		persistPrefs();
		shutdownState = 'none';
		shutdownMessage = '';
		teardownCheck = null;
		status = 'connecting';
		statusText = '연결 중…';
		logDebug('info', '세션 시작', { level, vadPreset, languageMode });

		if (!navigator.mediaDevices?.getUserMedia || typeof RTCPeerConnection === 'undefined') {
			status = 'error';
			errorMessage = '이 브라우저는 실시간 음성 대화를 지원하지 않습니다.';
			logDebug('error', '브라우저 미지원', {
				getUserMedia: !!navigator.mediaDevices?.getUserMedia,
				RTCPeerConnection: typeof RTCPeerConnection !== 'undefined'
			});
			return;
		}

		try {
			logDebug('info', 'POST /api/token', { level, vadPreset, languageMode });
			const tokenStarted = performance.now();
			const tokenRes = await fetch('/api/token', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					level,
					vadPreset,
					languageMode,
					teacherPersonality,
					customPromptText: customPromptByMode[languageMode] ?? '',
					promptStyles: normalizePromptStyles(languageMode, promptStylesByMode[languageMode])
				})
			});
			const tokenBody = await readResponseBody(tokenRes);
			const tokenMs = Math.round(performance.now() - tokenStarted);
			if (!tokenRes.ok) {
				const msg =
					typeof tokenBody.json?.error === 'string'
						? tokenBody.json.error
						: '음성 세션을 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.';
				logDebug('error', `POST /api/token ${tokenRes.status} (${tokenMs}ms)`, {
					status: tokenRes.status
				});
				throw new Error(msg);
			}
			const ephemeralKey = tokenBody.json?.value;
			logDebug('ok', `POST /api/token ${tokenRes.status} (${tokenMs}ms)`, {
				ok: tokenBody.json?.ok,
				hasKey: Boolean(ephemeralKey),
				keyPrefix: typeof ephemeralKey === 'string' ? ephemeralKey.slice(0, 3) : null,
				level: tokenBody.json?.level,
				vadPreset: tokenBody.json?.vadPreset,
				languageMode: tokenBody.json?.languageMode
			});
			if (!ephemeralKey) throw new Error('발급된 토큰이 비어 있습니다.');

			const connection = new RTCPeerConnection();
			pc = connection;
			logDebug('info', 'RTCPeerConnection 생성');
			connection.addEventListener('connectionstatechange', () => {
				logDebug(
					connection.connectionState === 'failed' ? 'error' : 'info',
					`WebRTC connectionState: ${connection.connectionState}`
				);
			});
			connection.addEventListener('iceconnectionstatechange', () => {
				logDebug(
					connection.iceConnectionState === 'failed' ? 'error' : 'info',
					`ICE: ${connection.iceConnectionState}`
				);
			});
			connection.addEventListener('icecandidateerror', (e) => {
				logDebug('warn', 'ICE candidate error', {
					errorCode: e.errorCode,
					errorText: e.errorText,
					url: e.url
				});
			});
			connection.ontrack = (e) => {
				logDebug('ok', '원격 오디오 트랙 수신', { streams: e.streams.length });
				if (audioEl) {
					audioEl.srcObject = e.streams[0];
					audioEl.play().catch((playErr) => {
						logDebug('warn', '오디오 자동재생 실패', playErr instanceof Error ? playErr.message : playErr);
					});
				}
			};

			try {
				micStream = await navigator.mediaDevices.getUserMedia({
					audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }
				});
				logDebug('ok', '마이크 권한 허용', {
					tracks: micStream.getAudioTracks().map((t) => t.label || t.kind)
				});
			} catch (micErr) {
				const name = /** @type {Error} */ (micErr).name;
				logDebug('error', 'getUserMedia 실패', { name, message: /** @type {Error} */ (micErr).message });
				throw micErr;
			}
			setupVisualization(micStream);
			for (const track of micStream.getAudioTracks()) {
				connection.addTrack(track, micStream);
			}

			const channel = connection.createDataChannel('oai-events');
			dc = channel;
			channel.addEventListener('open', () => {
				logDebug('ok', 'oai-events 데이터 채널 open');
				if (!sessionStartedAt) sessionStartedAt = new Date().toISOString();
				shutdownState = 'active';
				status = 'live';
				statusText = '대화 중 — 말씀해 주세요';
				appendSessionSystemMessage('새로운 영어회화 세션이 시작되었습니다.');
			});
			channel.addEventListener('error', () => {
				logDebug('error', 'oai-events 데이터 채널 error');
			});
			channel.addEventListener('message', (e) => {
				try {
					const event = JSON.parse(e.data);
					if (event.type === 'error') {
						logDebug('error', 'Realtime ← error', summarizeRealtimeEvent(event));
					}
					handleServerEvent(event);
				} catch {
					logDebug('warn', '데이터 채널 JSON 파싱 실패', String(e.data).slice(0, 200));
				}
			});
			channel.addEventListener('close', () => {
				logDebug('warn', 'oai-events 데이터 채널 close');
				if (stopInProgress) {
					logDebug('info', '종료 요청 후 데이터 채널 close (transport 종료)');
					resolveGracefulClose({ type: 'transport.channel_closed' });
					return;
				}
				if (status === 'live') {
					status = 'idle';
					shutdownState = 'uncertain';
					shutdownMessage = '연결이 끊겼습니다. OpenAI 사용량을 확인해 주세요.';
					statusText = '연결이 예기치 않게 종료되었습니다.';
					appendSessionSystemMessage(
						'🛑 연결 해제됨 - 연결이 예기치 않게 끊겼습니다. API 통신과 오디오가 중단되었습니다.'
					);
					void persistCurrentChat();
					finalizeCleanup();
				}
			});

			const offer = await connection.createOffer();
			await connection.setLocalDescription(offer);
			logDebug('info', 'SDP offer 생성', { chars: offer.sdp?.length ?? 0 });

			const sdpStarted = performance.now();
			logDebug('info', 'POST /v1/realtime/calls');
			const sdpRes = await fetch('https://api.openai.com/v1/realtime/calls', {
				method: 'POST',
				body: offer.sdp,
				headers: {
					Authorization: `Bearer ${ephemeralKey}`,
					'Content-Type': 'application/sdp'
				}
			});
			const sdpMs = Math.round(performance.now() - sdpStarted);
			const answerSdp = await sdpRes.text();
			if (!sdpRes.ok) {
				logDebug('error', `POST /v1/realtime/calls ${sdpRes.status} (${sdpMs}ms)`, answerSdp);
				throw new Error(answerSdp || 'Realtime 연결 실패');
			}
			logDebug('ok', `POST /v1/realtime/calls ${sdpRes.status} (${sdpMs}ms)`, {
				answerChars: answerSdp.length
			});
			await connection.setRemoteDescription({ type: 'answer', sdp: answerSdp });
			logDebug('ok', 'SDP answer 적용 완료');
		} catch (err) {
			status = 'error';
			errorMessage = err instanceof Error ? err.message : '연결에 실패했습니다.';
			logDebug('error', '세션 연결 실패', err instanceof Error ? { name: err.name, message: err.message } : err);
			cleanup(true);
		}
	}

	/**
	 * OpenAI Realtime: session.close → session.closed 대기 후 로컬 연결 해제
	 * @see https://developers.openai.com/api/docs/guides/voice-webrtc
	 */
	async function stop() {
		if (status !== 'live' && status !== 'connecting') return;
		if (stopInProgress) return;
		stopInProgress = true;

		logDebug('info', '사용자가 대화 종료 요청');
		status = 'ending';
		shutdownState = 'closing';
		shutdownMessage = '';
		statusText = 'API 세션 종료 중… (과금 중단 요청)';

		stopMicSend();

		let serverAck = false;
		let saved = false;
		if (dc?.readyState === 'open') {
			const closedPromise = new Promise((resolve) => {
				resolveSessionClosed = resolve;
			});
			try {
				dc.send(JSON.stringify({ type: 'session.close' }));
				logDebug('info', 'session.close 전송됨 — session.closed 대기');
			} catch (err) {
				logDebug('error', 'session.close 전송 실패', err instanceof Error ? err.message : err);
			}

			const waitResult = await Promise.race([
				closedPromise.then((ev) => ({ kind: 'closed', ev })),
				new Promise((resolve) => {
					sessionCloseTimeoutId = setTimeout(
						() => resolve({ kind: 'timeout' }),
						SESSION_CLOSE_TIMEOUT_MS
					);
				})
			]);
			clearSessionCloseWait();

			if (waitResult.kind === 'closed') {
				const closeType = waitResult.ev?.type;
				if (closeType === 'session.closed') {
					serverAck = true;
					shutdownState = 'confirmed';
					shutdownMessage =
						'OpenAI가 session.closed를 보냈습니다. Realtime 세션이 종료되어 추가 과금이 발생하지 않습니다.';
					logDebug('ok', '세션 종료 서버 확인 완료 (session.closed)');
				} else if (closeType === 'transport.channel_closed') {
					serverAck = true;
					shutdownState = 'confirmed';
					shutdownMessage =
						'OpenAI WebRTC 연결이 종료되었습니다. session.closed JSON은 없었지만, 서버가 채널을 닫아 세션이 끝난 것으로 보입니다. 마이크·전송도 모두 중지되었습니다.';
					logDebug('ok', '세션 종료 확인 (데이터 채널 close)');
				}
			} else {
				shutdownState = 'uncertain';
				shutdownMessage =
					`${SESSION_CLOSE_TIMEOUT_MS / 1000}초 동안 OpenAI 종료 확인(session.closed 또는 채널 close)을 받지 못했습니다. 로컬 연결은 끊었으므로 브라우저에서 더 이상 음성을 보내지 않습니다. Realtime GA(/v1/realtime/calls) 경로에서는 확인 이벤트가 늦거나 생략될 수 있습니다.`;
				logDebug('warn', 'session.closed 타임아웃 — 로컬 강제 종료');
			}
		} else {
			shutdownState = 'uncertain';
			shutdownMessage =
				'데이터 채널이 없어 session.close를 보내지 못했습니다. 마이크·WebRTC만 종료했습니다.';
			logDebug('warn', 'graceful close 불가 (dc not open)');
		}

		finalizeCleanup();
		appendSessionSystemMessage(
			'🛑 연결 해제됨 - 모든 API 통신과 오디오가 즉시 중단되었습니다.'
		);
		saved = await persistCurrentChat();
		status = 'idle';
		statusText = serverAck
			? '종료 완료 · API 세션 닫힘'
			: '연결 종료 · 서버 확인 미수신';
		if (saved) statusText += ' · 대화 저장됨';
		else if (messages.length > 0 && saveError) statusText += ' · 저장 실패';

		stopInProgress = false;
	}

	function onMicButtonClick() {
		if (status === 'live') void stop();
		else if (status === 'idle' || status === 'error') void start();
	}

	function loadHistoryEntry(/** @type {import('$lib/realtime/conversationRecords.js').SavedConversation} */ entry) {
		const { dialog, system } = splitSessionMessages(entry.messages);
		messages = [...dialog];
		sessionSystemMessages = filterUserFacingSystemMessages(system);
		level =
			entry.level === 'intermediate' || entry.level === 'advanced' ? entry.level : 'beginner';
		vadPreset =
			entry.vadPreset === 'fast' || entry.vadPreset === 'patient' ? entry.vadPreset : 'balanced';
		languageMode =
			entry.languageMode === 'english' || entry.languageMode === 'korean' || entry.languageMode === 'mixed'
				? entry.languageMode
				: 'english';
		chatPanelTab = 'current';
		viewingSavedAt = entry.savedAt;
		viewingAiSettings = getSessionAiSettingsView(entry);
		lastSavedId = entry.id;
		statusText = `${formatSavedDateLong(entry.savedAt)} 세션 기록을 불러왔습니다.`;
		scrollChatToBottom();
	}

	function clearSavedSessionView() {
		viewingSavedAt = '';
		viewingAiSettings = null;
		sessionSystemMessages = [];
		messages = [];
		statusText = 'AI 튜터 설정 후 대화를 시작해 주세요.';
	}

	$effect(() => {
		if (waveformCanvas && status !== 'live') {
			tick().then(() => drawWaveform(null));
		}
	});

	const sessionDebugCount = $derived(Math.max(0, debugLogs.length - sessionDebugLogStart));
	const visibleDebugLogs = $derived(
		debugErrorsOnly ? debugLogs.filter((e) => e.level === 'error' || e.level === 'warn') : debugLogs
	);

	onDestroy(() => {
		if (draftSaveTimer !== null) clearTimeout(draftSaveTimer);
		if (dc?.readyState === 'open') {
			try {
				dc.send(JSON.stringify({ type: 'session.close' }));
			} catch {}
		}
		cleanup(true);
	});
</script>

{#if !embedded}
	<section class="mx-auto w-full max-w-md">
		<div class="overflow-hidden rounded-[28px] bg-white px-8 pb-10 pt-9 shadow-[0_20px_50px_rgba(15,23,42,0.08)]">
			<header class="text-center">
				<h1 class="text-[22px] font-bold tracking-tight text-black">실시간 AI 영어 회화</h1>
			</header>
			{@render body()}
		</div>
	</section>
{:else}
	{@render body()}
{/if}

{#snippet body()}
	{#if errorMessage}
		<div
			class="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm leading-relaxed whitespace-pre-line text-red-800"
			role="alert"
		>
			{errorMessage}
		</div>
	{/if}

	<div
		class="mx-auto mt-6 w-full max-w-[360px] rounded-2xl border p-4 {apiLinkState === 'connected'
			? 'border-[#fecaca] bg-[#fef2f2]'
			: apiLinkState === 'waiting'
				? 'border-[#fde68a] bg-[#fffbeb]'
				: 'border-[#bbf7d0] bg-[#f0fdf4]'}"
		role="status"
	>
		<h2 class="text-[15px] font-bold text-[#111827]">API 상태</h2>

		{#if apiLinkState === 'connected'}
			<p class="mt-2 flex items-center gap-2 text-[14px] font-bold text-[#b91c1c]">
				<span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#ef4444]" aria-hidden="true"></span>
				연결됨 · 과금 중
			</p>
			<p class="mt-1.5 text-[13px] leading-relaxed text-[#7f1d1d]">
				OpenAI Realtime API에 연결되어 있습니다. 대화가 이어지는 동안 사용량에 따라 과금됩니다. 종료하려면
				「대화 종료」를 누르세요.
			</p>
		{:else if apiLinkState === 'waiting'}
			<p class="mt-2 flex items-center gap-2 text-[14px] font-bold text-[#b45309]">
				<span
					class="inline-block h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-[#f59e0b]"
					aria-hidden="true"
				></span>
				연결 대기 중
			</p>
			<p class="mt-1.5 text-[13px] leading-relaxed text-[#92400e]">{statusText}</p>
			<p class="mt-1 text-[12px] text-[#a16207]">
				토큰 발급·WebRTC 연결 중입니다. 연결이 완료되면 과금이 시작될 수 있습니다.
			</p>
		{:else}
			<p class="mt-2 flex items-center gap-2 text-[14px] font-bold text-[#166534]">
				<span class="inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-[#22c55e]" aria-hidden="true"></span>
				연결 없음 · 과금 없음
			</p>
			<p class="mt-1.5 text-[13px] leading-relaxed text-[#14532d]">
				현재 모든 API 연결이 중단된 상태이며, 과금이 발생하지 않습니다.
			</p>
			{#if shutdownState === 'confirmed' || shutdownState === 'uncertain'}
				<p class="mt-2 rounded-lg bg-white/70 px-2.5 py-2 text-[12px] leading-snug text-[#166534]">
					{shutdownMessage}
					{#if teardownCheck}
						<span class="mt-1 block text-[11px] opacity-80">
							로컬: 마이크 {teardownCheck.micStopped ? 'OFF' : '?'} · 채널 {teardownCheck.dataChannelClosed
								? '닫힘'
								: '?'} · WebRTC {teardownCheck.peerClosed ? '종료' : '?'}
						</span>
					{/if}
				</p>
			{:else if status === 'idle'}
				<p class="mt-2 text-[12px] text-[#15803d]">{statusText}</p>
			{/if}
		{/if}
	</div>

	<div class="mx-auto mt-6 flex w-full max-w-[360px] flex-col items-stretch gap-3">
		<div class="flex gap-2.5">
			<button
				type="button"
				class="flex min-h-[48px] flex-1 items-center justify-center rounded-xl px-3 text-[14px] font-bold transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55 {status ===
				'live'
					? 'bg-[#1f2937] text-white shadow-md hover:bg-[#111827]'
					: 'bg-[#ff2d2d] text-white shadow-[0_6px_20px_rgba(255,45,45,0.35)] hover:bg-[#e82626]'}"
				disabled={status === 'connecting' || status === 'ending'}
				aria-label={status === 'live' ? 'AI와 대화 종료' : 'AI와 대화 시작'}
				onclick={onMicButtonClick}
			>
				{#if status === 'connecting' || status === 'ending'}
					처리 중…
				{:else if status === 'live'}
					대화 종료
				{:else}
					AI와 대화 시작
				{/if}
			</button>
			<button
				type="button"
				class="flex min-h-[48px] flex-1 items-center justify-center rounded-xl border-2 px-3 text-[14px] font-bold transition active:scale-[0.98] {showDebug
					? 'border-[#1f2937] bg-[#1f2937] text-white hover:bg-[#111827]'
					: 'border-[#cbd5e1] bg-white text-[#334155] hover:border-[#94a3b8] hover:bg-[#f8fafc]'}"
				aria-expanded={showDebug}
				aria-label={showDebug ? '디버그 내역 닫기' : '디버그 내역 보기'}
				onclick={() => (showDebug = !showDebug)}
			>
				{showDebug ? '디버그 닫기' : '디버그 보기'}
				{#if !showDebug && sessionDebugCount > 0}
					<span class="ml-1 text-[12px] font-medium text-[#64748b]">({sessionDebugCount})</span>
				{/if}
			</button>
		</div>

		{#if showDebug}
			<div
				class="w-full overflow-hidden rounded-2xl border border-[#1e293b] bg-[#0f172a] text-left"
			>
				<div class="flex items-center justify-between gap-2 border-b border-white/10 px-3 py-2">
					<p class="text-[11px] font-semibold tracking-wide text-slate-200">통신 디버그</p>
					<div class="flex shrink-0 gap-1">
						<button
							type="button"
							class="rounded px-1.5 py-1 text-[10px] text-slate-300 hover:bg-white/10"
							onclick={() => (debugErrorsOnly = !debugErrorsOnly)}
						>
							{debugErrorsOnly ? '전체' : '오류만'}
						</button>
						<button
							type="button"
							class="rounded px-1.5 py-1 text-[10px] text-slate-300 hover:bg-white/10"
							onclick={copyDebugLogs}
						>
							복사
						</button>
						<button
							type="button"
							class="rounded px-1.5 py-1 text-[10px] text-slate-300 hover:bg-white/10"
							onclick={() => (debugLogs = [])}
						>
							지우기
						</button>
					</div>
				</div>
				<div
					bind:this={debugScrollEl}
					class="max-h-56 overflow-y-auto px-3 py-2 font-mono text-[10px] leading-snug"
				>
					{#if visibleDebugLogs.length === 0}
						<p class="text-slate-500">대화를 시작하면 API·WebRTC 과정이 여기에 표시됩니다.</p>
					{:else}
						{#each visibleDebugLogs as entry (entry.id)}
							<div class="mb-2 border-b border-white/5 pb-2 last:mb-0 last:border-0 last:pb-0">
								<p
									class={entry.level === 'error'
										? 'text-red-400'
										: entry.level === 'warn'
											? 'text-amber-300'
											: entry.level === 'ok'
												? 'text-emerald-400'
												: 'text-sky-300'}
								>
									{formatTime(entry.t)} · {entry.step}
								</p>
								{#if entry.detail}
									<pre class="mt-0.5 whitespace-pre-wrap break-all text-slate-400">{entry.detail}</pre>
								{/if}
							</div>
						{/each}
					{/if}
				</div>
			</div>
		{/if}
	</div>

	<div class="mx-auto mt-5 w-full max-w-[360px] overflow-hidden rounded-xl bg-black">
		<canvas
			bind:this={waveformCanvas}
			class="block h-28 w-full {status === 'live' ? 'opacity-100' : 'opacity-40'}"
			aria-label={status === 'live' ? '실시간 음성 파형' : '음성 파형 영역'}
		></canvas>
	</div>

	<div class="mx-auto mt-6 w-full max-w-[360px] overflow-hidden rounded-2xl bg-[#f0f2f8] shadow-sm ring-1 ring-[#e5e7eb]">
		<nav class="flex border-b border-[#e5e7eb] bg-white" aria-label="대화 보기">
			<button
				type="button"
				class="flex-1 border-b-2 px-1 py-3 text-[13px] font-semibold transition {chatPanelTab === 'current'
					? 'border-[#4a90e2] text-[#4a90e2]'
					: 'border-transparent text-[#6b7280] hover:text-[#374151]'}"
				onclick={() => (chatPanelTab = 'current')}
			>
				현재 대화
			</button>
			<button
				type="button"
				class="flex-1 border-b-2 px-1 py-3 text-[13px] font-semibold transition {chatPanelTab === 'history'
					? 'border-[#4a90e2] text-[#4a90e2]'
					: 'border-transparent text-[#6b7280] hover:text-[#374151]'}"
				onclick={() => {
					chatPanelTab = 'history';
					void refreshHistory();
				}}
			>
				대화 기록
			</button>
			<button
				type="button"
				class="flex-1 border-b-2 px-1 py-3 text-[13px] font-semibold transition {chatPanelTab === 'settings'
					? 'border-[#4a90e2] text-[#4a90e2]'
					: 'border-transparent text-[#6b7280] hover:text-[#374151]'}"
				onclick={() => (chatPanelTab = 'settings')}
			>
				AI 설정
			</button>
		</nav>

		<div
			class="p-3 {chatPanelTab === 'history'
				? 'bg-[#eef6ff]'
				: chatPanelTab === 'settings'
					? 'bg-[#f0f2f8]'
					: 'bg-white'}"
		>
			{#if chatPanelTab === 'current'}
				<div class="mb-3 flex items-center justify-between gap-2">
					<p class="text-[16px] font-bold text-[#111827]">현재 대화</p>
					{#if viewingSavedAt}
						<button
							type="button"
							class="shrink-0 text-[11px] font-medium text-[#4a90e2] underline-offset-2 hover:underline"
							onclick={clearSavedSessionView}
						>
							화면 지우기
						</button>
					{/if}
				</div>
				{#if viewingSavedAt}
					<div class="mb-3 rounded-lg bg-[#eff6ff] px-3 py-2.5 text-[12px] text-[#1e40af]">
						<p>{formatSavedDateLong(viewingSavedAt)}에 저장된 세션을 보고 있습니다.</p>
						{#if viewingAiSettings}
							<div class="mt-2 flex flex-wrap gap-1.5">
								<span
									class="inline-flex items-center gap-1 rounded-full bg-white/80 px-2 py-0.5 text-[11px] font-semibold text-[#1d4ed8]"
								>
									<span aria-hidden="true">{viewingAiSettings.personality.emoji}</span>
									{viewingAiSettings.personality.title}
								</span>
								<span class="rounded-full bg-white/60 px-2 py-0.5 text-[11px] text-[#334155]">
									{viewingAiSettings.levelLabel} · {viewingAiSettings.langLabel}
								</span>
							</div>
						{/if}
					</div>
				{/if}
				<div
					bind:this={chatScrollEl}
					class="max-h-[420px] min-h-[200px] overflow-y-auto pr-1"
				>
					<ChatTranscriptView
						savedAt={viewingSavedAt || sessionStartedAt}
						dialogMessages={messages}
						systemMessages={sessionSystemMessages}
						liveUserModel={viewingSavedAt ? '' : TRANSCRIPTION_MODEL}
						liveAssistantModel={viewingSavedAt ? '' : REALTIME_MODEL}
						pendingAssistantText={viewingSavedAt ? '' : pendingAssistant}
					/>
				</div>
			{:else if chatPanelTab === 'history'}
				<ConversationHistoryPanel
					{history}
					exchange={usdKrw}
					loading={historyLoading}
					error={historyError}
					expandedIds={expandedHistoryIds}
					onRefresh={refreshHistory}
					onToggleExpand={toggleHistoryExpand}
					onEdit={loadHistoryEntry}
					onDelete={deleteHistoryEntry}
				/>
			{:else}
				<AiTeacherSettingsPanel
					settingsLocked={settingsLocked}
					{level}
					{languageMode}
					{vadPreset}
					{teacherPersonality}
					customPromptText={activeCustomPrompt}
					showCustomEditor={showCustomPromptEditor}
					previewText={settingsPreviewText}
					onSelectPersonality={selectTeacherPersonality}
					onOpenCustom={openCustomPromptEditor}
					onCustomPromptChange={updateCustomPrompt}
					onReset={resetTeacherSettings}
					onLevelChange={(lv) => {
						level = lv;
						persistPrefs();
					}}
					onLanguageModeChange={(mode) => {
						languageMode = mode;
						persistPrefs();
					}}
					onVadChange={(preset) => {
						vadPreset = preset;
						persistPrefs();
					}}
					savedPrompts={savedPromptsForMode}
					promptCloudStatus={promptCloudStatus}
					promptCloudError={promptCloudError}
					onSaveNamedPrompt={saveNamedPromptToCloud}
					onLoadSavedPrompt={loadSavedPromptFromCloud}
					onDeleteSavedPrompt={deleteSavedPromptFromCloud}
					onRefreshSavedPrompts={loadUserPromptsFromCloud}
				/>
			{/if}
		</div>

		{#if saveError}
			<p class="mt-2 text-center text-[12px] text-red-600" role="alert">{saveError}</p>
		{/if}
	</div>

	<audio bind:this={audioEl} class="hidden" autoplay></audio>
{/snippet}
