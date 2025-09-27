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
  currentTime: number;
  onTick: (seconds: number) => void;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
}

export const AudioBridge: React.FC<AudioBridgeProps> = ({
  tracks,
  bpm,
  isPlaying,
  currentTime,
  onTick,
  onPlayPause,
  onSeek
}) => {
  const previousBPM = useRef<number>(bpm);
  const previousTracks = useRef<Track[]>([]);
  const isInitialized = useRef<boolean>(false);
  const lastTickRef = useRef<number>(0);

  // Convert tracks to clips with proper duration detection
  const createClipsFromTracks = useCallback(async (tracks: Track[], currentBPM: number): Promise<Clip[]> => {
    const secondsPerBeat = 60 / currentBPM;
    const secondsPerBar = secondsPerBeat * 4;

    const clips: Clip[] = [];
    
    for (const track of tracks) {
      // Try to get actual audio duration first
      let actualDuration = track.analyzed_duration || track.duration;
      
      // If no duration available, try to load the audio to get duration
      if (!actualDuration || actualDuration <= 0) {
        try {
          const audio = new Audio();
          await new Promise<void>((resolve, reject) => {
            audio.onloadedmetadata = () => {
              actualDuration = audio.duration;
              console.log(`Detected duration for ${track.name}: ${actualDuration} seconds`);
              resolve();
            };
            audio.onerror = () => reject(new Error('Failed to load audio'));
            audio.src = track.file_url;
          });
        } catch (error) {
          console.warn(`Could not detect duration for ${track.name}:`, error);
        }
      }

      // Calculate duration in beats based on actual audio duration or track data
      let durationInBeats: number;
      
      if (track.bars) {
        durationInBeats = track.bars * 4; // bars * 4 beats per bar
      } else if (actualDuration && actualDuration > 0) {
        const estimatedBars = Math.max(1, Math.round(actualDuration / secondsPerBar));
        durationInBeats = estimatedBars * 4;
        console.log(`${track.name}: ${actualDuration}s = ${estimatedBars} bars = ${durationInBeats} beats`);
      } else {
        durationInBeats = 16; // Default 4 bars
      }

      clips.push({
        id: track.id,
        url: track.file_url,
        offsetInBeats: 0, // All tracks start at the beginning for now
        durationInBeats,
        gain: track.volume || 1,
        muted: track.isMuted || false
      });
    }
    
    return clips;
  }, []);

  // Initialize engine once
  useEffect(() => {
    const initEngine = async () => {
      try {
        await sessionLoopEngine.initialize();
        // Set initial BPM and clips
        sessionLoopEngine.setBpm(bpm);
        if (tracks.length > 0) {
          const clips = await createClipsFromTracks(tracks, bpm);
          console.log('AudioBridge: Initial clips:', clips);
          await sessionLoopEngine.setClips(clips);
          previousTracks.current = [...tracks];
        }
        isInitialized.current = true;
        console.log('AudioBridge: Engine initialized');
        // Start playback if requested
        if (isPlaying) {
          await sessionLoopEngine.start();
        }
      } catch (error) {
        console.error('AudioBridge: Failed to initialize engine:', error);
      }
    };

    initEngine();

    return () => {
      sessionLoopEngine.dispose();
    };
  }, []);

  // Keep tick handler updated without re-initializing the engine
  useEffect(() => {
    sessionLoopEngine.onTick = (seconds: number) => {
      lastTickRef.current = seconds;
      onTick(seconds);
    };
  }, [onTick]);

  // Handle BPM changes
  useEffect(() => {
    const updateBPM = async () => {
      if (isInitialized.current && bpm !== previousBPM.current) {
        console.log(`AudioBridge: BPM changed from ${previousBPM.current} to ${bpm}`);
        sessionLoopEngine.setBpm(bpm);
        previousBPM.current = bpm;
        
        // Recreate clips with new BPM timing
        if (tracks.length > 0) {
          const clips = await createClipsFromTracks(tracks, bpm);
          sessionLoopEngine.setClips(clips);
        }
      }
    };
    
    updateBPM();
  }, [bpm, tracks, createClipsFromTracks]);

  // Handle track changes
  useEffect(() => {
    const updateTracks = async () => {
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
        const clips = await createClipsFromTracks(tracks, bpm);
        console.log('AudioBridge: Created clips:', clips);
        sessionLoopEngine.setClips(clips);
        previousTracks.current = [...tracks];
      }
    };
    
    updateTracks();
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
      sessionLoopEngine.pause();
    }
  }, [isPlaying]);

  // Provide seek functionality
  const handleSeek = useCallback((seconds: number) => {
    if (isInitialized.current) {
      sessionLoopEngine.seek(seconds);
    }
  }, []);

  // Keep engine in sync with parent time
  useEffect(() => {
    if (!isInitialized.current) return;

    if (!isPlaying) {
      // Always sync when paused/stopped
      sessionLoopEngine.seek(currentTime);
      return;
    }

    // While playing, only seek when there's a large jump (manual seek/back/forward)
    const delta = Math.abs(currentTime - (lastTickRef.current ?? 0));
    if (delta > 0.25) {
      sessionLoopEngine.seek(currentTime);
    }
  }, [currentTime, isPlaying]);

  // AudioBridge is a logic-only component, no UI
  return null;
};