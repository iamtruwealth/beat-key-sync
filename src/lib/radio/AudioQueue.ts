import { createWavFromPCMBytes } from './wav';

interface QueueItem {
  data: Uint8Array; // raw PCM16 little-endian bytes
  sampleRate: number;
}

export class AudioQueue {
  private queue: QueueItem[] = [];
  private isPlaying = false;
  private context: AudioContext;

  constructor(context: AudioContext) {
    this.context = context;
  }

  clear() {
    this.queue = [];
    this.isPlaying = false;
  }

  async addToQueue(data: Uint8Array, sampleRate: number) {
    this.queue.push({ data, sampleRate });
    if (!this.isPlaying) await this.playNext();
  }

  private async playNext() {
    if (this.queue.length === 0) {
      this.isPlaying = false;
      return;
    }

    this.isPlaying = true;
    const { data, sampleRate } = this.queue.shift()!;

    try {
      const wav = createWavFromPCMBytes(data, sampleRate, 1);
      const audioBuffer = await this.context.decodeAudioData(wav.buffer.slice(0));
      const source = this.context.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.context.destination);
      source.onended = () => this.playNext();
      source.start(0);
    } catch (err) {
      console.error('AudioQueue: decode/play error', err);
      // Continue with next chunk
      await this.playNext();
    }
  }
}
