export type TrackMode = 'midi' | 'sample';

export type SnapGridValue = 
  | 'none' 
  | 'line' 
  | 'cell'
  | '1/6-step'
  | '1/4-step'
  | '1/3-step'
  | '1/2-step'
  | '1-step'
  | '1/6-beat'
  | '1/4-beat'
  | '1/3-beat'
  | '1/2-beat'
  | '1-beat'
  | '1-bar';

export interface PianoRollNote {
  id: string;
  pitch: number; // MIDI note number (0-127)
  startTime: number; // In beats
  duration: number; // In beats
  velocity: number; // 0-127
}

export interface SampleTrigger {
  id: string;
  pitch: number; // Key mapping (0-127)
  startTime: number; // In beats
  velocity: number; // 0-127
  sampleId?: string; // Reference to loaded sample
}

export interface SampleMapping {
  pitch: number; // MIDI note number
  sampleId: string;
  sampleName: string;
  audioBuffer?: AudioBuffer;
}

export interface PianoRollTrack {
  id: string;
  name: string;
  mode: TrackMode;
  notes: PianoRollNote[];
  triggers: SampleTrigger[];
  sampleMappings: SampleMapping[];
  color?: string;
}

export interface PianoRollState {
  tracks: Record<string, PianoRollTrack>;
  activeTrackId: string | null;
  isPlaying: boolean;
  currentTime: number; // In beats
  bpm: number;
  snapGrid: SnapGridValue;
  zoom: number;
  selectedNotes: string[];
}
