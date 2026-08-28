import { spectralDenoise } from "./audio";

type NoiseMessage = { samples: ArrayBuffer; sampleRate: number };
type WorkerScope = {
  onmessage: ((event: MessageEvent<NoiseMessage>) => void) | null;
  postMessage: (message: ArrayBuffer, transfer: Transferable[]) => void;
};

const scope = self as unknown as WorkerScope;
scope.onmessage = (event) => {
  const input = new Float32Array(event.data.samples);
  const output = spectralDenoise(input, event.data.sampleRate, 0.94);
  scope.postMessage(output.buffer, [output.buffer]);
};
