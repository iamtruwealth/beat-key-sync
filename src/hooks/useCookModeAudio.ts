/**
 * React Hook for Cook Mode Audio Engine
 * Provides easy integration with React components
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';
import { 
  CookModeAudioEngine, 
  AudioTrack, 
  MidiDevice, 
  MidiEvent,
  RecordedNote 
} from '@/lib/cookModeAudioEngine';

// Share a single engine instance across the app to avoid duplicate MIDI handlers
let sharedEngine: CookModeAudioEngine | null = null;

export interface UseCookModeAudioReturn {
  // Audio Engine
  engine: CookModeAudioEngine | null;
  audioContext: AudioContext | null;
  masterDestination: AudioNode | null;
  
  // State
  tracks: AudioTrack[];
  midiDevices: MidiDevice[];
  isRecording: boolean;
  isInitialized: boolean;
  
  // Actions
  createTrack: (name: string) => string;
  loadSample: (trackId: string, file: File) => Promise<void>;
  triggerSample: (trackId: string, note?: number, velocity?: number) => void;
  setActiveTrack: (trackId: string) => void;
  startRecording: () => void;
  stopRecording: () => void;
  startAudioRecording: (trackId: string) => Promise<void>;
  stopAudioRecording: (sessionId?: string) => Promise<{ blob: Blob; metadata: any } | null>;
  playbackRecording: () => void;
  recordAudioInput: (trackId: string, durationMs?: number) => Promise<Blob>;
  setTrackTrim: (trackId: string, trimStart: number, trimEnd: number) => void;
  
  // MIDI
  hasMidiDevices: boolean;
  lastMidiEvent: MidiEvent | null;
  
  // Utility
  isAudioRecordingSupported: boolean;
}

export function useCookModeAudio(isHost: boolean = true): UseCookModeAudioReturn {
  const { toast } = useToast();
  const engineRef = useRef<CookModeAudioEngine | null>(null);
  
  // State
  const [tracks, setTracks] = useState<AudioTrack[]>([]);
  const [midiDevices, setMidiDevices] = useState<MidiDevice[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const [lastMidiEvent, setLastMidiEvent] = useState<MidiEvent | null>(null);

  // Initialize audio engine (only for host)
  useEffect(() => {
    if (!isHost) {
      setIsInitialized(true); // Viewers don't need the engine
      return;
    }

    const initializeEngine = async () => {
      try {
        console.log('🎵 Initializing Cook Mode Audio Engine from hook (HOST)...');
        
        const engine = sharedEngine ?? new CookModeAudioEngine();
        if (!sharedEngine) sharedEngine = engine;
        engineRef.current = engine;

        // Set up callbacks
        engine.setCallbacks({
          onMidiDeviceChange: (devices) => {
            console.log(`🎹 MIDI devices updated: ${devices.length} devices`);
            setMidiDevices(devices);
            
            // Show toast if no devices
            if (devices.length === 0) {
              toast({
                title: "No MIDI Controllers",
                description: "Connect a MIDI controller to trigger samples with velocity",
                variant: "default",
              });
            } else {
              toast({
                title: "MIDI Controller Connected",
                description: `${devices.length} MIDI device(s) detected`,
                variant: "default",
              });
            }
          },
          
          onNoteEvent: (event) => {
            console.log(`🎹 MIDI Note Event: ${event.type} - Note ${event.note}, Velocity ${event.velocity}`);
            setLastMidiEvent(event);
          },
          
          onTrackUpdate: (updatedTracks) => {
            console.log(`🎵 Tracks updated: ${updatedTracks.length} tracks`);
            setTracks(updatedTracks);
          },
          
          onRecordingStateChange: (recording) => {
            console.log(`🔴 Recording state changed: ${recording}`);
            setIsRecording(recording);
          }
        });

        setIsInitialized(true);
        console.log('✅ Cook Mode Audio Engine initialized from hook');
        
      } catch (error) {
        console.error('❌ Failed to initialize audio engine:', error);
        toast({
          title: "Audio Engine Error",
          description: "Failed to initialize audio engine. Check console for details.",
          variant: "destructive",
        });
      }
    };

    initializeEngine();

    // Cleanup on unmount
    return () => {
      if (engineRef.current) {
        engineRef.current.dispose();
        engineRef.current = null;
      }
    };
  }, [toast, isHost]);

  // Create a new track
  const createTrack = useCallback((name: string): string => {
    if (!engineRef.current) {
      console.warn('⚠️ Audio engine not initialized');
      return '';
    }

    const trackId = `track-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    engineRef.current.createTrack(trackId, name);
    
    toast({
      title: "Track Created",
      description: `Created track: ${name}`,
    });

    return trackId;
  }, [toast]);

  // Load sample for track
  const loadSample = useCallback(async (trackId: string, file: File): Promise<void> => {
    if (!engineRef.current) {
      throw new Error('Audio engine not initialized');
    }

    try {
      await engineRef.current.loadSample(trackId, file);
      
      toast({
        title: "Sample Loaded",
        description: `Loaded ${file.name}`,
      });
      
    } catch (error) {
      console.error('❌ Failed to load sample:', error);
      toast({
        title: "Sample Load Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  // Trigger sample
  const triggerSample = useCallback((trackId: string, note: number = 60, velocity: number = 127): void => {
    if (!engineRef.current) {
      console.warn('⚠️ Audio engine not initialized');
      return;
    }

    engineRef.current.triggerSample(trackId, note, velocity);
  }, []);

  const setTrackTrim = useCallback((trackId: string, trimStart: number, trimEnd: number): void => {
    if (!engineRef.current) return;
    engineRef.current.setTrackTrim(trackId, trimStart, trimEnd);
  }, []);

  const setActiveTrack = useCallback((trackId: string): void => {
    if (!engineRef.current) {
      console.warn('⚠️ Audio engine not initialized');
      return;
    }
    engineRef.current.setActiveTrack(trackId);
  }, []);

  // Start recording
  const startRecording = useCallback((): void => {
    if (!engineRef.current) {
      console.warn('⚠️ Audio engine not initialized');
      return;
    }

    engineRef.current.startRecording();
    
    toast({
      title: "Recording Started",
      description: "MIDI notes will be recorded. Play your controller!",
    });
  }, [toast]);

  // Stop recording
  const stopRecording = useCallback((): void => {
    if (!engineRef.current) {
      console.warn('⚠️ Audio engine not initialized');
      return;
    }

    engineRef.current.stopRecording();
    
    toast({
      title: "Recording Stopped",
      description: "You can now playback your recorded performance",
    });
  }, [toast]);

  // Playback recording
  const playbackRecording = useCallback((): void => {
    if (!engineRef.current) {
      console.warn('⚠️ Audio engine not initialized');
      return;
    }

    engineRef.current.playbackRecording();
    
    toast({
      title: "Playback Started",
      description: "Playing back your recorded performance",
    });
  }, [toast]);

  // Record audio input
  const recordAudioInput = useCallback(async (trackId: string, durationMs: number = 10000): Promise<Blob> => {
    if (!engineRef.current) {
      throw new Error('Audio engine not initialized');
    }

    try {
      toast({
        title: "Audio Recording Started",
        description: `Recording ${durationMs / 1000} seconds of audio input...`,
      });

      const audioBlob = await engineRef.current.recordAudioInput(trackId, durationMs);
      
      toast({
        title: "Audio Recording Complete",
        description: "Audio has been recorded and added to the track",
      });

      return audioBlob;
      
    } catch (error) {
      console.error('❌ Failed to record audio input:', error);
      toast({
        title: "Audio Recording Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
      throw error;
    }
  }, [toast]);

  // Start continuous audio recording
  const startAudioRecording = useCallback(async (trackId: string): Promise<void> => {
    if (!engineRef.current) {
      throw new Error('Audio engine not initialized');
    }

    try {
      // Request microphone access - this will trigger browser permission dialog
      console.log('🎙️ Requesting microphone permission...');
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      console.log('✅ Microphone access granted');
      
      // Pass the stream to the engine to start recording
      await engineRef.current.startAudioRecording(trackId, stream);
      setIsRecording(true);
      
      toast({
        title: "Recording Started",
        description: "Recording from your microphone. Click stop when done.",
      });
      
    } catch (error) {
      console.error('❌ Failed to start audio recording:', error);
      
      if (error instanceof DOMException && error.name === 'NotAllowedError') {
        toast({
          title: "Microphone Access Denied",
          description: "Please allow microphone access in your browser settings",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Recording Failed",
          description: error instanceof Error ? error.message : 'Unknown error',
          variant: "destructive",
        });
      }
      throw error;
    }
  }, [toast]);

  // Stop continuous audio recording
  const stopAudioRecording = useCallback(async (sessionId?: string): Promise<{ blob: Blob; metadata: any } | null> => {
    if (!engineRef.current) {
      throw new Error('Audio engine not initialized');
    }

    try {
      const audioBlob = await engineRef.current.stopAudioRecording();
      setIsRecording(false);
      
      if (!audioBlob) return null;
      
      // Get track info for metadata
      const recordingTrackId = (engineRef.current as any).recordingTrackId;
      const track = tracks.find(t => t.id === recordingTrackId);
      
      toast({
        title: "Recording Complete",
        description: "Your recording is ready and will be saved.",
      });

      return {
        blob: audioBlob,
        metadata: {
          trackId: track?.id,
          trackName: track?.name,
          duration: audioBlob.size / 44100 / 2 / 2, // rough estimate
          sampleRate: 44100,
          format: 'audio/webm'
        }
      };
      
    } catch (error) {
      console.error('❌ Failed to stop audio recording:', error);
      setIsRecording(false);
      toast({
        title: "Recording Failed",
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: "destructive",
      });
      throw error;
    }
  }, [toast, tracks]);

  // Computed properties
  const hasMidiDevices = midiDevices.some(device => device.connected);
  const isAudioRecordingSupported = engineRef.current?.isAudioRecordingSupported() ?? false;

  return {
    engine: engineRef.current,
    audioContext: engineRef.current?.getAudioContext() ?? null,
    masterDestination: engineRef.current?.getMasterDestination() ?? null,
    tracks,
    midiDevices,
    isRecording,
    isInitialized,
    createTrack,
    loadSample,
    triggerSample,
    setActiveTrack,
    startRecording,
    stopRecording,
    startAudioRecording,
    stopAudioRecording,
    playbackRecording,
    recordAudioInput,
    setTrackTrim,
    hasMidiDevices,
    lastMidiEvent,
    isAudioRecordingSupported,
  };
}