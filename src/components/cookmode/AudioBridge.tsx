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

interface TimelineClip {
  id: string;
  startTime: number; // seconds on timeline
  endTime: number;   // seconds on timeline (container width)
  fullDuration?: number; // total length of source audio in seconds
  trimStart?: number; // seconds offset within source
  trimEnd?: number;   // seconds offset within source
  originalTrack: Track;
}

interface AudioBridgeProps {
  tracks: Track[];
  clips?: TimelineClip[];
  bpm: number;
  isPlaying: boolean;
  currentTime: number;
  minBars?: number;
  onTick: (seconds: number) => void;
  onPlayPause: () => void;
  onSeek: (seconds: number) => void;
}

export const AudioBridge: React.FC<AudioBridgeProps> = ({
  tracks,
  clips,
  bpm,
  isPlaying,
  currentTime,
  minBars = 8,
  onTick,
  onPlayPause,
  onSeek
}) => {
  const previousBPM = useRef<number>(bpm);
  const previousTracks = useRef<Track[]>([]);
  const isInitialized = useRef<boolean>(false);
  const lastTickRef = useRef<number>(0);

  // Convert tracks to clips
  const createClipsFromTracks = useCallback((tracks: Track[], currentBPM: number): Clip[] => {
    const secondsPerBeat = 60 / currentBPM;
    const secondsPerBar = secondsPerBeat * 4;

    return tracks.map(track => {
      // Calculate duration in beats based on track data
      const knownDuration = track.analyzed_duration || track.duration;
      let durationInBeats: number;
      
      console.log(`Creating clip for track: ${track.name} Bars: ${track.bars} Duration: ${knownDuration} Known duration: ${track.duration}`);
      
      if (track.bars) {
        durationInBeats = track.bars * 4; // bars * 4 beats per bar
      } else if (knownDuration && knownDuration > 0) {
        // Use precise calculation: duration in seconds / seconds per beat
        durationInBeats = knownDuration / secondsPerBeat;
        console.log(`Calculated duration for ${track.name}: ${knownDuration}s = ${durationInBeats} beats = ${durationInBeats/4} bars`);
      } else {
        // Default to 4 bars (16 beats) when duration is unknown
        durationInBeats = 16; // 4 bars * 4 beats per bar
      }

      const clip = {
        id: track.id,
        url: track.file_url,
        offsetInBeats: 0, // All tracks start at the beginning for now
        durationInBeats,
        gain: track.volume || 1,
        muted: track.isMuted || false
      };
      
      console.log(`Clip:`, clip);
      return clip;
    });
  }, []);

  // Convert timeline clips (with seconds) to engine clips (beats)
  const createClipsFromTimeline = useCallback((timelineClips: TimelineClip[], currentBPM: number): Clip[] => {
    const secondsPerBeat = 60 / currentBPM;
    return timelineClips.map(tc => {
      const durationSecContainer = Math.max(0.1, tc.endTime - tc.startTime);
      const offsetInBeats = Math.round((tc.startTime / secondsPerBeat) * 1000) / 1000;
      const durationInBeats = Math.max(0.25, Math.round((durationSecContainer / secondsPerBeat) * 1000) / 1000);
      const track = tc.originalTrack;

      // Source trimming values from clip (fallback to full track duration)
      const sourceTotal = tc.fullDuration ?? track.analyzed_duration ?? track.duration ?? durationSecContainer;
      const sourceStart = Math.max(0, tc.trimStart ?? 0);
      const sourceEnd = Math.min(sourceTotal, tc.trimEnd ?? sourceTotal);
      const sourceDuration = Math.max(0.05, sourceEnd - sourceStart);

      return {
        id: tc.id,
        url: track.file_url,
        offsetInBeats,
        durationInBeats,
        gain: track.volume || 1,
        muted: track.isMuted || false,
        sourceOffsetSeconds: sourceStart,
        sourceDurationSeconds: sourceDuration,
      } as Clip;
    });
  }, []);

  // Initialize engine once
  useEffect(() => {
    const initEngine = async () => {
      try {
        await sessionLoopEngine.initialize();
        // Set initial BPM and clips
        sessionLoopEngine.setBpm(bpm);
        if (Array.isArray(clips) && clips.length > 0) {
          const engineClips = createClipsFromTimeline(clips, bpm);
          console.log('AudioBridge: Initial timeline clips:', engineClips);
          await sessionLoopEngine.setClips(engineClips, minBars);
        } else if (tracks.length > 0) {
          const engineClips = createClipsFromTracks(tracks, bpm);
          console.log('AudioBridge: Initial track clips:', engineClips);
          await sessionLoopEngine.setClips(engineClips, minBars);
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
    if (isInitialized.current && bpm !== previousBPM.current) {
      console.log(`AudioBridge: BPM changed from ${previousBPM.current} to ${bpm}`);
      sessionLoopEngine.setBpm(bpm);
      previousBPM.current = bpm;
      
      // Recreate clips with new BPM timing
      if (Array.isArray(clips) && clips.length > 0) {
        const engineClips = createClipsFromTimeline(clips, bpm);
        sessionLoopEngine.setClips(engineClips, minBars);
      } else if (tracks.length > 0) {
        const engineClips = createClipsFromTracks(tracks, bpm);
        sessionLoopEngine.setClips(engineClips, minBars);
      }
    }
  }, [bpm, tracks, clips, createClipsFromTracks, createClipsFromTimeline]);

  // Handle track changes (when not using timeline clips)
  useEffect(() => {
    if (!isInitialized.current) return;
    if (Array.isArray(clips) && clips.length > 0) return;

    const tracksChanged = 
      tracks.length !== previousTracks.current.length ||
      tracks.some((track, index) => {
        const prevTrack = previousTracks.current[index];
        return !prevTrack || 
               track.id !== prevTrack.id || 
               track.file_url !== prevTrack.file_url ||
               track.volume !== prevTrack.volume ||
               track.isMuted !== prevTrack.isMuted ||
               track.bars !== prevTrack.bars ||
               (track.analyzed_duration || 0) !== (prevTrack.analyzed_duration || 0) ||
               (track.duration || 0) !== (prevTrack.duration || 0);
      });

    if (tracksChanged) {
      console.log('AudioBridge: Tracks changed, updating clips');
      const engineClips = createClipsFromTracks(tracks, bpm);
      console.log('AudioBridge: Created clips from tracks:', engineClips);
      sessionLoopEngine.setClips(engineClips, minBars);
      previousTracks.current = [...tracks];
    }
  }, [tracks, bpm, clips, createClipsFromTracks]);

  // Handle timeline clip changes
  useEffect(() => {
    if (!isInitialized.current) return;
    if (Array.isArray(clips) && clips.length > 0) {
      const engineClips = createClipsFromTimeline(clips, bpm);
      console.log('AudioBridge: Timeline clips changed, updating engine clips', engineClips.map(c => ({ id: c.id, offsetInBeats: c.offsetInBeats, durationInBeats: c.durationInBeats, sourceOffsetSeconds: (c as any).sourceOffsetSeconds, sourceDurationSeconds: (c as any).sourceDurationSeconds })));
      sessionLoopEngine.setClips(engineClips, minBars);
    }
  }, [clips, bpm, createClipsFromTimeline, minBars]);

  // Apply new minimum bar count to loop length (works for both timeline and tracks-only modes)
  useEffect(() => {
    if (!isInitialized.current) return;
    if (Array.isArray(clips) && clips.length > 0) {
      const engineClips = createClipsFromTimeline(clips, bpm);
      sessionLoopEngine.setClips(engineClips, minBars);
    } else {
      const engineClips = createClipsFromTracks(tracks, bpm);
      sessionLoopEngine.setClips(engineClips, minBars);
    }
  }, [minBars, bpm, clips, tracks, createClipsFromTimeline, createClipsFromTracks]);

  // Handle track property updates (volume, mute, solo)
  useEffect(() => {
    if (!isInitialized.current) return;

    if (Array.isArray(clips) && clips.length > 0) {
      // Update per-clip using associated track state
      const hasSoloTracks = tracks.some(t => t.isSolo);
      clips.forEach(tc => {
        const tr = tracks.find(t => t.id === tc.originalTrack.id);
        if (!tr) return;
        let shouldMute = tr.isMuted || false;
        if (hasSoloTracks) {
          shouldMute = !tr.isSolo;
        }
        sessionLoopEngine.muteClip(tc.id, shouldMute);
        sessionLoopEngine.updateClipGain(tc.id, tr.volume || 1);
      });
    } else {
      // Fallback: per-track behavior
      tracks.forEach(track => {
        const hasSoloTracks = tracks.some(t => t.isSolo);
        let shouldMute = track.isMuted || false;
        if (hasSoloTracks) {
          shouldMute = !track.isSolo;
        }
        sessionLoopEngine.muteClip(track.id, shouldMute);
        sessionLoopEngine.updateClipGain(track.id, track.volume || 1);
      });
    }
  }, [tracks, clips]);

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