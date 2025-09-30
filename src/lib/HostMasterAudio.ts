import * as Tone from 'tone';

export class HostMasterAudio {
  private static instance: HostMasterAudio | null = null;
  private audioContext: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private mediaStreamDestination: MediaStreamAudioDestinationNode | null = null;
  private masterPlayer: Tone.Player | null = null;
  private startTime: number = 0;
  private loopDuration: number = 0;
  private isPlaying: boolean = false;

  private constructor() {}

  static getInstance(): HostMasterAudio {
    if (!HostMasterAudio.instance) {
      HostMasterAudio.instance = new HostMasterAudio();
    }
    return HostMasterAudio.instance;
  }

  async initialize(): Promise<void> {
    try {
      // Initialize Tone.js AudioContext
      await Tone.start();
      this.audioContext = Tone.getContext().rawContext as AudioContext;
      
      // Create master gain node
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.8;
      
      // Create MediaStreamAudioDestinationNode for broadcasting
      this.mediaStreamDestination = this.audioContext.createMediaStreamDestination();
      
      // Connect master gain to stream destination (for broadcasting)
      this.masterGain.connect(this.mediaStreamDestination);
      
      console.log('🎵 HostMasterAudio initialized');
    } catch (error) {
      console.error('Failed to initialize HostMasterAudio:', error);
      throw error;
    }
  }

  connectToCookModeEngine(): void {
    if (!this.audioContext || !this.masterGain) {
      throw new Error('HostMasterAudio not initialized');
    }

    try {
      // Get Tone.js Destination (GainNode) and connect it to our masterGain
      const toneContext = Tone.getContext();
      const toneDestination = (toneContext.destination as any)._nativeAudioNode || toneContext.destination;

      // Fork audio: keep default path (host hears), and add a fork to masterGain (for streaming)
      ;(toneDestination as AudioNode).connect(this.masterGain);

      console.log('🎵 CookModeEngine routed to HostMasterAudio (forked to stream)');
    } catch (error) {
      console.error('Failed to connect CookModeEngine:', error);
      throw error;
    }
  }

  async startLooping(): Promise<void> {
    if (!this.masterPlayer || !this.audioContext) {
      throw new Error('Player or AudioContext not initialized');
    }

    try {
      // Start the player
      this.masterPlayer.start();
      this.startTime = this.audioContext.currentTime;
      this.isPlaying = true;
      
      console.log('🎵 Master audio looping started');
    } catch (error) {
      console.error('Failed to start looping:', error);
      throw error;
    }
  }

  getCurrentTime(): number {
    if (!this.audioContext || !this.isPlaying || this.loopDuration === 0) {
      return 0;
    }

    const elapsed = this.audioContext.currentTime - this.startTime;
    return elapsed % this.loopDuration;
  }

  seekTo(time: number): void {
    if (!this.masterPlayer || !this.audioContext) {
      return;
    }

    try {
      // Stop current playback
      this.masterPlayer.stop();
      
      // Start from the specified time
      this.masterPlayer.start(0, time);
      this.startTime = this.audioContext.currentTime - time;
      
      console.log(`🎵 Seeked to time: ${time}s`);
    } catch (error) {
      console.error('Failed to seek:', error);
    }
  }

  getMasterStream(): MediaStream | null {
    return this.mediaStreamDestination?.stream || null;
  }

  setMasterVolume(volume: number): void {
    if (this.masterGain) {
      this.masterGain.gain.value = Math.max(0, Math.min(1, volume));
    }
  }

  stop(): void {
    if (this.masterPlayer) {
      this.masterPlayer.stop();
      this.isPlaying = false;
    }
  }

  dispose(): void {
    if (this.masterPlayer) {
      this.masterPlayer.dispose();
      this.masterPlayer = null;
    }
    
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }
    
    if (this.mediaStreamDestination) {
      this.mediaStreamDestination.disconnect();
      this.mediaStreamDestination = null;
    }
    
    this.audioContext = null;
    this.isPlaying = false;
    HostMasterAudio.instance = null;
    
    console.log('🎵 HostMasterAudio disposed');
  }

  get isInitialized(): boolean {
    return this.audioContext !== null && this.masterGain !== null && this.mediaStreamDestination !== null;
  }

  get hasPlayer(): boolean {
    return this.masterPlayer !== null;
  }
}