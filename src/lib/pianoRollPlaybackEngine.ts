import * as Tone from 'tone';
import { PianoRollNote, SampleTrigger } from '@/types/pianoRoll';

export interface TrackPlaybackData {
  trackId: string;
  mode: 'midi' | 'sample';
  notes: PianoRollNote[];
  triggers: SampleTrigger[];
  synth?: Tone.PolySynth;
  samplers?: Map<number, Tone.Player>;
}

export class PianoRollPlaybackEngine {
  private tracks = new Map<string, TrackPlaybackData>();
  private scheduledEvents: number[] = [];
  private isInitialized = false;

  async initialize() {
    if (this.isInitialized) return;
    
    try {
      await Tone.start();
      this.isInitialized = true;
      console.log('🎹 PianoRollPlaybackEngine initialized');
    } catch (error) {
      console.error('❌ Failed to initialize PianoRollPlaybackEngine:', error);
      throw error;
    }
  }

  // Register a MIDI track
  registerMidiTrack(trackId: string, notes: PianoRollNote[]) {
    console.log(`🎹 Registering MIDI track ${trackId} with ${notes.length} notes`);
    
    let synth = this.tracks.get(trackId)?.synth;
    
    if (!synth) {
      synth = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle' },
        envelope: {
          attack: 0.005,
          decay: 0.1,
          sustain: 0.3,
          release: 1
        }
      }).toDestination();
      synth.volume.value = -10;
    }

    this.tracks.set(trackId, {
      trackId,
      mode: 'midi',
      notes,
      triggers: [],
      synth,
    });
  }

  // Register a sample track
  registerSampleTrack(trackId: string, triggers: SampleTrigger[], samplers: Map<number, Tone.Player>) {
    console.log(`🎹 Registering sample track ${trackId} with ${triggers.length} triggers`);
    
    this.tracks.set(trackId, {
      trackId,
      mode: 'sample',
      notes: [],
      triggers,
      samplers,
    });
  }

  // Unregister a track
  unregisterTrack(trackId: string) {
    const trackData = this.tracks.get(trackId);
    if (trackData) {
      trackData.synth?.dispose();
      trackData.samplers?.forEach(player => player.dispose());
      this.tracks.delete(trackId);
      console.log(`🎹 Unregistered track ${trackId}`);
    }
  }

  // Schedule all notes for playback (called when play starts or clips change)
  schedulePlayback(bpm: number) {
    // Clear existing schedules
    this.clearSchedules();

    const secondsPerBeat = 60 / bpm;

    this.tracks.forEach((trackData) => {
      if (trackData.mode === 'midi' && trackData.synth) {
        // Schedule MIDI notes
        trackData.notes.forEach(note => {
          const startTimeInSeconds = note.startTime * secondsPerBeat;
          const durationInSeconds = note.duration * secondsPerBeat;
          const noteName = Tone.Frequency(note.pitch, "midi").toNote();
          
          const eventId = Tone.Transport.schedule((time) => {
            trackData.synth?.triggerAttackRelease(
              noteName, 
              durationInSeconds, 
              time, 
              note.velocity / 127
            );
          }, startTimeInSeconds);
          
          this.scheduledEvents.push(eventId);
        });
        
        console.log(`🎹 Scheduled ${trackData.notes.length} MIDI notes for track ${trackData.trackId}`);
      } else if (trackData.mode === 'sample' && trackData.samplers) {
        // Schedule sample triggers
        trackData.triggers.forEach(trigger => {
          const sampler = trackData.samplers?.get(trigger.pitch);
          if (sampler) {
            const startTimeInSeconds = trigger.startTime * secondsPerBeat;
            
            const eventId = Tone.Transport.schedule((time) => {
              const baseBuffer: any = (sampler as any).buffer;
              if (!baseBuffer || (typeof baseBuffer.loaded !== 'undefined' && !baseBuffer.loaded)) {
                return;
              }
              // Create a new player instance for each trigger to avoid conflicts
              const tempPlayer = new Tone.Player(baseBuffer).toDestination();
              tempPlayer.start(time);
              
              // Dispose after playback
              setTimeout(() => tempPlayer.dispose(), (trigger.duration || 1) * secondsPerBeat * 1000 + 1000);
            }, startTimeInSeconds);
            
            this.scheduledEvents.push(eventId);
          }
        });
        
        console.log(`🎹 Scheduled ${trackData.triggers.length} sample triggers for track ${trackData.trackId}`);
      }
    });

    console.log(`🎹 Total scheduled events: ${this.scheduledEvents.length}`);
  }

  // Clear all scheduled events
  clearSchedules() {
    this.scheduledEvents.forEach(id => {
      try {
        Tone.Transport.clear(id);
      } catch (e) {
        // Event might already be cleared
      }
    });
    this.scheduledEvents = [];
    console.log('🎹 Cleared all piano roll schedules');
  }

  // Dispose all resources
  dispose() {
    this.clearSchedules();
    this.tracks.forEach((trackData) => {
      trackData.synth?.dispose();
      trackData.samplers?.forEach(player => player.dispose());
    });
    this.tracks.clear();
    console.log('🎹 PianoRollPlaybackEngine disposed');
  }
}

// Global singleton instance
export const pianoRollPlaybackEngine = new PianoRollPlaybackEngine();
