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
}

export function useCookModeIntegration({
  tracks: existingTracks,
  onAddTrack,
  onUpdateTrack,
  onRemoveTrack
}: CookModeIntegrationProps) {
  const audioEngine = useCookModeAudio();
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

      // Analyze the audio file to get duration and other metadata
      try {
        console.log(`🔍 Starting audio analysis for: ${file.name}`);
        const analysisResult = await analyzeFile(file);
        
        // Update track with analyzed duration
        const updates: Partial<Track> = {
          analyzed_duration: analysisResult.duration,
          duration: analysisResult.duration
        };
        
        console.log(`✅ Audio analysis complete for ${file.name}: ${analysisResult.duration}s`);
        onUpdateTrack(trackId, updates);
        
      } catch (error) {
        console.error('Audio analysis failed:', error);
        toast({
          title: "Analysis Warning",
          description: `Could not analyze ${file.name}. Using default duration.`,
          variant: "destructive"
        });
      }
    } else {
      // Update existing track with new sample
      const updates: Partial<Track> = {
        file_url: URL.createObjectURL(file),
        stem_type: 'sample'
      };

      console.log(`🔄 Updating existing track with new sample: ${existingTrack.name}`);
      onUpdateTrack(trackId, updates);

      // Also analyze the new file
      try {
        console.log(`🔍 Analyzing updated track: ${file.name}`);
        const analysisResult = await analyzeFile(file);
        
        const analysisUpdates: Partial<Track> = {
          ...updates,
          analyzed_duration: analysisResult.duration,
          duration: analysisResult.duration
        };
        
        console.log(`✅ Analysis complete for updated track ${file.name}: ${analysisResult.duration}s`);
        onUpdateTrack(trackId, analysisUpdates);
        
      } catch (error) {
        console.error('Audio analysis failed for updated track:', error);
        // Still apply the file update even if analysis fails
        onUpdateTrack(trackId, updates);
      }
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