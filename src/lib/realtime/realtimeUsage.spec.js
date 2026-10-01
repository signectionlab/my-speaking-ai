import { describe, expect, it } from 'vitest';
import {
	addResponseUsage,
	addTranscriptionUsage,
	createEmptyUsage,
	estimateCost,
	formatDuration,
	sumUsages,
	describeResponseTurn,
	describeTranscriptionTurn,
	formatTurnUsageLines,
	usageBillingColumns,
	usageTimes,
	withDuration
} from './realtimeUsage.js';

describe('realtime usage cost', () => {
	it('prices cached and fresh tokens from a response.done payload', () => {
		const usage = addResponseUsage(createEmptyUsage(), {
			total_tokens: 9492,
			input_tokens: 8223,
			output_tokens: 1269,
			input_token_details: {
				text_tokens: 5378,
				audio_tokens: 2845,
				cached_tokens: 8192,
				cached_tokens_details: {
					text_tokens: 5376,
					audio_tokens: 2816
				}
			},
			output_token_details: {
				text_tokens: 250,
				audio_tokens: 1019
			}
		});

		const cost = estimateCost(usage);
		expect(cost.freshTextTokens).toBe(2);
		expect(cost.cachedAudioTokens).toBe(2816);
		expect(cost.realtimeUsd).toBeCloseTo(0.0754288, 6);
		expect(usageTimes(usage).assistantSpeechMs).toBe(1019 * 50);
	});

	it('bills whisper transcription by audio minutes and keeps session time separate', () => {
		let usage = addTranscriptionUsage(createEmptyUsage(), {
			type: 'tokens',
			input_token_details: { audio_tokens: 600 }
		});
		usage = withDuration(usage, 125000);
		const cost = estimateCost(usage);
		expect(cost.transcriptionUsd).toBeCloseTo(0.006, 6);
		expect(usageTimes(usage).userSpeechMs).toBe(60000);
		expect(formatDuration(usage.durationMs)).toBe('2분 5초');
	});

	it('describes the model and tokens for one spoken turn', () => {
		const response = describeResponseTurn(
			{
				input_token_details: {
					text_tokens: 119,
					audio_tokens: 13,
					cached_tokens_details: { text_tokens: 64 }
				},
				output_token_details: { text_tokens: 30, audio_tokens: 91 }
			},
			'gpt-realtime-2.1'
		);
		expect(formatTurnUsageLines(response)).toEqual([
			'입력 gpt-realtime-2.1 · 텍스트 119 · 오디오 13 · 캐시 64',
			'출력 gpt-realtime-2.1 · 텍스트 30 · 오디오 91'
		]);

		const transcription = describeTranscriptionTurn({
			input_token_details: { text_tokens: 0, audio_tokens: 17 },
			output_tokens: 9
		});
		expect(transcription?.inputModel).toBe('whisper-1');
		expect(transcription?.outputTextTokens).toBe(9);
		expect(transcription?.inputAudioTokens).toBe(17);
	});

	it('maps usage into table columns including won', () => {
		const usage = withDuration(
			addTranscriptionUsage(createEmptyUsage(), {
				input_token_details: { audio_tokens: 600 }
			}),
			65000
		);
		expect(usageBillingColumns(usage, 1354.74)).toMatchObject({
			usage_duration_ms: 65000,
			usage_transcription_audio_tokens: 600,
			estimated_cost_usd: 0.006,
			usd_krw_rate: 1354.74,
			estimated_cost_krw: 8.13
		});
	});

	it('sums conversation usage without double-counting cached tokens', () => {
		const first = addResponseUsage(createEmptyUsage(), {
			input_token_details: { text_tokens: 100, audio_tokens: 10, cached_tokens_details: { text_tokens: 40 } },
			output_token_details: { text_tokens: 5, audio_tokens: 20 }
		});
		const total = sumUsages([first, first]);
		expect(total.responseCount).toBe(2);
		expect(total.inputTextTokens).toBe(200);
		expect(estimateCost(total).cachedTextTokens).toBe(80);
		expect(estimateCost(total).freshTextTokens).toBe(120);
	});
});
