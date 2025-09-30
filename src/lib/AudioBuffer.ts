// Audio buffer for smooth radio-style playback
export class AudioBuffer {
  private buffer: Float32Array[] = [];
  private isPlaying = false;
  private targetBufferSize = 8; // ~1-2 seconds at 24kHz chunks
  private sampleRate = 24000;
  private audioContext: AudioContext;
  private gainNode: GainNode;

  constructor(audioContext: AudioContext) {
    this.audioContext = audioContext;
    this.gainNode = audioContext.createGain();
    this.gainNode.gain.value = 0.8;
    this.gainNode.connect(audioContext.destination);
  }

  addChunk(audioData: Float32Array) {
    this.buffer.push(new Float32Array(audioData));
    
    // Start playback if we have enough buffer and not already playing
    if (!this.isPlaying && this.buffer.length >= 2) {
      this.startPlayback();
    }
  }

  private async startPlayback() {
    if (this.isPlaying || this.buffer.length === 0) return;
    
    this.isPlaying = true;
    console.log('🎵 Starting buffered audio playback');
    
    while (this.buffer.length > 0) {
      const chunk = this.buffer.shift()!;
      await this.playChunk(chunk);
      
      // Small delay to prevent audio crackling
      await new Promise(resolve => setTimeout(resolve, 10));
    }
    
    this.isPlaying = false;
    console.log('🎵 Buffer empty, playback stopped');
  }

  private playChunk(audioData: Float32Array): Promise<void> {
    return new Promise((resolve) => {
      try {
        // Convert to AudioBuffer
        const audioBuffer = this.audioContext.createBuffer(1, audioData.length, this.sampleRate);
        audioBuffer.getChannelData(0).set(audioData);
        
        // Create and play source
        const source = this.audioContext.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.gainNode);
        
        source.onended = () => resolve();
        source.start(0);
      } catch (error) {
        console.warn('Audio chunk playback failed:', error);
        resolve();
      }
    });
  }

  setVolume(volume: number) {
    this.gainNode.gain.value = Math.max(0, Math.min(1, volume));
  }

  clear() {
    this.buffer = [];
  }

  get bufferLength() {
    return this.buffer.length;
  }
}