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
  private isRouted: boolean = false;
  private continuousOscillator: OscillatorNode | null = null;
  private streamBus: GainNode | null = null;
 
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
      console.log('🎧 AudioContext sampleRate:', this.audioContext.sampleRate);
      
      // Create master gain node
      this.masterGain = this.audioContext.createGain();
      this.masterGain.gain.value = 0.8;
      
      // Create MediaStreamAudioDestinationNode for broadcasting
      this.mediaStreamDestination = this.audioContext.createMediaStreamDestination();
      
      // Connect master gain to stream destination (for broadcasting)
      this.masterGain.connect(this.mediaStreamDestination);

      // Create stream bus (tap point for broadcasting)
      this.streamBus = this.audioContext.createGain();
      this.streamBus.gain.value = 1.0;
      this.streamBus.connect(this.masterGain);
      
      // Create a continuous silent tone to keep the stream alive (radio approach)
      this.continuousOscillator = this.audioContext.createOscillator();
      const silentGain = this.audioContext.createGain();
      silentGain.gain.value = 0.001; // Nearly silent but keeps stream active
      this.continuousOscillator.frequency.value = 20; // Sub-audible frequency
      this.continuousOscillator.connect(silentGain);
      silentGain.connect(this.masterGain);
      this.continuousOscillator.start();
      
      console.log('🎵 HostMasterAudio initialized: destination tracks', this.mediaStreamDestination.stream.getAudioTracks().map(t => t.id));
    } catch (error) {
      console.error('Failed to initialize HostMasterAudio:', error);
      throw error;
    }
  }

  connectToCookModeEngine(): void {
    if (!this.audioContext || !this.masterGain) {
      throw new Error('HostMasterAudio not initialized');
    }

    if (this.isRouted) {
      console.log('🎵 HostMasterAudio already routed; skipping duplicate connection');
      return;
    }

    try {
      // No direct routing from destination. Stream bus is provided for engine sources.
      this.isRouted = true;
      console.log('🎵 HostMasterAudio stream bus ready for engine connections');
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

  getStreamBus(): GainNode | null {
    return this.streamBus;
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
    if (this.continuousOscillator) {
      this.continuousOscillator.stop();
      this.continuousOscillator.disconnect();
      this.continuousOscillator = null;
    }
    
    if (this.masterPlayer) {
      this.masterPlayer.dispose();
      this.masterPlayer = null;
    }
    
    if (this.masterGain) {
      this.masterGain.disconnect();
      this.masterGain = null;
    }

    if (this.streamBus) {
      this.streamBus.disconnect();
      this.streamBus = null;
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