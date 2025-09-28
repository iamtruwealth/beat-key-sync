import React, { useRef, useEffect, useState } from 'react';
import WaveSurfer from 'wavesurfer.js';

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
  className?: string;
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
  className = ""
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const waveSurferRef = useRef<WaveSurfer | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const loadedUrlRef = useRef<string | null>(null);
  const initTimeoutRef = useRef<NodeJS.Timeout | null>(null);

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

    // Skip if already loaded for this URL, currently loading, or no container
    if (!containerRef.current || isLoading || loadedUrlRef.current === track.file_url) {
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

        // Load the audio file
        waveSurfer.load(track.file_url).then(() => {
          if (waveSurferRef.current === waveSurfer) { // Check if this is still the current instance
            setIsLoaded(true);
            setError(null);
            setIsLoading(false);
            loadedUrlRef.current = track.file_url;
            console.log(`WaveSurfer loaded for track: ${track.name}`);
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
  }, [track.id, track.file_url, trackHeight, trackIndex, isMuted]); // Include necessary dependencies

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

  // Update playhead position based on Tone.Transport time
  useEffect(() => {
    if (!waveSurferRef.current || !isLoaded) return;

    try {
      // Calculate relative position within this clip
      const relativeTime = currentTime - clip.startTime;
      
      if (relativeTime >= 0 && relativeTime <= clipDuration) {
        // Playhead is within this clip's time range
        const progress = relativeTime / clipDuration;
        const clampedProgress = Math.max(0, Math.min(1, progress));
        waveSurferRef.current.seekTo(clampedProgress);
      } else if (currentTime < clip.startTime) {
        // Playhead is before this clip
        waveSurferRef.current.seekTo(0);
      } else {
        // Playhead is after this clip
        waveSurferRef.current.seekTo(1);
      }
    } catch (err) {
      console.error('Error updating WaveSurfer playhead:', err);
    }
  }, [currentTime, clip.startTime, clip.endTime, clipDuration, isLoaded]);

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

  return (
    <div
      className={`relative border-2 rounded cursor-pointer overflow-hidden ${className}`}
      style={{
        width: clipWidth,
        height: trackHeight - 8,
        minWidth: 100, // Minimum width for visibility
        borderColor: getTrackBorderColor(trackIndex)
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {error ? (
        <div className="flex items-center justify-center h-full bg-red-500/10 border-red-500">
          <span className="text-xs text-red-400">Failed to load</span>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center h-full bg-blue-500/10 border-blue-500">
          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
          <span className="text-xs text-blue-400 ml-2">Loading...</span>
        </div>
      ) : (
        <>
          {/* WaveSurfer container */}
          <div
            ref={containerRef}
            id={containerId}
            className="w-full h-full"
          />
          
          {/* Loading overlay */}
          {!isLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/50">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            </div>
          )}
          
          {/* Track name overlay */}
          <div className="absolute top-1 left-1 text-xs text-foreground/80 bg-background/20 px-1 rounded truncate max-w-[calc(100%-8px)]">
            {track.name}
          </div>
          
          {/* Track type badge */}
          <div className="absolute top-1 right-1 text-xs bg-background/80 text-foreground px-1 rounded">
            {track.stem_type}
          </div>
          
          {/* Context menu trigger (right click area) */}
          <div 
            className="absolute bottom-0 right-0 w-4 h-4 opacity-0 hover:opacity-30 bg-primary cursor-context-menu"
            onContextMenu={(e) => {
              e.preventDefault();
              // You can add context menu functionality here later
              console.log('Context menu for clip:', clip.id);
            }}
          />
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