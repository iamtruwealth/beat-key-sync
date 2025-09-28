import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as Tone from 'tone';
import { undoManager } from '@/lib/UndoManager';
import { useToast } from '@/components/ui/use-toast';

// Custom MIDI types to avoid conflicts
interface CustomMIDIInput {
  readonly id: string;
  readonly name: string;
  readonly manufacturer?: string;
  readonly type: string;
  readonly state: string;
  readonly connection: string;
  readonly version?: string;
  onmidimessage: ((event: CustomMIDIMessageEvent) => void) | null;
  addEventListener: (type: string, listener: any) => void;
  removeEventListener: (type: string, listener: any) => void;
  close?: () => void;
  open?: () => void;
}

interface CustomMIDIMessageEvent {
  readonly data: Uint8Array;
  readonly timeStamp: number;
}

interface Track {
  id: string;
  name: string;
  file_url: string;
  stem_type: string;
  duration?: number;
  bars?: number;
  volume?: number;
  isMuted?: boolean;
  isSolo?: boolean;
  analyzed_duration?: number;
}

interface AudioClip {
  id: string;
  trackId: string;
  startTime: number;
  endTime: number;
  originalTrack: Track;
  isSelected?: boolean;
}

interface MidiNote {
  id: string;
  noteNumber: number;
  velocity: number;
  timestamp: number;
  duration?: number;
  clipId: string;
}

interface ActiveNote {
  noteNumber: number;
  player: Tone.Player;
  gainNode: Tone.Gain;
  startTime: number;
}

interface TrackMidiControllerProps {
  selectedClip?: AudioClip;
  isEnabled?: boolean;
  onNoteTriggered?: (noteNumber: number, velocity: number) => void;
  onRecordingStateChange?: (isRecording: boolean) => void;
  className?: string;
}

export const TrackMidiController: React.FC<TrackMidiControllerProps> = ({
  selectedClip,
  isEnabled = true,
  onNoteTriggered,
  onRecordingStateChange,
  className = ""
}) => {
  console.log('🎹 TrackMidiController initialized', { selectedClip, isEnabled });
  
  const { toast } = useToast();
  const [midiDevices, setMidiDevices] = useState<CustomMIDIInput[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordedNotes, setRecordedNotes] = useState<MidiNote[]>([]);
  const [activeNotes, setActiveNotes] = useState<Map<number, ActiveNote>>(new Map());
  
  const activeNotesRef = useRef<Map<number, ActiveNote>>(new Map());
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const playersRef = useRef<Map<string, Tone.Player>>(new Map());
  const recordingStartTimeRef = useRef<number>(0);
  const audioStartedRef = useRef<boolean>(false);
  const midiInputsRef = useRef<CustomMIDIInput[]>([]);
  const midiHandlerRef = useRef<(event: CustomMIDIMessageEvent) => void>();
  const midiListenersRef = useRef<Map<string, (e: any) => void>>(new Map());
  const playerLoadPromisesRef = useRef<Map<string, Promise<void>>>(new Map());

  // Initialize Web MIDI API
  useEffect(() => {
    const initMidi = async () => {
      console.log('🎹 Initializing MIDI...');
      try {
        const midiAccess = await navigator.requestMIDIAccess();
        const inputs: CustomMIDIInput[] = [];
        midiAccess.inputs.forEach((input) => {
          inputs.push(input as unknown as CustomMIDIInput);
        });
        setMidiDevices(inputs);

        // Set up MIDI event listeners using addEventListener so we don't clobber other handlers
        midiInputsRef.current = inputs;
        inputs.forEach(input => {
          try {
            const handler = (e: any) => midiHandlerRef.current?.(e as CustomMIDIMessageEvent);
            midiListenersRef.current.set(input.id, handler);
            // Prefer addEventListener to allow multiple listeners per device
            input.addEventListener?.('midimessage', handler);
            // Ensure legacy handler is cleared to avoid double-calls
            input.onmidimessage = null as any;
          } catch (err) {
            console.warn('Failed to attach MIDI listener', { input, err });
          }
        });

        if (inputs.length > 0) {
          toast({
            title: "MIDI Ready",
            description: `Connected to ${inputs.length} MIDI device(s)`,
          });
        }
      } catch (error) {
        console.error('MIDI initialization failed:', error);
        toast({
          title: "MIDI Unavailable",
          description: "Web MIDI API not supported or no devices found",
          variant: "destructive",
        });
      }
    };

    if (isEnabled) {
      initMidi();
    }
  }, [isEnabled, toast]);

  // Optimize Tone.js for low latency once on mount
  useEffect(() => {
    try {
      const ctx: any = Tone.getContext?.() ?? (Tone as any).context;
      if (ctx) {
        if (typeof ctx.lookAhead !== 'undefined') ctx.lookAhead = 0;
        if (typeof ctx.latencyHint !== 'undefined') ctx.latencyHint = 'interactive';
      }
    } catch (e) {
      console.warn('Could not configure Tone.js latency settings', e);
    }
  }, []);

  // Load audio player for selected clip
  useEffect(() => {
    const loadPlayer = async () => {
      if (!selectedClip) return;

      try {
        // Clear existing player for this clip
        const existingPlayer = playersRef.current.get(selectedClip.id);
        if (existingPlayer) {
          existingPlayer.dispose();
        }

        // Create new player with polyphony support
        const player = new Tone.Player({
          url: selectedClip.originalTrack.file_url,
          loop: false,
          autostart: false,
        }).toDestination();

        // Wait for THIS player's buffer to load
        const loadPromise = new Promise<void>((resolve, reject) => {
          try {
            (player as any).onload = () => resolve();
            (player as any).onerror = (e: any) => reject(e);
          } catch {
            // Fallback to global Tone loader
            Tone.loaded().then(() => resolve()).catch(reject);
          }
        });

        playerLoadPromisesRef.current.set(selectedClip.id, loadPromise);
        await loadPromise;

        playersRef.current.set(selectedClip.id, player);
      } catch (error) {
        console.error('Failed to load audio for MIDI playback:', error);
        toast({
          title: "Audio Load Error",
          description: "Failed to load clip for MIDI playback",
          variant: "destructive",
        });
      }
    };

    loadPlayer();

    return () => {
      // Cleanup players on unmount
      playersRef.current.forEach(player => player.dispose());
      playersRef.current.clear();
    };
  }, [selectedClip, toast]);

  // Convert MIDI note to pitch shift ratio
  const noteToPitchShift = useCallback((noteNumber: number): number => {
    // Use C4 (60) as reference note (no pitch shift)
    const referencNote = 60;
    const semitones = noteNumber - referencNote;
    return Math.pow(2, semitones / 12);
  }, []);

  // Convert MIDI velocity to gain (0-127 to 0-1)
  const velocityToGain = useCallback((velocity: number): number => {
    return Math.max(0.1, velocity / 127); // Minimum gain of 0.1
  }, []);

  // Handle MIDI message
  const handleMidiMessage = useCallback((event: CustomMIDIMessageEvent) => {
    if (!selectedClip || !isEnabled) return;

    const [status, noteNumber, velocity] = event.data as unknown as number[];
    const messageType = status & 0xF0;
    const isNoteOn = messageType === 0x90 && velocity > 0;
    const isNoteOff = messageType === 0x80 || (messageType === 0x90 && velocity === 0);
    const isControlChange = messageType === 0xB0; // CC messages

    console.log('🎹 MIDI msg', { status, noteNumber, velocity, isNoteOn, isNoteOff, isControlChange, messageType: messageType.toString(16), ts: event.timeStamp });

    if (isNoteOn) {
      handleNoteOn(noteNumber, velocity);
    } else if (isNoteOff) {
      handleNoteOff(noteNumber);
    } else if (isControlChange && velocity > 0) {
      // Treat control change as a trigger (many MIDI controllers send CC instead of notes)
      // Map CC number to a note (offset by 60 to put it in a musical range)
      const mappedNote = Math.min(127, noteNumber + 60);
      console.log(`🎹 CC->Note: CC${noteNumber} (${velocity}) -> Note ${mappedNote}`);
      handleNoteOn(mappedNote, velocity);
    }
  }, [selectedClip, isEnabled]);

  // Keep latest MIDI handler to avoid stale closures
  useEffect(() => {
    midiHandlerRef.current = handleMidiMessage;
  }, [handleMidiMessage]);

  // Handle note on event
  const handleNoteOn = useCallback(async (noteNumber: number, velocity: number) => {
    if (!selectedClip) return;
    if (activeNotesRef.current.has(noteNumber)) return;

    try {
      if (!audioStartedRef.current) {
        try {
          await Tone.start();
          audioStartedRef.current = true;
        } catch (e) {
          console.warn('Tone.start() failed (user gesture may be required):', e);
        }
      }

      let basePlayer = playersRef.current.get(selectedClip.id);
      if (!basePlayer || !basePlayer.buffer) {
        const maybeLoad = playerLoadPromisesRef.current.get(selectedClip.id);
        if (maybeLoad) {
          console.log('⌛ Waiting for player buffer to load…');
          try {
            await maybeLoad;
          } catch (e) {
            console.error('Player load failed', e);
            return;
          }
          basePlayer = playersRef.current.get(selectedClip.id);
        }
      }
      if (!basePlayer || !basePlayer.buffer) {
        console.log(`❌ No base player/buffer for clip ${selectedClip.id} after load`);
        return;
      }

      // Create a gain node for immediate volume control (gate)
      const gainNode = new Tone.Gain(0).toDestination();

      // Create a new player instance using the already loaded buffer for ultra-low latency
      const polyphonyPlayer = new Tone.Player(basePlayer.buffer as any).connect(gainNode);
      polyphonyPlayer.loop = false;
      polyphonyPlayer.autostart = false;
      polyphonyPlayer.fadeIn = 0;
      polyphonyPlayer.fadeOut = 0;

      // Apply pitch shift and gain
      const pitchShift = noteToPitchShift(noteNumber);
      const gain = velocityToGain(velocity);
      polyphonyPlayer.playbackRate = pitchShift;

      // Start playback precisely now and ramp gain up quickly
      const now = Tone.now();
      polyphonyPlayer.start(now);
      gainNode.gain.setValueAtTime(0, now);
      gainNode.gain.linearRampToValueAtTime(gain, now + 0.01);

      // Track active note
      const activeNote: ActiveNote = {
        noteNumber,
        player: polyphonyPlayer,
        gainNode,
        startTime: Date.now()
      };
      activeNotesRef.current.set(noteNumber, activeNote);
      setActiveNotes(new Map(activeNotesRef.current));

      // Record MIDI event if recording
      if (isRecording) {
        const midiNote: MidiNote = {
          id: `note_${Date.now()}_${noteNumber}`,
          noteNumber,
          velocity,
          timestamp: Date.now() - recordingStartTimeRef.current,
          clipId: selectedClip.id
        };
        setRecordedNotes(prev => [...prev, midiNote]);
      }

      // Callback for visual feedback
      onNoteTriggered?.(noteNumber, velocity);
    } catch (error) {
      console.error('Error triggering note:', error);
    }
  }, [selectedClip, isRecording, noteToPitchShift, velocityToGain, onNoteTriggered]);

  // Handle note off event
  const handleNoteOff = useCallback((noteNumber: number) => {
    const activeNote = activeNotesRef.current.get(noteNumber);
    if (!activeNote) {
      console.log(`❌ No active note found for ${noteNumber}`);
      return;
    }

    try {
      const now = Tone.now();
      activeNote.gainNode.gain.setValueAtTime(activeNote.gainNode.gain.value, now);
      activeNote.gainNode.gain.linearRampToValueAtTime(0, now + 0.005);

      setTimeout(() => {
        try {
          activeNote.player.stop();
          activeNote.player.dispose();
          activeNote.gainNode.dispose();
        } catch (error) {
          console.error(`❌ Error cleaning up note ${noteNumber}:`, error);
        }
      }, 10);
    } catch (error) {
      console.error(`❌ Error applying gate OFF for note ${noteNumber}:`, error);
    }

    // Update recorded note duration if recording
    if (isRecording) {
      const duration = Date.now() - recordingStartTimeRef.current - (recordedNotes.find(note => 
        note.noteNumber === noteNumber && !note.duration
      )?.timestamp || 0);

      setRecordedNotes(prev => 
        prev.map(note => 
          note.noteNumber === noteNumber && !note.duration
            ? { ...note, duration }
            : note
        )
      );
    }

    // Remove from active notes (ref + state for UI)
    activeNotesRef.current.delete(noteNumber);
    setActiveNotes(new Map(activeNotesRef.current));
  }, [isRecording, recordedNotes]);

  // Start MIDI recording
  const startRecording = useCallback(async () => {
    try {
      setIsRecording(true);
      setRecordedNotes([]);
      recordingStartTimeRef.current = Date.now();
      onRecordingStateChange?.(true);

      // Start MediaRecorder for audio capture
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      mediaRecorderRef.current = new MediaRecorder(stream, {
        mimeType: 'audio/webm;codecs=opus'
      });

      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorderRef.current.start(100); // Collect data every 100ms

      toast({
        title: "Recording Started",
        description: "MIDI events and audio are being recorded",
      });

    } catch (error) {
      console.error('Failed to start recording:', error);
      toast({
        title: "Recording Error",
        description: "Failed to start recording",
        variant: "destructive",
      });
    }
  }, [onRecordingStateChange, toast]);

  // Stop MIDI recording
  const stopRecording = useCallback(() => {
    setIsRecording(false);
    onRecordingStateChange?.(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
    }

    // Create undo action for recorded notes
    const notesToRecord = [...recordedNotes];
    undoManager.push({
      type: 'RECORD_MIDI',
      payload: {
        notes: notesToRecord,
        clipId: selectedClip?.id || ''
      },
      undo: () => {
        setRecordedNotes(prev => prev.filter(note => 
          !notesToRecord.some(recorded => recorded.id === note.id)
        ));
      },
      description: `Record ${notesToRecord.length} MIDI notes`
    });

    toast({
      title: "Recording Stopped",
      description: `Recorded ${recordedNotes.length} MIDI notes`,
    });
  }, [recordedNotes, selectedClip, onRecordingStateChange, toast]);

  // Undo last recorded note
  const undoLastNote = useCallback(() => {
    if (recordedNotes.length === 0) return;

    const lastNote = recordedNotes[recordedNotes.length - 1];
    
    undoManager.push({
      type: 'REMOVE_MIDI_NOTE',
      payload: {
        note: lastNote,
        clipId: selectedClip?.id || ''
      },
      undo: () => {
        setRecordedNotes(prev => [...prev, lastNote]);
      },
      description: `Remove MIDI note ${lastNote.noteNumber}`
    });

    setRecordedNotes(prev => prev.slice(0, -1));
  }, [recordedNotes, selectedClip]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      // Stop all active notes
      activeNotes.forEach(note => {
        try {
          if ((note as any).gainNode) {
            const gn = (note as any).gainNode as Tone.Gain;
            try { gn.gain.setValueAtTime(0, Tone.now()); } catch {}
            try { gn.dispose(); } catch {}
          }
          if ((note as any).player) {
            try { (note as any).player.stop(); } catch {}
            try { (note as any).player.dispose(); } catch {}
          }
        } catch (e) {
          console.error('Cleanup error for active note:', e);
        }
      });

      // Detach MIDI listeners
      try {
        midiInputsRef.current.forEach((input) => {
          const handler = midiListenersRef.current.get(input.id);
          if (handler && input.removeEventListener) {
            input.removeEventListener('midimessage', handler);
          }
          input.onmidimessage = null as any;
        });
      } catch (e) {
        console.warn('Failed to detach MIDI listeners', e);
      }
      midiListenersRef.current.clear();

      // Stop recording if active
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream.getTracks().forEach(track => track.stop());
      }

      // Dispose all players
      playersRef.current.forEach(player => player.dispose());
      playersRef.current.clear();
    };
  }, [activeNotes]);

  if (!isEnabled) {
    console.log('🎹 TrackMidiController disabled');
    return null;
  }

  if (midiDevices.length === 0) {
    console.log('🎹 No MIDI devices found');
  }

  return (
    <div className={`midi-controller fixed top-4 right-4 z-50 ${className}`}>
      {/* Debug info */}
      <div className="bg-black/80 text-white p-2 rounded text-xs">
        <div>MIDI Controller</div>
        <div>Devices: {midiDevices.length}</div>
        <div>Selected: {selectedClip ? selectedClip.originalTrack.name : 'None'}</div>
        <div>Active Notes: {activeNotes.size}</div>
      </div>
      
      {/* Visual feedback for active notes */}
      {activeNotes.size > 0 && (
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-400 to-purple-400 opacity-80 animate-pulse" />
      )}
      
      {/* Recording indicator */}
      {isRecording && (
        <div className="absolute top-2 right-2 w-3 h-3 bg-red-500 rounded-full animate-pulse" />
      )}

      {/* Hidden controls for programmatic access */}
      <div className="hidden">
        <button onClick={startRecording} data-testid="start-recording" />
        <button onClick={stopRecording} data-testid="stop-recording" />
        <button onClick={undoLastNote} data-testid="undo-note" />
      </div>
    </div>
  );
};

export default TrackMidiController;