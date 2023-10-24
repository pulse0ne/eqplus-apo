const AUDIO_CONTEXT = new AudioContext({ latencyHint: 'playback' });
const NYQUIST = AUDIO_CONTEXT.sampleRate * 0.5;
const FREQ_START = 1.0;

export { AUDIO_CONTEXT, NYQUIST, FREQ_START };
