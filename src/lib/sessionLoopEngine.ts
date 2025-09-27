import * as Tone from "tone";

export type Clip = {
  id: string;
  url: string;
  offsetInBeats: number;
  durationInBeats: number;
  gain?: number;
  muted?: boolean;
};

export class SessionLoopEngine {
  private players = new Map<string, Tone.Player>();
  private gains = new Map<string, Tone.Gain>();
  private clips: Clip[] = [];
  private loopEndInBeats = 0;
  private isInitialized = false;
  
  onTick?: (seconds: number) => void;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      await Tone.start();
      Tone.Transport.loop = true;
      Tone.Transport.loopStart = 0;
      this.isInitialized = true;
      console.log('SessionLoopEngine initialized successfully');
    } catch (error) {
      console.error('Failed to initialize SessionLoopEngine:', error);
      throw error;
    }
  }

  setBpm(bpm: number) {
    if (bpm < 10 || bpm > 250) {
      console.warn(`BPM ${bpm} out of range (10-250), clamping`);
      bpm = Math.max(10, Math.min(250, bpm));
    }
    
    Tone.Transport.stop();
    Tone.Transport.bpm.value = bpm;
    console.log(`BPM set to ${bpm}`);
  }

  async setClips(clips: Clip[]) {
    await this.initialize();

    // Dispose existing players and gains
    this.players.forEach(p => p.dispose());
    this.gains.forEach(g => g.dispose());
    this.players.clear();
    this.gains.clear();

    this.clips = clips.slice();
    this.loopEndInBeats = clips.reduce(
      (max, c) => Math.max(max, c.offsetInBeats + c.durationInBeats),
      16 // Minimum 4 bars
    );
    
    // Set Transport loop end using bars:beats:sixteenths format
    const bars = Math.floor(this.loopEndInBeats / 4);
    const beats = this.loopEndInBeats % 4;
    Tone.Transport.loopEnd = `${bars}:${beats}:0`;
    
    console.log(`Loop end set to ${this.loopEndInBeats} beats (${bars}:${beats}:0)`);

    // Create players for each clip
    for (const clip of this.clips) {
      try {
        const gain = new Tone.Gain(clip.gain ?? 1).toDestination();
        const player = new Tone.Player({ 
          url: clip.url, 
          loop: false, 
          autostart: false,
          onerror: (error) => {
            console.error(`Error loading clip ${clip.id}:`, error);
          }
        }).connect(gain);

        // Wait for buffer to load - buffer loads automatically with URL in constructor
        await new Promise<void>((resolve, reject) => {
          if (player.loaded) {
            console.log(`Clip ${clip.id} already loaded`);
            resolve();
          } else {
            console.log(`Waiting for clip ${clip.id} to load...`);
            const timeout = setTimeout(() => {
              reject(new Error(`Timeout loading clip ${clip.id}`));
            }, 10000); // 10 second timeout
            
            const checkLoaded = () => {
              if (player.loaded) {
                clearTimeout(timeout);
                console.log(`Clip ${clip.id} loaded successfully`);
                resolve();
              } else {
                setTimeout(checkLoaded, 100);
              }
            };
            checkLoaded();
          }
        });
        
        // Sync to Transport and schedule start/stop times
        player.sync();
        
        // Convert beats to bars:beats:sixteenths format
        const startBars = Math.floor(clip.offsetInBeats / 4);
        const startBeats = clip.offsetInBeats % 4;
        const endBars = Math.floor((clip.offsetInBeats + clip.durationInBeats) / 4);
        const endBeats = (clip.offsetInBeats + clip.durationInBeats) % 4;
        
        const startTime = `${startBars}:${startBeats}:0`;
        const endTime = `${endBars}:${endBeats}:0`;
        
        player.start(startTime);
        player.stop(endTime);
        
        if (clip.muted) {
          gain.gain.value = 0;
        }
        
        this.players.set(clip.id, player);
        this.gains.set(clip.id, gain);
        
        console.log(`Added clip ${clip.id} from ${startTime} to ${endTime}`);
      } catch (error) {
        console.error(`Failed to load clip ${clip.id}:`, error);
        throw error;
      }
    }
  }

  async start() {
    await this.initialize();
    
    try {
      // If resuming from pause, keep current position; otherwise start from beginning
      if (Tone.Transport.state !== 'paused') {
        Tone.Transport.position = 0;
      }
      Tone.Transport.start("+0.05");
      this.startTransportTicker();
      console.log('Session playback started');
    } catch (error) {
      console.error('Failed to start session playback:', error);
      throw error;
    }
  }

  stop() {
    Tone.Transport.stop();
    Tone.Transport.position = 0;
    this.stopTransportTicker();
    console.log('Session playback stopped');
  }

  pause() {
    Tone.Transport.pause();
    this.stopTransportTicker();
    console.log('Session playback paused');
  }

  seek(seconds: number) {
    const loopLenSec = Tone.Time(Tone.Transport.loopEnd).toSeconds();
    const clampedSeconds = Math.min(Math.max(seconds, 0), loopLenSec - 0.0001);
    Tone.Transport.seconds = clampedSeconds;
    console.log(`Seeked to ${clampedSeconds} seconds`);
  }

  updateClipGain(clipId: string, gain: number) {
    const gainNode = this.gains.get(clipId);
    if (gainNode) {
      gainNode.gain.value = gain;
    }
  }

  muteClip(clipId: string, muted: boolean) {
    const gainNode = this.gains.get(clipId);
    if (gainNode) {
      gainNode.gain.value = muted ? 0 : (this.clips.find(c => c.id === clipId)?.gain ?? 1);
    }
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

  get loopDurationInSeconds(): number {
    return Tone.Time(Tone.Transport.loopEnd).toSeconds();
  }

  private transportTimer?: number;
  
  private startTransportTicker() {
    this.stopTransportTicker();
    this.transportTimer = window.setInterval(() => {
      if (this.onTick && this.isPlaying) {
        const loopLenSec = this.loopDurationInSeconds;
        const currentPos = Tone.Transport.seconds % loopLenSec;
        this.onTick(currentPos);
      }
    }, 50);
  }

  private stopTransportTicker() {
    if (this.transportTimer) {
      window.clearInterval(this.transportTimer);
      this.transportTimer = undefined;
    }
  }

  dispose() {
    this.players.forEach(p => {
      try {
        if (p.state !== 'stopped') {
          p.stop();
        }
        p.dispose();
      } catch (error) {
        console.warn('Error disposing player:', error);
        p.dispose(); // Still try to dispose even if stop fails
      }
    });
    this.gains.forEach(g => g.dispose());
    this.players.clear();
    this.gains.clear();
    this.stopTransportTicker();
    Tone.Transport.stop();
    console.log('SessionLoopEngine disposed');
  }
}

// Export singleton instance
export const sessionLoopEngine = new SessionLoopEngine();