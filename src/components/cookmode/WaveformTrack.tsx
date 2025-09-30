import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';
import { Copy, Circle, Trash2 } from 'lucide-react';

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
  trimStart?: number;
  trimEnd?: number;
}

interface AudioClip {
  id: string;
  trackId: string;
  startTime: number;
  endTime: number;
  fullDuration: number;
  trimStart: number;
  trimEnd: number;
  originalTrack: Track;
  isSelected?: boolean;
}

interface WaveformTrackProps {
  clip: AudioClip;
  containerId: string;
  currentTime: number;
  isPlaying: boolean;
  pixelsPerSecond: number;
  trackHeight: number;
  trackIndex: number; // New prop for index-based coloring
  onClipClick?: (clipId: string, event: React.MouseEvent) => void;
  onClipDoubleClick?: (clipId: string) => void;
  onDuplicateClip?: (clipId: string) => void;
  onDeleteClip?: (clipId: string) => void;
  className?: string;
  // New props for selection and record arming
  isSelected?: boolean;
  isRecordArmed?: boolean;
  onTrackSelect?: (trackId: string) => void;
  onRecordArmToggle?: (trackId: string, shiftKey: boolean) => void;
}

export const WaveformTrack: React.FC<WaveformTrackProps> = ({
  clip,
  containerId,
  currentTime,
  isPlaying,
  pixelsPerSecond,
  trackHeight,
  trackIndex,
  onClipClick,
  onClipDoubleClick,
  onDuplicateClip,
  onDeleteClip,
  className = "",
  isSelected = false,
  isRecordArmed = false,
  onTrackSelect,
  onRecordArmToggle
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const loadedUrlRef = useRef<string | null>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const loadingTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const track = clip.originalTrack;
  const clipDuration = clip.endTime - clip.startTime;
  const clipWidth = clipDuration * pixelsPerSecond;
  
  // Calculate visual properties
  const isMuted = track.isMuted || false;
  const opacity = isMuted ? 0.3 : 1;
  
  // Initialize WaveSurfer with better error handling and debouncing
  useEffect(() => {
    // Clear any pending timeout
    if (initTimeoutRef.current) {
      clearTimeout(initTimeoutRef.current);
    }

    // Skip if no valid file URL (empty tracks), already loaded for this URL, currently loading, or no container
    if (!containerRef.current || !track.file_url || track.file_url.trim() === '' || isLoading || loadedUrlRef.current === track.file_url) {
      return;
    }

    // Clean up existing instance before creating new one
    if (waveSurferRef.current) {
      waveSurferRef.current.destroy();
      waveSurferRef.current = null;
    }

    // Debounce initialization to prevent rapid re-creation
    initTimeoutRef.current = setTimeout(() => {
      if (!containerRef.current) return;

      try {
        console.log(`Loading WaveSurfer for track: ${track.name} (${track.file_url})`);
        setIsLoading(true);
        setError(null);

        // Start a safety timeout so the UI doesn't spin forever
        if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
        loadingTimeoutRef.current = setTimeout(() => {
          if (!isLoaded) {
            console.warn(`Waveform load timeout for track: ${track.name}`);
            setError('Waveform took too long to load');
            setIsLoading(false);
            setIsLoaded(false);
          }
        }, 8000);

        const waveSurfer = WaveSurfer.create({
          container: containerRef.current,
          waveColor: getTrackWaveColor(trackIndex, isMuted),
          progressColor: getTrackProgressColor(trackIndex, isMuted),
          cursorColor: 'rgba(255, 255, 255, 0.8)',
          barWidth: 2,
          barGap: 1,
          height: trackHeight - 16,
          normalize: true,
          interact: false, // Disable WaveSurfer controls since Tone.js handles playback
          hideScrollbar: true,
          minPxPerSec: pixelsPerSecond,
          fillParent: false,
          mediaControls: false,
          autoplay: false, // Critical: Never autoplay
          backend: 'WebAudio'
        });

        waveSurferRef.current = waveSurfer;

        // Surface internal errors from wavesurfer
        waveSurfer.on('error', (e: any) => {
          console.error(`WaveSurfer error for track ${track.name}:`, e);
          if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
          setError('Failed to load waveform');
          setIsLoaded(false);
          setIsLoading(false);
        });

        // Load the audio file
        waveSurfer.load(track.file_url).then(() => {
          if (loadingTimeoutRef.current) clearTimeout(loadingTimeoutRef.current);
          if (waveSurferRef.current === waveSurfer) { // Check if this is still the current instance
            setIsLoaded(true);
            setError(null);
            setIsLoading(false);
            loadedUrlRef.current = track.file_url;
            console.log(`WaveSurfer loaded for track: ${track.name}`);
            
            // Force immediate update to prevent loading state persistence
            waveSurfer.pause(); // Ensure it never plays
          }
        }).catch((err) => {
          if (waveSurferRef.current === waveSurfer) { // Check if this is still the current instance
            console.error(`Failed to load waveform for track ${track.name}:`, err);
            setError('Failed to load waveform');
            setIsLoaded(false);
            setIsLoading(false);
          }
        });

        // Prevent WaveSurfer from playing audio
        waveSurfer.on('ready', () => {
          if (waveSurferRef.current === waveSurfer) {
            waveSurfer.pause(); // Ensure it never plays
          }
        });
      } catch (err) {
        console.error('Error creating WaveSurfer:', err);
        setError('Failed to create waveform');
        setIsLoading(false);
      }
    }, 100); // 100ms debounce

    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
    };
  }, [track.id, track.file_url, trackHeight, trackIndex]); // Removed isMuted from dependencies to prevent re-initialization

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      if (waveSurferRef.current) {
        waveSurferRef.current.destroy();
        waveSurferRef.current = null;
      }
      setIsLoading(false);
      setIsLoaded(false);
      loadedUrlRef.current = null;
    };
  }, []);

  // Update playhead position based on timeline time and clip trims
  useEffect(() => {
    if (!waveSurferRef.current || !isLoaded) return;

    try {
      const fullDuration = clip.fullDuration || clip.originalTrack.analyzed_duration || clip.originalTrack.duration || clipDuration;
      const startOffset = Math.max(0, clip.trimStart ?? 0);
      const endOffset = Math.min(fullDuration, clip.trimEnd ?? fullDuration);
      const trimmedDuration = Math.max(0.01, endOffset - startOffset);

      // Calculate relative position within this clip container
      const relativeTime = currentTime - clip.startTime;
      
      if (relativeTime >= 0 && relativeTime <= clipDuration) {
        // Map the relative time to the trimmed audio portion in the source
        const progress = relativeTime / clipDuration;
        const audioTime = startOffset + (progress * trimmedDuration);
        const audioProgress = Math.max(0, Math.min(1, audioTime / fullDuration));
        
        waveSurferRef.current.seekTo(audioProgress);
      } else if (currentTime < clip.startTime) {
        const audioProgress = Math.max(0, Math.min(1, startOffset / fullDuration));
        waveSurferRef.current.seekTo(audioProgress);
      } else {
        const audioProgress = Math.max(0, Math.min(1, endOffset / fullDuration));
        waveSurferRef.current.seekTo(audioProgress);
      }
    } catch (err) {
      console.error('Error updating WaveSurfer playhead:', err);
    }
  }, [currentTime, clip.startTime, clip.endTime, clipDuration, isLoaded, clip.fullDuration, clip.trimStart, clip.trimEnd]);

  // Update visual opacity based on mute state
  useEffect(() => {
    if (!containerRef.current) return;
    
    containerRef.current.style.opacity = opacity.toString();
    
    // Update waveform colors if needed
    if (waveSurferRef.current && isLoaded) {
      try {
        waveSurferRef.current.setOptions({
          waveColor: getTrackWaveColor(trackIndex, isMuted),
          progressColor: getTrackProgressColor(trackIndex, isMuted)
        });
      } catch (err) {
        console.error('Error updating waveform colors:', err);
      }
    }
  }, [isMuted, opacity, trackIndex, isLoaded]);

  // Handle click events
  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    // Handle track selection
    if (onTrackSelect) {
      onTrackSelect(track.id);
    }
    if (onClipClick) {
      onClipClick(clip.id, event);
    }
  };

  const handleDoubleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (onClipDoubleClick) {
      onClipDoubleClick(clip.id);
    }
  };

  // Handle record arm toggle
  const handleRecordArmClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    if (onRecordArmToggle) {
      onRecordArmToggle(track.id, event.shiftKey);
    }
  };

  // Dynamic styling for selection and record arm states
  const containerClassName = `relative border-2 rounded cursor-pointer overflow-hidden ${className} ${
    isSelected ? 'border-neon-cyan shadow-[0_0_20px_rgba(0,255,255,0.5)]' : ''
  }`;

  return (
    <div
      className={containerClassName}
      style={{
        width: clipWidth,
        height: trackHeight - 8,
        minWidth: 100, // Minimum width for visibility
        borderColor: isSelected ? 'hsl(var(--neon-cyan))' : getTrackBorderColor(trackIndex),
        boxShadow: isSelected ? '0 0 20px rgba(0, 255, 255, 0.5)' : undefined
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {!track.file_url || track.file_url.trim() === '' ? (
        // Empty track - ready for recording or MIDI input
        <div className="flex items-center justify-center h-full bg-purple-500/10 border-purple-500/30 border-dashed">
          <div className="text-center">
            <Circle className="w-4 h-4 mx-auto mb-1 text-purple-400" />
            <span className="text-xs text-purple-400">Ready to Record</span>
          </div>
        </div>
      ) : (
        <>
          <div className="relative w-full h-full">
            {/* WaveSurfer container (always rendered so init can attach) */}
            <div
              ref={containerRef}
              id={containerId}
              className="w-full h-full"
            />

            {/* Loading overlay */}
            {(isLoading || (!isLoaded && track.file_url)) && !error && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-blue-500/10 border-blue-500">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                <span className="text-xs text-blue-400 ml-2">Loading...</span>
              </div>
            )}

            {/* Error overlay */}
            {error && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-500/10 border-red-500">
                <span className="text-xs text-red-400">Failed to load</span>
              </div>
            )}

            {/* Trim overlays: dim hidden (trimmed) parts so only visible segment pops */}
            {(() => {
              const total = clip.fullDuration || clip.originalTrack.analyzed_duration || clip.originalTrack.duration || clipDuration;
              if (!total || total <= 0) return null;
              const s = Math.max(0, Math.min(clip.trimStart ?? 0, total));
              const e = Math.max(s, Math.min(clip.trimEnd ?? total, total));
              const leftPct = (s / total) * 100;
              const rightPct = ((total - e) / total) * 100;
              return (
                <>
                  {leftPct > 0 && (
                    <div
                      className="pointer-events-none absolute top-0 left-0 h-full bg-background/60 border-r border-border/40"
                      style={{ width: `${leftPct}%` }}
                    />
                  )}
                  {rightPct > 0 && (
                    <div
                      className="pointer-events-none absolute top-0 right-0 h-full bg-background/60 border-l border-border/40"
                      style={{ width: `${rightPct}%` }}
                    />
                  )}
                </>
              );
            })()}

            {/* Clip action buttons */}
            <div className="absolute bottom-1 right-1 z-20 flex gap-1">
              <button
                type="button"
                className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-background/80 text-foreground border border-border shadow-sm hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Duplicate clip"
                title="Duplicate clip"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onDuplicateClip) onDuplicateClip(clip.id);
                }}
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center h-6 w-6 rounded-md bg-background/80 text-foreground border border-border shadow-sm hover:bg-destructive/20 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                aria-label="Delete clip"
                title="Delete clip"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  if (onDeleteClip) onDeleteClip(clip.id);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

// Color helper functions for track visualization
function getTrackWaveColor(trackIndex: number, isMuted: boolean): string {
  const baseColors = [
    'rgba(34, 197, 94, 0.8)',   // green
    'rgba(59, 130, 246, 0.8)',  // blue
    'rgba(168, 85, 247, 0.8)',  // purple
    'rgba(245, 101, 101, 0.8)', // red
    'rgba(251, 191, 36, 0.8)',  // yellow
    'rgba(14, 165, 233, 0.8)',  // sky
    'rgba(139, 92, 246, 0.8)',  // violet
    'rgba(236, 72, 153, 0.8)',  // pink
  ];
  
  const colorIndex = trackIndex % baseColors.length;
  const baseColor = baseColors[colorIndex];
  
  return isMuted ? baseColor.replace('0.8', '0.3') : baseColor;
}

function getTrackProgressColor(trackIndex: number, isMuted: boolean): string {
  const baseColors = [
    'rgba(34, 197, 94, 1)',     // green
    'rgba(59, 130, 246, 1)',    // blue  
    'rgba(168, 85, 247, 1)',    // purple
    'rgba(245, 101, 101, 1)',   // red
    'rgba(251, 191, 36, 1)',    // yellow
    'rgba(14, 165, 233, 1)',    // sky
    'rgba(139, 92, 246, 1)',    // violet
    'rgba(236, 72, 153, 1)',    // pink
  ];
  
  const colorIndex = trackIndex % baseColors.length;
  const baseColor = baseColors[colorIndex];
  
  return isMuted ? baseColor.replace('1)', '0.5)') : baseColor;
}

function getTrackBorderColor(trackIndex: number): string {
  const borderColors = [
    'rgb(34, 197, 94)',   // green
    'rgb(59, 130, 246)',  // blue
    'rgb(168, 85, 247)',  // purple
    'rgb(245, 101, 101)', // red
    'rgb(251, 191, 36)',  // yellow
    'rgb(14, 165, 233)',  // sky
    'rgb(139, 92, 246)',  // violet
    'rgb(236, 72, 153)',  // pink
  ];
  
  return borderColors[trackIndex % borderColors.length];
}
