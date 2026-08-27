/**
 * Bản In Truyền Thanh — DSP cục bộ cho chất âm loa nén: dải hẹp, cộng hưởng trung âm và vang ngoài trời.
 */

export type TrimResult = {
  samples: Float32Array;
  keptSeconds: number;
  removedSeconds: number;
  segmentCount: number;
};

export type PaEffectOptions = {
  saturation: number;
  echo: number;
};

const clamp = (value: number, lower: number, upper: number) =>
  Math.min(Math.max(value, lower), upper);

export function secondsFromSamples(samples: Float32Array, sampleRate: number) {
  return samples.length / sampleRate;
}

export function formatDuration(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(safeSeconds / 60);
  const remainder = safeSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(remainder).padStart(2, "0")}`;
}

/**
 * VAD RMS 20 ms với hysteresis; có pre/post-roll để tránh nuốt phụ âm tiếng Việt đầu và cuối câu.
 */
export function trimSilenceWithHysteresis(
  input: Float32Array,
  sampleRate: number,
  thresholdDb = -45,
  holdMs = 300,
): TrimResult {
  if (!input.length) {
    return { samples: input, keptSeconds: 0, removedSeconds: 0, segmentCount: 0 };
  }

  const frameSize = Math.max(128, Math.round(sampleRate * 0.02));
  const holdSamples = Math.max(frameSize, Math.round((holdMs / 1000) * sampleRate));
  const preRoll = Math.round(sampleRate * 0.07);
  const postRoll = Math.round(sampleRate * 0.11);
  const segments: Array<{ start: number; end: number }> = [];
  let speaking = false;
  let segmentStart = 0;
  let lastAudibleSample = 0;

  for (let frameStart = 0; frameStart < input.length; frameStart += frameSize) {
    const frameEnd = Math.min(frameStart + frameSize, input.length);
    let energy = 0;
    for (let sampleIndex = frameStart; sampleIndex < frameEnd; sampleIndex += 1) {
      const sample = input[sampleIndex];
      energy += sample * sample;
    }
    const rms = Math.sqrt(energy / Math.max(1, frameEnd - frameStart));
    const db = 20 * Math.log10(Math.max(rms, 0.0000001));

    if (db >= thresholdDb) {
      if (!speaking) {
        speaking = true;
        segmentStart = Math.max(0, frameStart - preRoll);
      }
      lastAudibleSample = frameEnd;
    } else if (speaking && frameEnd - lastAudibleSample >= holdSamples) {
      segments.push({ start: segmentStart, end: Math.min(input.length, lastAudibleSample + postRoll) });
      speaking = false;
    }
  }

  if (speaking) {
    segments.push({ start: segmentStart, end: Math.min(input.length, lastAudibleSample + postRoll) });
  }

  if (!segments.length) {
    return {
      samples: input.slice(),
      keptSeconds: secondsFromSamples(input, sampleRate),
      removedSeconds: 0,
      segmentCount: 0,
    };
  }

  const mergeGap = Math.round(sampleRate * 0.05);
  const merged = segments.reduce<Array<{ start: number; end: number }>>((all, segment) => {
    const previous = all[all.length - 1];
    if (previous && segment.start - previous.end <= mergeGap) {
      previous.end = Math.max(previous.end, segment.end);
    } else {
      all.push({ ...segment });
    }
    return all;
  }, []);

  const totalLength = merged.reduce((total, segment) => total + segment.end - segment.start, 0);
  const output = new Float32Array(totalLength);
  let writeOffset = 0;
  merged.forEach((segment, index) => {
    const part = input.subarray(segment.start, segment.end);
    output.set(part, writeOffset);
    const fadeLength = Math.min(Math.round(sampleRate * 0.006), Math.floor(part.length / 2));
    for (let i = 0; i < fadeLength; i += 1) {
      const fadeIn = index === 0 && writeOffset === 0 ? 1 : i / fadeLength;
      output[writeOffset + i] *= fadeIn;
      output[writeOffset + part.length - 1 - i] *= i / fadeLength;
    }
    writeOffset += part.length;
  });

  return {
    samples: output,
    keptSeconds: secondsFromSamples(output, sampleRate),
    removedSeconds: Math.max(0, secondsFromSamples(input, sampleRate) - secondsFromSamples(output, sampleRate)),
    segmentCount: merged.length,
  };
}

/** Áp dụng đường cong arctan kiểu buồng nén; chuẩn hóa đầu ra để không làm yếu tín hiệu. */
function makeHornSaturationCurve(saturation: number) {
  const length = 44100;
  const curve = new Float32Array(length);
  const k = 80 + clamp(saturation, 0, 100) * 4.2;
  const deg = Math.PI / 180;
  const normalizer = ((3 + k) * 20 * deg) / (Math.PI + k);

  for (let index = 0; index < length; index += 1) {
    const x = (index * 2) / (length - 1) - 1;
    const raw = ((3 + k) * x * 20 * deg) / (Math.PI + k * Math.abs(x));
    curve[index] = raw / normalizer;
  }
  return curve;
}

/**
 * Render offline cùng một đồ thị: HPF → LPF → cộng hưởng 2 kHz → WaveShaper → nhánh dry/wet
 * → compressor. Phần đệm cuối giữ lại tail của mạng trễ ngoài trời thay vì cắt đột ngột.
 */
export async function applyPublicAddressEffect(
  source: Float32Array,
  sampleRate: number,
  options: PaEffectOptions,
) {
  const AudioContextConstructor = window.OfflineAudioContext ||
    (window as typeof window & { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;
  if (!AudioContextConstructor || !source.length) return source.slice();

  const saturation = clamp(options.saturation, 0, 100);
  const echo = clamp(options.echo, 0, 100);
  const echoTailSeconds = echo > 0 ? 1.35 : 0.06;
  const renderLength = source.length + Math.ceil(sampleRate * echoTailSeconds);
  const offline = new AudioContextConstructor(1, renderLength, sampleRate);
  const buffer = offline.createBuffer(1, source.length, sampleRate);
  buffer.copyToChannel(source, 0);

  const input = offline.createBufferSource();
  input.buffer = buffer;

  const highPass = offline.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 250;
  highPass.Q.value = 0.707;

  const lowPass = offline.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.value = 5500;
  lowPass.Q.value = 0.707;

  const resonator = offline.createBiquadFilter();
  resonator.type = "peaking";
  resonator.frequency.value = 2000;
  resonator.Q.value = 2.5;
  resonator.gain.value = 1.25 + saturation * 0.0675;

  const saturator = offline.createWaveShaper();
  saturator.curve = makeHornSaturationCurve(saturation);
  saturator.oversample = "4x";

  const delay = offline.createDelay(1.5);
  delay.delayTime.value = 0.22;
  const feedbackDamp = offline.createBiquadFilter();
  feedbackDamp.type = "lowpass";
  feedbackDamp.frequency.value = 3000;
  feedbackDamp.Q.value = 0.707;
  const feedback = offline.createGain();
  feedback.gain.value = (echo / 100) * 0.35;
  const dry = offline.createGain();
  dry.gain.value = 0.72;
  const wet = offline.createGain();
  wet.gain.value = (echo / 100) * 0.32;

  const compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = -24;
  compressor.knee.value = 10;
  compressor.ratio.value = 6;
  compressor.attack.value = 0.005;
  compressor.release.value = 0.1;

  const outputGain = offline.createGain();
  outputGain.gain.value = 0.88;

  input.connect(highPass);
  highPass.connect(lowPass);
  lowPass.connect(resonator);
  resonator.connect(saturator);
  saturator.connect(dry);
  saturator.connect(delay);
  delay.connect(feedbackDamp);
  feedbackDamp.connect(feedback);
  feedback.connect(delay);
  delay.connect(wet);
  dry.connect(compressor);
  wet.connect(compressor);
  compressor.connect(outputGain);
  outputGain.connect(offline.destination);
  input.start();

  const rendered = await offline.startRendering();
  return rendered.getChannelData(0).slice();
}

export function encodeMonoWav(samples: Float32Array, sampleRate: number) {
  const bytesPerSample = 2;
  const dataLength = samples.length * bytesPerSample;
  const buffer = new ArrayBuffer(44 + dataLength);
  const view = new DataView(buffer);
  const writeText = (offset: number, value: string) => {
    for (let i = 0; i < value.length; i += 1) view.setUint8(offset + i, value.charCodeAt(i));
  };

  writeText(0, "RIFF");
  view.setUint32(4, 36 + dataLength, true);
  writeText(8, "WAVE");
  writeText(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * bytesPerSample, true);
  view.setUint16(32, bytesPerSample, true);
  view.setUint16(34, 16, true);
  writeText(36, "data");
  view.setUint32(40, dataLength, true);

  for (let index = 0; index < samples.length; index += 1) {
    const clamped = clamp(samples[index], -1, 1);
    view.setInt16(44 + index * 2, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
  }

  return new Blob([view], { type: "audio/wav" });
}
