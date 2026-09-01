/**
 * Captura de áudio da consulta.
 *
 * Grava PCM pelo Web Audio API e fecha janelas curtas como arquivos WAV
 * completos (16 kHz mono), o que é decodificável em qualquer navegador —
 * inclusive Safari. Cada janela é entregue ao chamador para transcrição.
 */

const TARGET_SAMPLE_RATE = 16000;

function downsample(input: Float32Array, from: number, to: number): Float32Array {
  if (to >= from) return input;
  const ratio = from / to;
  const length = Math.floor(input.length / ratio);
  const output = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    output[i] = input[Math.floor(i * ratio)] ?? 0;
  }
  return output;
}

export function encodeWav(chunks: Float32Array[], sampleRate: number): Blob {
  const total = chunks.reduce((sum, c) => sum + c.length, 0);
  const merged = new Float32Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    merged.set(chunk, offset);
    offset += chunk.length;
  }
  const samples = downsample(merged, sampleRate, TARGET_SAMPLE_RATE);
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  const writeString = (pos: number, value: string) => {
    for (let i = 0; i < value.length; i++) view.setUint8(pos + i, value.charCodeAt(i));
  };

  writeString(0, "RIFF");
  view.setUint32(4, 36 + samples.length * 2, true);
  writeString(8, "WAVE");
  writeString(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, 1, true);
  view.setUint32(24, TARGET_SAMPLE_RATE, true);
  view.setUint32(28, TARGET_SAMPLE_RATE * 2, true);
  view.setUint16(32, 2, true);
  view.setUint16(34, 16, true);
  writeString(36, "data");
  view.setUint32(40, samples.length * 2, true);

  let pos = 44;
  for (const sample of samples) {
    const clamped = Math.max(-1, Math.min(1, sample));
    view.setInt16(pos, clamped < 0 ? clamped * 0x8000 : clamped * 0x7fff, true);
    pos += 2;
  }

  return new Blob([buffer], { type: "audio/wav" });
}

export async function blobToBase64(blob: Blob): Promise<string> {
  const buffer = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const step = 0x8000;
  for (let i = 0; i < buffer.length; i += step) {
    binary += String.fromCharCode(...buffer.subarray(i, i + step));
  }
  return btoa(binary);
}

export interface AudioRecorder {
  stop: () => Promise<void>;
}

/**
 * Gravação avulsa para ditado: captura até o `stop()` e devolve um único WAV.
 * Reaproveita o mesmo pipeline PCM da consulta, garantindo um arquivo completo.
 */
export async function startSingleRecording(): Promise<{ stop: () => Promise<Blob> }> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microfone indisponível neste navegador.");
  }
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  const buffer: Float32Array[] = [];

  processor.onaudioprocess = (event) => {
    buffer.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };
  source.connect(processor);
  processor.connect(context.destination);

  return {
    stop: async () => {
      const wav = encodeWav(buffer, context.sampleRate);
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await context.close();
      return wav;
    },
  };
}

/**
 * Inicia a gravação. `onWindow` recebe um WAV completo a cada `windowMs`.
 * As janelas são entregues sequencialmente, na ordem em que foram capturadas.
 * `stop()` aguarda o flush final e todos os callbacks pendentes antes de resolver.
 */
export async function startRecording(
  onWindow: (wav: Blob) => Promise<void> | void,
  windowMs = 12000,
): Promise<AudioRecorder> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Microfone indisponível neste navegador.");
  }

  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const context = new AudioContext();
  const source = context.createMediaStreamSource(stream);
  const processor = context.createScriptProcessor(4096, 1, 1);
  let buffer: Float32Array[] = [];
  let deliveryChain = Promise.resolve();
  let deliveryError: unknown = null;
  let stopping = false;

  processor.onaudioprocess = (event) => {
    if (stopping) return;
    buffer.push(new Float32Array(event.inputBuffer.getChannelData(0)));
  };
  source.connect(processor);
  processor.connect(context.destination);

  const enqueueFlush = () => {
    if (buffer.length === 0) return deliveryChain;
    const current = buffer;
    buffer = [];
    const wav = encodeWav(current, context.sampleRate);
    if (wav.size <= 4000) return deliveryChain;

    deliveryChain = deliveryChain.then(async () => {
      try {
        await onWindow(wav);
      } catch (error) {
        deliveryError ??= error;
      }
    });
    return deliveryChain;
  };

  const interval = window.setInterval(() => {
    void enqueueFlush();
  }, windowMs);

  return {
    stop: async () => {
      if (stopping) {
        await deliveryChain;
        return;
      }
      stopping = true;
      window.clearInterval(interval);
      processor.onaudioprocess = null;
      await enqueueFlush();
      await deliveryChain;
      processor.disconnect();
      source.disconnect();
      stream.getTracks().forEach((track) => track.stop());
      await context.close();
      if (deliveryError) throw deliveryError;
    },
  };
}

/** Aviso sonoro discreto ao atingir o tempo alvo da consulta. */
export function playChime() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.9);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 1);
    window.setTimeout(() => void context.close(), 1200);
  } catch {
    // áudio indisponível — o toast já avisa
  }
}
