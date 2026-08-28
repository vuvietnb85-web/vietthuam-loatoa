/**
 * Bản In Truyền Thanh — xử lý âm thanh cục bộ, ưu tiên lời đọc rõ và thao tác trên điện thoại.
 * Khử nhiễu phổ chạy nền được gọi qua Worker, không yêu cầu người dùng tinh chỉnh.
 */

export type TrimResult = {
  samples: Float32Array;
  keptSeconds: number;
  removedSeconds: number;
  segmentCount: number;
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
 * VAD RMS 20 ms với hysteresis: giữ một đoạn nói cho đến khi năng lượng thấp quá holdMs.
 * Pre/post-roll tránh nuốt phụ âm đầu cuối khi xuất tiếng Việt.
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
      segments.push({
        start: segmentStart,
        end: Math.min(input.length, lastAudibleSample + postRoll),
      });
      speaking = false;
    }
  }

  if (speaking) {
    segments.push({
      start: segmentStart,
      end: Math.min(input.length, lastAudibleSample + postRoll),
    });
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

function fft(real: Float32Array, imag: Float32Array, inverse = false) {
  const n = real.length;
  for (let i = 1, j = 0; i < n; i += 1) {
    let bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) {
      [real[i], real[j]] = [real[j], real[i]];
      [imag[i], imag[j]] = [imag[j], imag[i]];
    }
  }
  for (let length = 2; length <= n; length <<= 1) {
    const angle = (inverse ? 2 : -2) * Math.PI / length;
    const wLengthReal = Math.cos(angle);
    const wLengthImag = Math.sin(angle);
    for (let start = 0; start < n; start += length) {
      let wReal = 1;
      let wImag = 0;
      const half = length >> 1;
      for (let offset = 0; offset < half; offset += 1) {
        const even = start + offset;
        const odd = even + half;
        const oddReal = real[odd] * wReal - imag[odd] * wImag;
        const oddImag = real[odd] * wImag + imag[odd] * wReal;
        const evenReal = real[even];
        const evenImag = imag[even];
        real[even] = evenReal + oddReal;
        imag[even] = evenImag + oddImag;
        real[odd] = evenReal - oddReal;
        imag[odd] = evenImag - oddImag;
        const nextWReal = wReal * wLengthReal - wImag * wLengthImag;
        wImag = wReal * wLengthImag + wImag * wLengthReal;
        wReal = nextWReal;
      }
    }
  }
  if (inverse) {
    for (let i = 0; i < n; i += 1) {
      real[i] /= n;
      imag[i] /= n;
    }
  }
}

/**
 * Spectral subtraction nhẹ: tự tìm các frame yên nhất trong 1,2 giây đầu để tạo noise profile,
 * giảm nhiễu nền theo từng dải với noise floor 12%. Không làm thay đổi sample rate hay thời lượng.
 */
export function spectralDenoise(input: Float32Array, sampleRate: number, amount = 0.9) {
  if (input.length < 2048) return input.slice();

  const fftSize = 1024;
  const hopSize = 256;
  const half = fftSize >> 1;
  const frameCount = Math.max(1, Math.ceil((input.length - fftSize) / hopSize) + 1);
  const window = new Float32Array(fftSize);
  for (let i = 0; i < fftSize; i += 1) {
    window[i] = Math.sqrt(0.5 - 0.5 * Math.cos((2 * Math.PI * i) / fftSize));
  }

  const energies = new Float32Array(Math.min(frameCount, Math.ceil((sampleRate * 1.2) / hopSize)));
  for (let frame = 0; frame < energies.length; frame += 1) {
    const start = frame * hopSize;
    let energy = 0;
    for (let i = 0; i < fftSize && start + i < input.length; i += 1) {
      energy += input[start + i] * input[start + i];
    }
    energies[frame] = energy / fftSize;
  }
  const quietLimit = Math.max(1, Math.ceil(energies.length * 0.2));
  const quietFrames = Array.from({ length: energies.length }, (_, index) => index)
    .sort((a, b) => energies[a] - energies[b])
    .slice(0, quietLimit);
  const noise = new Float32Array(half + 1);
  const real = new Float32Array(fftSize);
  const imag = new Float32Array(fftSize);
  quietFrames.forEach((frame) => {
    real.fill(0);
    imag.fill(0);
    const start = frame * hopSize;
    for (let i = 0; i < fftSize && start + i < input.length; i += 1) real[i] = input[start + i] * window[i];
    fft(real, imag);
    for (let bin = 0; bin <= half; bin += 1) noise[bin] += Math.hypot(real[bin], imag[bin]);
  });
  for (let bin = 0; bin <= half; bin += 1) noise[bin] = noise[bin] / quietFrames.length + 0.0000001;

  const output = new Float32Array(input.length + fftSize);
  const weights = new Float32Array(output.length);
  const safeAmount = clamp(amount, 0, 1);
  for (let frame = 0; frame < frameCount; frame += 1) {
    const start = frame * hopSize;
    real.fill(0);
    imag.fill(0);
    for (let i = 0; i < fftSize && start + i < input.length; i += 1) real[i] = input[start + i] * window[i];
    fft(real, imag);
    for (let bin = 0; bin <= half; bin += 1) {
      const magnitude = Math.hypot(real[bin], imag[bin]);
      const snr = magnitude / noise[bin];
      const reduction = clamp(1 - 1.55 / Math.max(1, snr), 0.12, 1);
      const gain = Math.pow(reduction, safeAmount);
      real[bin] *= gain;
      imag[bin] *= gain;
      if (bin > 0 && bin < half) {
        real[fftSize - bin] *= gain;
        imag[fftSize - bin] *= gain;
      }
    }
    fft(real, imag, true);
    for (let i = 0; i < fftSize && start + i < output.length; i += 1) {
      output[start + i] += real[i] * window[i];
      weights[start + i] += window[i] * window[i];
    }
  }

  const result = new Float32Array(input.length);
  for (let i = 0; i < result.length; i += 1) {
    result[i] = weights[i] > 0.0001 ? output[i] / weights[i] : input[i];
  }
  return result;
}

function makeSaturationCurve(amount: number) {
  const length = 1024;
  const curve = new Float32Array(length);
  const drive = 1 + amount * 1.8;
  const normalizer = Math.tanh(drive);
  for (let index = 0; index < length; index += 1) {
    const x = (index * 2) / (length - 1) - 1;
    curve[index] = Math.tanh(x * drive) / normalizer;
  }
  return curve;
}

export async function applyPublicAddressEffect(
  source: Float32Array,
  sampleRate: number,
  strength: number,
) {
  const AudioContextConstructor = window.OfflineAudioContext ||
    (window as typeof window & { webkitOfflineAudioContext?: typeof OfflineAudioContext }).webkitOfflineAudioContext;

  if (!AudioContextConstructor || strength <= 0) return source.slice();

  const normalizedStrength = clamp(strength / 100, 0, 1);
  const offline = new AudioContextConstructor(1, source.length, sampleRate);
  const buffer = offline.createBuffer(1, source.length, sampleRate);
  buffer.getChannelData(0).set(new Float32Array(source));

  const input = offline.createBufferSource();
  input.buffer = buffer;

  const highPass = offline.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 210 + normalizedStrength * 115;
  highPass.Q.value = 0.72;

  const presence = offline.createBiquadFilter();
  presence.type = "peaking";
  presence.frequency.value = 2150;
  presence.Q.value = 0.82;
  presence.gain.value = 1.5 + normalizedStrength * 4.6;

  const edgeControl = offline.createBiquadFilter();
  edgeControl.type = "peaking";
  edgeControl.frequency.value = 4650;
  edgeControl.Q.value = 1.2;
  edgeControl.gain.value = -normalizedStrength * 2.1;

  const lowPass = offline.createBiquadFilter();
  lowPass.type = "lowpass";
  lowPass.frequency.value = 11800 - normalizedStrength * 3500;
  lowPass.Q.value = 0.76;

  const compressor = offline.createDynamicsCompressor();
  compressor.threshold.value = -18 - normalizedStrength * 7;
  compressor.knee.value = 12;
  compressor.ratio.value = 1.8 + normalizedStrength * 3.8;
  compressor.attack.value = 0.004;
  compressor.release.value = 0.12;

  const saturator = offline.createWaveShaper();
  saturator.curve = makeSaturationCurve(normalizedStrength);
  saturator.oversample = "4x";

  const outputGain = offline.createGain();
  outputGain.gain.value = 0.92;

  input.connect(highPass);
  highPass.connect(presence);
  presence.connect(edgeControl);
  edgeControl.connect(lowPass);
  lowPass.connect(compressor);
  compressor.connect(saturator);
  saturator.connect(outputGain);
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
