import React, { useEffect, useRef, useCallback } from 'react';
import { sessionLoopEngine, Clip } from '@/lib/sessionLoopEngine';

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

interface AudioBridgeProps {
  tracks: Track[];
  bpm: number;
  isPlaying: boolean;
  onTick: (seconds: number) => void;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
}

export const AudioBridge: React.FC<AudioBridgeProps> = ({
  tracks,
  bpm,
  isPlaying,
  onTick,
  onPlayPause,
  onSeek
}) => {
  const previousBPM = useRef<number>(bpm);
  const previousTracks = useRef<Track[]>([]);
  const isInitialized = useRef<boolean>(false);

  // Convert tracks to clips
  const createClipsFromTracks = useCallback((tracks: Track[], currentBPM: number): Clip[] => {
    const secondsPerBeat = 60 / currentBPM;
    const secondsPerBar = secondsPerBeat * 4;

    return tracks.map(track => {
      // Calculate duration in beats based on track data
      const knownDuration = track.analyzed_duration || track.duration;
      let durationInBeats: number;
      
      if (track.bars) {
        durationInBeats = track.bars * 4; // bars * 4 beats per bar
      } else if (knownDuration && knownDuration > 0) {
        const estimatedBars = Math.max(1, Math.round(knownDuration / secondsPerBar));
        durationInBeats = estimatedBars * 4;
      } else {
        durationInBeats = 16; // Default 4 bars
      }

      return {
        id: track.id,
        url: track.file_url,
        offsetInBeats: 0, // All tracks start at the beginning for now
        durationInBeats,
        gain: track.volume || 1,
        muted: track.isMuted || false
      };
    });
  }, []);

  // Initialize engine and set up tick callback
  useEffect(() => {
    const initEngine = async () => {
      try {
        await sessionLoopEngine.initialize();
        sessionLoopEngine.onTick = onTick;
        isInitialized.current = true;
        console.log('AudioBridge: Engine initialized');
      } catch (error) {
        console.error('AudioBridge: Failed to initialize engine:', error);
      }
    };

    initEngine();

    return () => {
      sessionLoopEngine.dispose();
    };
  }, [onTick]);

  // Handle BPM changes
  useEffect(() => {
    if (isInitialized.current && bpm !== previousBPM.current) {
      console.log(`AudioBridge: BPM changed from ${previousBPM.current} to ${bpm}`);
      sessionLoopEngine.setBpm(bpm);
      previousBPM.current = bpm;
      
      // Recreate clips with new BPM timing
      if (tracks.length > 0) {
        const clips = createClipsFromTracks(tracks, bpm);
        sessionLoopEngine.setClips(clips);
      }
    }
  }, [bpm, tracks, createClipsFromTracks]);

  // Handle track changes
  useEffect(() => {
    if (!isInitialized.current) return;

    const tracksChanged = 
      tracks.length !== previousTracks.current.length ||
      tracks.some((track, index) => {
        const prevTrack = previousTracks.current[index];
        return !prevTrack || 
               track.id !== prevTrack.id || 
               track.file_url !== prevTrack.file_url ||
               track.volume !== prevTrack.volume ||
               track.isMuted !== prevTrack.isMuted;
      });

    if (tracksChanged) {
      console.log('AudioBridge: Tracks changed, updating clips');
      const clips = createClipsFromTracks(tracks, bpm);
      sessionLoopEngine.setClips(clips);
      previousTracks.current = [...tracks];
    }
  }, [tracks, bpm, createClipsFromTracks]);

  // Handle track property updates (volume, mute, solo)
  useEffect(() => {
    if (!isInitialized.current) return;

    tracks.forEach(track => {
      // Handle solo logic: if any track is solo, mute all non-solo tracks
      const hasSoloTracks = tracks.some(t => t.isSolo);
      let shouldMute = track.isMuted || false;
      
      if (hasSoloTracks) {
        shouldMute = !track.isSolo;
      }

      sessionLoopEngine.muteClip(track.id, shouldMute);
      sessionLoopEngine.updateClipGain(track.id, track.volume || 1);
    });
  }, [tracks]);

  // Handle playback state changes
  useEffect(() => {
    if (!isInitialized.current) return;

    if (isPlaying && !sessionLoopEngine.isPlaying) {
      sessionLoopEngine.start();
    } else if (!isPlaying && sessionLoopEngine.isPlaying) {
      sessionLoopEngine.stop();
    }
  }, [isPlaying]);

  // Provide seek functionality
  const handleSeek = useCallback((seconds: number) => {
    if (isInitialized.current) {
      sessionLoopEngine.seek(seconds);
    }
  }, []);

  // Handle seeking when requested externally
  useEffect(() => {
    // The onSeek prop is used to notify parent of position changes
    // Actual seeking is handled by our handleSeek function
  }, [handleSeek, onSeek]);

  // AudioBridge is a logic-only component, no UI
  return null;
};