/** @type {'none' | 'active' | 'closing' | 'confirmed' | 'uncertain'} */
export const SHUTDOWN = {
	NONE: 'none',
	ACTIVE: 'active',
	CLOSING: 'closing',
	CONFIRMED: 'confirmed',
	UNCERTAIN: 'uncertain'
};

/** 세션 종료 대기 (OpenAI session.closed) */
export const SESSION_CLOSE_TIMEOUT_MS = 15_000;

/**
 * @param {RTCPeerConnection | null} pc
 * @param {RTCDataChannel | null} dc
 * @param {MediaStream | null} micStream
 */
export function verifyLocalTeardown(pc, dc, micStream) {
	const tracks = micStream?.getAudioTracks() ?? [];
	return {
		micStopped: tracks.length === 0 || tracks.every((t) => t.readyState === 'ended'),
		dataChannelClosed:
			!dc || dc.readyState === 'closed' || dc.readyState === 'closing',
		peerClosed:
			!pc ||
			pc.connectionState === 'closed' ||
			pc.connectionState === 'disconnected' ||
			pc.connectionState === 'failed',
		connectionState: pc?.connectionState ?? 'none',
		dataChannelState: dc?.readyState ?? 'none'
	};
}
