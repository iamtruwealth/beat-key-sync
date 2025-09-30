/**
 * Cook Mode Integration Hook
 * Bridges the Cook Mode Audio Engine with existing waveform/clip system
 */

import { useEffect, useCallback } from 'react';
import { useCookModeAudio } from './useCookModeAudio';
import { useToast } from '@/hooks/use-toast';
import { useOptimizedAudioAnalysis } from '@/hooks/useOptimizedAudioAnalysis';

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

interface CookModeIntegrationProps {
  tracks: Track[];
  onAddTrack: (track: Track) => void;
  onUpdateTrack: (trackId: string, updates: Partial<Track>) => void;
  onRemoveTrack: (trackId: string) => void;
  canEdit?: boolean;
}

export function useCookModeIntegration({
  tracks: existingTracks,
  onAddTrack,
  onUpdateTrack,
  onRemoveTrack,
  canEdit = true
}: CookModeIntegrationProps) {
  const audioEngine = useCookModeAudio(canEdit);
  const { toast } = useToast();
  const { analyzeFile } = useOptimizedAudioAnalysis();

  // Sync audio engine tracks with existing track system
  useEffect(() => {
    if (!audioEngine.isInitialized) return;

    // Create audio tracks for existing tracks that don't have them
    existingTracks.forEach((track) => {
      const audioTrack = audioEngine.tracks.find(at => at.id === track.id);
      if (!audioTrack) {
        console.log(`🔄 Creating audio track for existing track: ${track.name}`);
        audioEngine.createTrack(track.name);
      }
    });

    // Remove audio tracks that no longer exist in the track system
    audioEngine.tracks.forEach((audioTrack) => {
      const existsInTrackSystem = existingTracks.some(t => t.id === audioTrack.id);
      if (!existsInTrackSystem) {
        console.log(`🗑️ Audio track ${audioTrack.name} no longer exists in track system`);
        // Note: We don't auto-remove here to avoid conflicts
      }
    });
  }, [existingTracks, audioEngine.tracks, audioEngine.isInitialized, audioEngine.createTrack]);

  // Handle sample loading and track creation
  const handleSampleLoaded = useCallback(async (trackId: string, file: File) => {
    // Check if this track exists in the main track system
    const existingTrack = existingTracks.find(t => t.id === trackId);
    
    if (!existingTrack) {
      // Create a new track in the main system
      const newTrack: Track = {
        id: trackId,
        name: file.name.replace(/\.[^/.]+$/, ''), // Remove file extension
        file_url: URL.createObjectURL(file),
        stem_type: 'sample',
        duration: 0, // Will be updated when audio loads
        volume: 1,
        isMuted: false,
        isSolo: false
      };

      console.log(`🎵 Adding new track to main system: ${newTrack.name}`);
      onAddTrack(newTrack);

      // Quick duration probe for immediate timeline extension
      try {
        const arrayBuffer = await file.arrayBuffer();
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const quickDuration = audioBuffer.duration;
        audioCtx.close?.();
        onUpdateTrack(trackId, { analyzed_duration: quickDuration, duration: quickDuration });
        console.log(`⏱️ Quick duration probe: ${quickDuration}s`);
      } catch (e) {
        console.warn('Quick duration probe failed:', e);
      }

      // Skip full analysis for CookMode - we only need duration for timeline
      // Full analysis with BPM/key can be done later if needed
      console.log(`⚡ Using quick duration analysis for CookMode: ${file.name}`);
      // The quick duration probe above already set the duration, so we're done!
    } else {
      // Update existing track with new sample
      const updates: Partial<Track> = {
        file_url: URL.createObjectURL(file),
        stem_type: 'sample'
      };

      console.log(`🔄 Updating existing track with new sample: ${existingTrack.name}`);
      onUpdateTrack(trackId, updates);

      // Quick duration probe for immediate update
      try {
        const arrayBuffer = await file.arrayBuffer();
        const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
        const audioCtx = new AudioCtx();
        const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        const quickDuration = audioBuffer.duration;
        audioCtx.close?.();
        onUpdateTrack(trackId, { ...updates, analyzed_duration: quickDuration, duration: quickDuration });
        console.log(`⏱️ Quick duration probe (update): ${quickDuration}s`);
      } catch (e) {
        console.warn('Quick duration probe (update) failed:', e);
      }

      // Skip full analysis for CookMode updates - we only need duration
      console.log(`⚡ Using quick duration analysis for updated track: ${file.name}`);
      // The quick duration probe above already updated the duration
    }
  }, [existingTracks, onAddTrack, onUpdateTrack, analyzeFile, toast]);

  // Handle recorded audio clips
  const handleAudioRecorded = useCallback((trackId: string, audioBlob: Blob) => {
    const existingTrack = existingTracks.find(t => t.id === trackId);
    
    if (existingTrack) {
      // Update track with recorded audio
      const audioUrl = URL.createObjectURL(audioBlob);
      const updates: Partial<Track> = {
        file_url: audioUrl,
        stem_type: 'recording'
      };

      console.log(`🎤 Adding recorded audio to track: ${existingTrack.name}`);
      onUpdateTrack(trackId, updates);
    }
  }, [existingTracks, onUpdateTrack]);

  // Sync volume and mute states
  const syncTrackStates = useCallback(() => {
    audioEngine.tracks.forEach((audioTrack) => {
      const existingTrack = existingTracks.find(t => t.id === audioTrack.id);
      if (existingTrack) {
        // Sync any differences
        if (existingTrack.volume !== audioTrack.volume) {
          onUpdateTrack(audioTrack.id, { volume: audioTrack.volume });
        }
        if (existingTrack.isMuted !== audioTrack.muted) {
          onUpdateTrack(audioTrack.id, { isMuted: audioTrack.muted });
        }
        if (existingTrack.isSolo !== audioTrack.solo) {
          onUpdateTrack(audioTrack.id, { isSolo: audioTrack.solo });
        }
      }
    });
  }, [audioEngine.tracks, existingTracks, onUpdateTrack]);

  // Sync on track updates
  useEffect(() => {
    syncTrackStates();
  }, [audioEngine.tracks, syncTrackStates]);

  // Enhanced createTrack that integrates with both systems
  const createIntegratedTrack = useCallback((name: string): string => {
    const trackId = audioEngine.createTrack(name);
    
    // Also create in main track system
    const newTrack: Track = {
      id: trackId,
      name,
      file_url: '',
      stem_type: 'empty',
      duration: 0,
      volume: 1,
      isMuted: false,
      isSolo: false
    };

    onAddTrack(newTrack);
    return trackId;
  }, [audioEngine.createTrack, onAddTrack]);

  // Enhanced loadSample that updates both systems
  const loadIntegratedSample = useCallback(async (trackId: string, file: File): Promise<void> => {
    try {
      await audioEngine.loadSample(trackId, file);
      handleSampleLoaded(trackId, file);
    } catch (error) {
      console.error('❌ Failed to load integrated sample:', error);
      throw error;
    }
  }, [audioEngine.loadSample, handleSampleLoaded]);

  // Enhanced recordAudioInput that updates both systems
  const recordIntegratedAudio = useCallback(async (trackId: string, durationMs?: number): Promise<Blob> => {
    try {
      const audioBlob = await audioEngine.recordAudioInput(trackId, durationMs);
      handleAudioRecorded(trackId, audioBlob);
      return audioBlob;
    } catch (error) {
      console.error('❌ Failed to record integrated audio:', error);
      throw error;
    }
  }, [audioEngine.recordAudioInput, handleAudioRecorded]);

  return {
    // Audio engine instance
    audioEngine,
    
    // Enhanced functions that work with both systems
    createTrack: createIntegratedTrack,
    loadSample: loadIntegratedSample,
    recordAudioInput: recordIntegratedAudio,
    
    // Direct access to audio engine functions
    triggerSample: audioEngine.triggerSample,
    startRecording: audioEngine.startRecording,
    stopRecording: audioEngine.stopRecording,
    playbackRecording: audioEngine.playbackRecording,
    
    // State
    isInitialized: audioEngine.isInitialized,
    isRecording: audioEngine.isRecording,
    midiDevices: audioEngine.midiDevices,
    hasMidiDevices: audioEngine.hasMidiDevices,
    lastMidiEvent: audioEngine.lastMidiEvent,
    
    // Utility
    isAudioRecordingSupported: audioEngine.isAudioRecordingSupported
  };
}