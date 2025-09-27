import * as Tone from 'tone';

interface AudioTrack {
  id: string;
  player: Tone.Player;
  offsetInBeats: number;
  durationInBeats: number;
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
}

class ToneAudioEngine {
  private tracks: Map<string, AudioTrack> = new Map();
  private loopEndInBeats = 0;
  private isInitialized = false;

  constructor() {
    // Initialize with default BPM
    Tone.Transport.bpm.value = 140;
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = "0:0:0";
  }

  private beatsToBBS(beats: number): string {
    const bars = Math.floor(beats / 4);
    const remBeats = Math.floor(beats % 4);
    const sixteenths = Math.round((beats - Math.floor(beats)) * 4);
    return `${bars}:${remBeats}:${sixteenths}`;
  }

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      await Tone.start();
      this.isInitialized = true;
      console.log('Tone.js initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Tone.js:', error);
      throw error;
    }
  }

  async addTrack(
    trackId: string,
    audioUrl: string, 
    offsetInBeats: number = 0, 
    durationInBeats: number = 16,
    volume: number = 1,
    isMuted: boolean = false,
    isSolo: boolean = false
  ): Promise<void> {
    await this.initialize();
    
    try {
      // Create player without URL so we can await explicit load
      const player = new Tone.Player({
        loop: false,
        autostart: false,
        onerror: (error) => {
          console.error(`Error loading track ${trackId}:`, error);
        }
      }).toDestination();

      // Ensure the buffer is loaded before scheduling any playback
      await player.load(audioUrl);
      console.log(`Track ${trackId} loaded successfully`);

      // Apply volume and mute settings
      player.volume.value = Tone.gainToDb(volume);
      player.mute = isMuted;

      // Sync to Transport and schedule start/stop within clip boundaries
      player.sync();
      const startTime = this.beatsToBBS(offsetInBeats);
      const stopTime = this.beatsToBBS(offsetInBeats + durationInBeats);
      player.start(startTime);
      player.stop(stopTime);

      const track: AudioTrack = {
        id: trackId,
        player,
        offsetInBeats,
        durationInBeats,
        volume,
        isMuted,
        isSolo
      };

      this.tracks.set(trackId, track);

      // Recalculate loop end based on furthest clip endpoint
      const clipEnd = offsetInBeats + durationInBeats;
      this.loopEndInBeats = Math.max(this.loopEndInBeats, clipEnd);

      this.updateLoopRegion();
      console.log(`Added track ${trackId} with duration ${durationInBeats} beats`);
    } catch (error) {
      console.error(`Failed to add track ${trackId}:`, error);
      throw error;
    }
  }

  removeTrack(trackId: string): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.player.stop();
      track.player.dispose();
      this.tracks.delete(trackId);
      
      // Recalculate loop end
      this.recalculateLoopEnd();
      console.log(`Removed track ${trackId}`);
    }
  }

  updateTrackVolume(trackId: string, volume: number): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.volume = volume;
      track.player.volume.value = Tone.gainToDb(volume);
    }
  }

  muteTrack(trackId: string, muted: boolean): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.isMuted = muted;
      track.player.mute = muted;
    }
  }

  soloTrack(trackId: string, solo: boolean): void {
    const track = this.tracks.get(trackId);
    if (track) {
      track.isSolo = solo;
      
      // Handle solo logic: if any track is solo, mute all non-solo tracks
      const hasSoloTracks = Array.from(this.tracks.values()).some(t => t.isSolo);
      
      this.tracks.forEach((t) => {
        if (hasSoloTracks) {
          t.player.mute = !t.isSolo;
        } else {
          t.player.mute = t.isMuted;
        }
      });
    }
  }

  private recalculateLoopEnd(): void {
    this.loopEndInBeats = 0;
    this.tracks.forEach(track => {
      const clipEnd = track.offsetInBeats + track.durationInBeats;
      this.loopEndInBeats = Math.max(this.loopEndInBeats, clipEnd);
    });
    
    // Minimum 4 bars if no tracks
    if (this.loopEndInBeats === 0) {
      this.loopEndInBeats = 16; // 4 bars at 4/4
    }
    
    this.updateLoopRegion();
  }

  private updateLoopRegion(): void {
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = "0:0:0";
    Tone.Transport.loopEnd = this.beatsToBBS(this.loopEndInBeats);
    console.log(`Loop region updated: 0 to ${this.loopEndInBeats} beats`);
  }

  async startPlayback(): Promise<void> {
    await this.initialize();
    
    try {
      Tone.Transport.start("+0.1");
      console.log('Playback started');
    } catch (error) {
      console.error('Failed to start playback:', error);
      throw error;
    }
  }

  stopPlayback(): void {
    Tone.Transport.stop();
    console.log('Playback stopped');
  }

  pausePlayback(): void {
    Tone.Transport.pause();
    console.log('Playback paused');
  }

  seekTo(positionInSeconds: number): void {
    // Seek with second precision for accurate playhead updates
    const clamped = Math.max(0, positionInSeconds);
    Tone.Transport.seconds = clamped;
    console.log(`Seeked to ${clamped} seconds`);
  }

  setBPM(newBPM: number): void {
    if (newBPM < 10 || newBPM > 250) {
      console.warn(`BPM ${newBPM} out of range (10-250), clamping`);
      newBPM = Math.max(10, Math.min(250, newBPM));
    }
    
    Tone.Transport.stop();
    Tone.Transport.bpm.value = newBPM;
    console.log(`BPM set to ${newBPM}`);
  }

  getCurrentPosition(): number {
    // Convert Tone.js position to seconds
    const position = Tone.Transport.position;
    if (typeof position === 'string') {
      // Parse "bars:beats:sixteenths" format
      const parts = position.split(':').map(Number);
      const bars = parts[0] || 0;
      const beats = parts[1] || 0;
      const sixteenths = parts[2] || 0;
      const totalBeats = (bars * 4) + beats + (sixteenths / 4);
      // Convert beats to seconds using current BPM
      return (totalBeats * 60) / this.currentBPM;
    }
    return 0;
  }

  getCurrentPositionInBeats(): number {
    // Convert Tone.js position to beats
    const position = Tone.Transport.position;
    if (typeof position === 'string') {
      // Parse "bars:beats:sixteenths" format
      const parts = position.split(':').map(Number);
      const bars = parts[0] || 0;
      const beats = parts[1] || 0;
      const sixteenths = parts[2] || 0;
      return (bars * 4) + beats + (sixteenths / 4);
    }
    return 0;
  }

  get currentBPM(): number {
    return Tone.Transport.bpm.value;
  }

  get isPlaying(): boolean {
    return Tone.Transport.state === 'started';
  }

  get loopDurationInBeats(): number {
    return this.loopEndInBeats;
  }

  dispose(): void {
    this.tracks.forEach(track => {
      track.player.stop();
      track.player.dispose();
    });
    this.tracks.clear();
    Tone.Transport.stop();
    console.log('Tone audio engine disposed');
  }
}

// Export singleton instance
export const toneAudioEngine = new ToneAudioEngine();
export { ToneAudioEngine };