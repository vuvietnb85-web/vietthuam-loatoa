import { describe, expect, it } from "vitest";
import { encodeMonoWav, spectralDenoise, trimSilenceWithHysteresis } from "./audio";

describe("audio cleanup pipeline", () => {
  it("keeps spoken material while trimming long leading and trailing silence", () => {
    const sampleRate = 8_000;
    const input = new Float32Array(sampleRate * 2);
    for (let i = sampleRate / 2; i < sampleRate; i += 1) input[i] = Math.sin((2 * Math.PI * 220 * i) / sampleRate) * 0.2;
    const result = trimSilenceWithHysteresis(input, sampleRate, -45, 100);
    expect(result.segmentCount).toBe(1);
    expect(result.keptSeconds).toBeLessThan(1.5);
    expect(result.removedSeconds).toBeGreaterThan(0.3);
  });

  it("preserves sample count while reducing a quiet noise bed", () => {
    const sampleRate = 48_000;
    const input = Float32Array.from({ length: sampleRate * 1.2 }, (_, i) =>
      Math.sin((2 * Math.PI * 51 * i) / sampleRate) * 0.018,
    );
    const output = spectralDenoise(input, sampleRate, 0.94);
    expect(output.length).toBe(input.length);
    const inputRms = Math.sqrt(input.reduce((sum, sample) => sum + sample * sample, 0) / input.length);
    const outputRms = Math.sqrt(output.reduce((sum, sample) => sum + sample * sample, 0) / output.length);
    expect(outputRms).toBeLessThan(inputRms);
  });

  it("writes a valid PCM WAV header for mono output", () => {
    const blob = encodeMonoWav(new Float32Array([0, 0.5, -0.5]), 48_000);
    expect(blob.type).toBe("audio/wav");
    expect(blob.size).toBe(50);
  });
});
