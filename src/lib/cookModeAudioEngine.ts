/**
 * Cook Mode Audio Engine
 * Handles sample playback, MIDI input, audio recording, and undo management
 * Built with Tone.js, Web Audio API, Web MIDI API, and MediaRecorder API
 */

import * as Tone from 'tone';
import { undoManager, ActionType } from './UndoManager';

// Types and Interfaces
export interface AudioSample {
  id: string;
  trackId: string;
  file: File;
  buffer: AudioBuffer | null;
  player: Tone.Player | null;
  loaded: boolean;
}

export interface MidiEvent {
  id: string;
  trackId: string;
  note: number;
  velocity: number;
  timestamp: number;
  type: 'noteOn' | 'noteOff';
}

export interface RecordedNote {
  id: string;
  trackId: string;
  note: number;
  velocity: number;
  startTime: number;
  duration?: number;
}

export interface AudioTrack {
  id: string;
  name: string;
  sample: AudioSample | null;
  recordedNotes: RecordedNote[];
  volume: number;
  muted: boolean;
  solo: boolean;
  color: string;
}

export interface MidiDevice {
  id: string;
  name: string;
  input: MIDIInput;
  connected: boolean;
}

// Core Audio Engine Class
export class CookModeAudioEngine {
  private tracks: Map<string, AudioTrack> = new Map();
  private midiDevices: Map<string, MidiDevice> = new Map();
  private isRecording = false;
  private recordingStartTime = 0;
  private sessionStartTime = 0;
  private audioContext: AudioContext | null = null;
  private mediaRecorder: MediaRecorder | null = null;
  private recordedChunks: Blob[] = [];
  private midiInputActive = false;

  // Event callbacks
  private onMidiDeviceChange?: (devices: MidiDevice[]) => void;
  private onNoteEvent?: (event: MidiEvent) => void;
  private onTrackUpdate?: (tracks: AudioTrack[]) => void;
  private onRecordingStateChange?: (isRecording: boolean) => void;

  constructor() {
    this.sessionStartTime = Date.now();
    this.initializeAudio();
    this.initializeMidi();
  }

  // Initialize Tone.js and Web Audio API
  private async initializeAudio(): Promise<void> {
    try {
      console.log('🎵 Initializing Cook Mode Audio Engine...');
      
      // Initialize Tone.js
      await Tone.start();
      this.audioContext = Tone.getContext().rawContext as AudioContext;
      
      // Set up master transport
      Tone.Transport.bpm.value = 120;
      
      console.log('✅ Audio engine initialized');
    } catch (error) {
      console.error('❌ Failed to initialize audio engine:', error);
      throw error;
    }
  }

  // Initialize Web MIDI API
  private async initializeMidi(): Promise<void> {
    try {
      console.log('🎹 Initializing MIDI...');
      
      if (!navigator.requestMIDIAccess) {
        console.warn('⚠️ Web MIDI API not supported');
        return;
      }

      const midiAccess = await navigator.requestMIDIAccess();
      
      // Handle existing devices
      this.refreshMidiDevices(midiAccess);
      
      // Listen for device changes
      midiAccess.onstatechange = () => {
        console.log('🔄 MIDI device state changed');
        this.refreshMidiDevices(midiAccess);
      };
      
      console.log('✅ MIDI initialized');
    } catch (error) {
      console.error('❌ Failed to initialize MIDI:', error);
    }
  }

  // Refresh MIDI devices list
  private refreshMidiDevices(midiAccess: MIDIAccess): void {
    this.midiDevices.clear();
    
    midiAccess.inputs.forEach((input) => {
      const device: MidiDevice = {
        id: input.id,
        name: input.name || 'Unknown Device',
        input,
        connected: input.state === 'connected'
      };
      
      // Set up MIDI input handler
      input.onmidimessage = (event) => this.handleMidiMessage(event, device.id);
      
      this.midiDevices.set(input.id, device);
      console.log(`🎹 MIDI device found: ${device.name}`);
    });

    // Notify UI of device changes
    if (this.onMidiDeviceChange) {
      this.onMidiDeviceChange(Array.from(this.midiDevices.values()));
    }
  }

  // Handle incoming MIDI messages
  private handleMidiMessage(event: MIDIMessageEvent, deviceId: string): void {
    const [status, note, velocity] = event.data;
    const messageType = status & 0xf0;
    
    // Note On (144) or Note Off (128)
    if (messageType === 144 || messageType === 128) {
      const isNoteOn = messageType === 144 && velocity > 0;
      
      const midiEvent: MidiEvent = {
        id: `midi-${Date.now()}-${Math.random()}`,
        trackId: this.getActiveTrackId(), // Will implement track selection
        note,
        velocity,
        timestamp: Date.now() - this.sessionStartTime,
        type: isNoteOn ? 'noteOn' : 'noteOff'
      };

      console.log(`🎹 MIDI ${isNoteOn ? 'Note On' : 'Note Off'}: Note ${note}, Velocity ${velocity}`);
      
      // Trigger sample if note on
      if (isNoteOn) {
        this.triggerSample(midiEvent.trackId, note, velocity);
        
        // Record note if recording
        if (this.isRecording) {
          this.recordNote(midiEvent);
        }
      }

      // Notify UI
      if (this.onNoteEvent) {
        this.onNoteEvent(midiEvent);
      }
    }
  }

  // Get the currently active track ID (placeholder - implement track selection UI)
  private getActiveTrackId(): string {
    const tracks = Array.from(this.tracks.keys());
    return tracks[0] || 'default-track';
  }

  // Create a new audio track
  public createTrack(id: string, name: string): AudioTrack {
    const track: AudioTrack = {
      id,
      name,
      sample: null,
      recordedNotes: [],
      volume: 1.0,
      muted: false,
      solo: false,
      color: this.generateTrackColor(this.tracks.size)
    };

    this.tracks.set(id, track);
    console.log(`🎵 Created track: ${name} (${id})`);
    
    this.notifyTrackUpdate();
    return track;
  }

  // Generate unique colors for tracks
  private generateTrackColor(index: number): string {
    const colors = [
      '#22c55e', // green
      '#3b82f6', // blue
      '#a855f7', // purple
      '#f59e0b', // amber
      '#ef4444', // red
      '#06b6d4', // cyan
      '#8b5cf6', // violet
      '#ec4899', // pink
    ];
    return colors[index % colors.length];
  }

  // Load a sample for a track
  public async loadSample(trackId: string, file: File): Promise<void> {
    try {
      console.log(`🎵 Loading sample for track ${trackId}: ${file.name}`);
      
      const track = this.tracks.get(trackId);
      if (!track) {
        throw new Error(`Track ${trackId} not found`);
      }

      // Create audio buffer from file
      const arrayBuffer = await file.arrayBuffer();
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      
      // Create Tone.js player
      const player = new Tone.Player(audioBuffer).toDestination();
      
      const sample: AudioSample = {
        id: `sample-${trackId}-${Date.now()}`,
        trackId,
        file,
        buffer: audioBuffer,
        player,
        loaded: true
      };

      // Dispose old sample if exists
      if (track.sample?.player) {
        track.sample.player.dispose();
      }

      track.sample = sample;
      
      // Register undo action
      undoManager.push({
        type: ActionType.ADD_CLIP,
        payload: { trackId, sample },
        undo: () => {
          console.log(`🔄 Undoing sample load for track ${trackId}`);
          if (track.sample?.player) {
            track.sample.player.dispose();
          }
          track.sample = null;
          this.notifyTrackUpdate();
        },
        description: `Load sample ${file.name} to track ${track.name}`
      });

      console.log(`✅ Sample loaded successfully for track ${trackId}`);
      this.notifyTrackUpdate();
      
    } catch (error) {
      console.error(`❌ Failed to load sample for track ${trackId}:`, error);
      throw error;
    }
  }

  // Trigger a sample with note and velocity
  public triggerSample(trackId: string, note: number = 60, velocity: number = 127): void {
    const track = this.tracks.get(trackId);
    if (!track || !track.sample?.player || track.muted) {
      return;
    }

    try {
      // Calculate playback rate based on note (C4 = 60 is baseline)
      const semitoneOffset = note - 60;
      const playbackRate = Math.pow(2, semitoneOffset / 12);
      
      // Calculate volume based on velocity
      const volumeDb = Tone.gainToDb(velocity / 127 * track.volume);
      
      // Trigger the sample
      track.sample.player.playbackRate = playbackRate;
      track.sample.player.volume.value = volumeDb;
      track.sample.player.start();

      console.log(`🎵 Triggered sample on track ${trackId}, note ${note}, velocity ${velocity}`);
      
    } catch (error) {
      console.error(`❌ Failed to trigger sample on track ${trackId}:`, error);
    }
  }

  // Start recording MIDI notes
  public startRecording(): void {
    if (this.isRecording) {
      console.warn('⚠️ Already recording');
      return;
    }

    this.isRecording = true;
    this.recordingStartTime = Date.now();
    
    console.log('🔴 Started recording');
    
    if (this.onRecordingStateChange) {
      this.onRecordingStateChange(true);
    }
  }

  // Stop recording MIDI notes
  public stopRecording(): void {
    if (!this.isRecording) {
      console.warn('⚠️ Not currently recording');
      return;
    }

    this.isRecording = false;
    
    console.log('⏹️ Stopped recording');
    
    if (this.onRecordingStateChange) {
      this.onRecordingStateChange(false);
    }
  }

  // Record a MIDI note event
  private recordNote(midiEvent: MidiEvent): void {
    const track = this.tracks.get(midiEvent.trackId);
    if (!track) return;

    const recordedNote: RecordedNote = {
      id: `note-${Date.now()}-${Math.random()}`,
      trackId: midiEvent.trackId,
      note: midiEvent.note,
      velocity: midiEvent.velocity,
      startTime: midiEvent.timestamp
    };

    track.recordedNotes.push(recordedNote);
    
    // Register undo action
    undoManager.push({
      type: ActionType.RECORD_MIDI_NOTE,
      payload: { trackId: midiEvent.trackId, note: recordedNote },
      undo: () => {
        console.log(`🔄 Undoing recorded note ${recordedNote.note} on track ${midiEvent.trackId}`);
        const noteIndex = track.recordedNotes.findIndex(n => n.id === recordedNote.id);
        if (noteIndex >= 0) {
          track.recordedNotes.splice(noteIndex, 1);
          this.notifyTrackUpdate();
        }
      },
      description: `Record note ${recordedNote.note} on track ${track.name}`
    });

    console.log(`📝 Recorded note ${recordedNote.note} on track ${midiEvent.trackId}`);
    this.notifyTrackUpdate();
  }

  // Playback recorded performance
  public playbackRecording(): void {
    console.log('▶️ Starting playback of recorded performance');
    
    // Stop transport if playing
    Tone.Transport.stop();
    Tone.Transport.cancel();
    
    // Schedule all recorded notes
    this.tracks.forEach((track) => {
      track.recordedNotes.forEach((note) => {
        const timeInSeconds = note.startTime / 1000;
        
        Tone.Transport.schedule((time) => {
          this.triggerSample(track.id, note.note, note.velocity);
        }, timeInSeconds);
      });
    });

    // Start playback
    Tone.Transport.start();
  }

  // Notify UI of track updates
  private notifyTrackUpdate(): void {
    if (this.onTrackUpdate) {
      this.onTrackUpdate(Array.from(this.tracks.values()));
    }
  }

  // Get all tracks
  public getTracks(): AudioTrack[] {
    return Array.from(this.tracks.values());
  }

  // Get all MIDI devices
  public getMidiDevices(): MidiDevice[] {
    return Array.from(this.midiDevices.values());
  }

  // Check if any MIDI devices are connected
  public hasMidiDevices(): boolean {
    return Array.from(this.midiDevices.values()).some(device => device.connected);
  }

  // Set event callbacks
  public setCallbacks(callbacks: {
    onMidiDeviceChange?: (devices: MidiDevice[]) => void;
    onNoteEvent?: (event: MidiEvent) => void;
    onTrackUpdate?: (tracks: AudioTrack[]) => void;
    onRecordingStateChange?: (isRecording: boolean) => void;
  }): void {
    this.onMidiDeviceChange = callbacks.onMidiDeviceChange;
    this.onNoteEvent = callbacks.onNoteEvent;
    this.onTrackUpdate = callbacks.onTrackUpdate;
    this.onRecordingStateChange = callbacks.onRecordingStateChange;
  }

  // Record audio input using MediaRecorder API
  public async recordAudioInput(trackId: string, durationMs: number = 10000): Promise<Blob> {
    try {
      console.log(`🎤 Starting audio input recording for track ${trackId}`);
      
      // Request microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          sampleRate: 44100,
          channelCount: 2,
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      this.recordedChunks = [];
      
      // Create MediaRecorder with WAV format
      const options = { mimeType: 'audio/webm' };
      this.mediaRecorder = new MediaRecorder(stream, options);
      
      // Handle data available
      this.mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          this.recordedChunks.push(event.data);
        }
      };

      // Handle recording stop
      const recordingPromise = new Promise<Blob>((resolve, reject) => {
        this.mediaRecorder!.onstop = () => {
          const audioBlob = new Blob(this.recordedChunks, { type: 'audio/webm' });
          
          // Stop all tracks to release microphone
          stream.getTracks().forEach(track => track.stop());
          
          console.log(`✅ Audio recording completed, size: ${audioBlob.size} bytes`);
          resolve(audioBlob);
        };

        this.mediaRecorder!.onerror = (event) => {
          console.error('❌ MediaRecorder error:', event);
          stream.getTracks().forEach(track => track.stop());
          reject(new Error('Recording failed'));
        };
      });

      // Start recording
      this.mediaRecorder.start();
      
      // Auto-stop after duration
      setTimeout(() => {
        if (this.mediaRecorder && this.mediaRecorder.state === 'recording') {
          this.mediaRecorder.stop();
        }
      }, durationMs);

      const audioBlob = await recordingPromise;
      
      // Convert to WAV and add to track
      const wavBlob = await this.convertToWav(audioBlob);
      await this.addRecordedAudioToTrack(trackId, wavBlob);
      
      return wavBlob;
      
    } catch (error) {
      console.error(`❌ Failed to record audio for track ${trackId}:`, error);
      throw error;
    }
  }

  // Convert audio blob to WAV format
  private async convertToWav(audioBlob: Blob): Promise<Blob> {
    try {
      // Create audio buffer from blob
      const arrayBuffer = await audioBlob.arrayBuffer();
      const audioBuffer = await this.audioContext!.decodeAudioData(arrayBuffer);
      
      // Convert to WAV
      const wavBuffer = this.audioBufferToWav(audioBuffer);
      return new Blob([wavBuffer], { type: 'audio/wav' });
      
    } catch (error) {
      console.error('❌ Failed to convert audio to WAV:', error);
      // Return original blob if conversion fails
      return audioBlob;
    }
  }

  // Convert AudioBuffer to WAV format
  private audioBufferToWav(audioBuffer: AudioBuffer): ArrayBuffer {
    const length = audioBuffer.length;
    const numberOfChannels = audioBuffer.numberOfChannels;
    const sampleRate = audioBuffer.sampleRate;
    const bitsPerSample = 16;
    const bytesPerSample = bitsPerSample / 8;
    const blockAlign = numberOfChannels * bytesPerSample;
    const byteRate = sampleRate * blockAlign;
    const dataSize = length * blockAlign;
    const bufferSize = 44 + dataSize;

    const buffer = new ArrayBuffer(bufferSize);
    const view = new DataView(buffer);

    // WAV header
    const writeString = (offset: number, string: string) => {
      for (let i = 0; i < string.length; i++) {
        view.setUint8(offset + i, string.charCodeAt(i));
      }
    };

    writeString(0, 'RIFF');
    view.setUint32(4, bufferSize - 8, true);
    writeString(8, 'WAVE');
    writeString(12, 'fmt ');
    view.setUint32(16, 16, true); // PCM format size
    view.setUint16(20, 1, true); // PCM format
    view.setUint16(22, numberOfChannels, true);
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, byteRate, true);
    view.setUint16(32, blockAlign, true);
    view.setUint16(34, bitsPerSample, true);
    writeString(36, 'data');
    view.setUint32(40, dataSize, true);

    // Convert audio data
    let offset = 44;
    for (let i = 0; i < length; i++) {
      for (let channel = 0; channel < numberOfChannels; channel++) {
        const sample = audioBuffer.getChannelData(channel)[i];
        const intSample = Math.max(-1, Math.min(1, sample)) * 0x7FFF;
        view.setInt16(offset, intSample, true);
        offset += 2;
      }
    }

    return buffer;
  }

  // Add recorded audio to track
  private async addRecordedAudioToTrack(trackId: string, audioBlob: Blob): Promise<void> {
    try {
      const track = this.tracks.get(trackId);
      if (!track) {
        throw new Error(`Track ${trackId} not found`);
      }

      // Create file from blob
      const file = new File([audioBlob], `recorded-audio-${Date.now()}.wav`, {
        type: 'audio/wav'
      });

      // Load as sample
      await this.loadSample(trackId, file);
      
      console.log(`✅ Recorded audio added to track ${trackId}`);
      
    } catch (error) {
      console.error(`❌ Failed to add recorded audio to track ${trackId}:`, error);
      throw error;
    }
  }

  // Check if audio input recording is supported
  public isAudioRecordingSupported(): boolean {
    return !!(navigator.mediaDevices && 
              navigator.mediaDevices.getUserMedia && 
              window.MediaRecorder);
  }

  // Cleanup
  public dispose(): void {
    console.log('🧹 Disposing Cook Mode Audio Engine...');
    
    // Stop recording if active
    if (this.isRecording) {
      this.stopRecording();
    }

    // Stop transport
    Tone.Transport.stop();
    Tone.Transport.cancel();

    // Dispose all players
    this.tracks.forEach((track) => {
      if (track.sample?.player) {
        track.sample.player.dispose();
      }
    });

    // Clear collections
    this.tracks.clear();
    this.midiDevices.clear();

    console.log('✅ Audio engine disposed');
  }
}