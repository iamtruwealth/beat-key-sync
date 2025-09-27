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

  const track = clip.originalTrack;
  const clipDuration = clip.endTime - clip.startTime;
  const clipWidth = clipDuration * pixelsPerSecond;
  
  // Calculate visual properties
  const isMuted = track.isMuted || false;
  const opacity = isMuted ? 0.3 : 1;
  
  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || waveSurferRef.current) return;

    try {
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
        setIsLoaded(true);
        setError(null);
        console.log(`WaveSurfer loaded for track: ${track.name}`);
      }).catch((err) => {
        console.error(`Failed to load waveform for track ${track.name}:`, err);
        setError('Failed to load waveform');
        setIsLoaded(false);
      });

      // Prevent WaveSurfer from playing audio
      waveSurfer.on('ready', () => {
        waveSurfer.pause(); // Ensure it never plays
      });

      return () => {
        if (waveSurferRef.current) {
          waveSurferRef.current.destroy();
          waveSurferRef.current = null;
        }
      };
    } catch (err) {
      console.error('Error creating WaveSurfer:', err);
      setError('Failed to create waveform');
    }
  }, [track.file_url, track.name, pixelsPerSecond, trackHeight, trackIndex]);

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
      className={`relative border-2 rounded cursor-pointer overflow-hidden ${getTrackBorderColor(trackIndex)} ${className}`}
      style={{
        width: clipWidth,
        height: trackHeight - 8,
        minWidth: 100 // Minimum width for visibility
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {error ? (
        <div className="flex items-center justify-center h-full bg-red-500/10 border-red-500">
          <span className="text-xs text-red-400">Failed to load</span>
        </div>
      ) : (
        <>
          {/* WaveSurfer container */}
          <div
            ref={containerRef}
            id={containerId}
            className="w-full h-full"
            style={{ opacity }}
          />
          
          {/* Loading overlay */}
          {!isLoaded && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/20">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
            </div>
          )}
          
          {/* Duplicate button */}
          {onDuplicateClip && (
            <button
              onClick={(e) => {
                console.log('Duplicate button clicked for clip:', clip.id);
                e.stopPropagation();
                e.preventDefault();
                onDuplicateClip(clip.id);
              }}
              className="absolute top-1 right-1 w-6 h-6 bg-primary/80 hover:bg-primary text-white rounded text-xs font-bold opacity-80 hover:opacity-100 transition-opacity z-10 cursor-pointer"
              title="Duplicate clip"
            >
              ⧉
            </button>
          )}
          
          {/* Time markers - only show if not hiding titles */}
          {!className.includes('clip-hide-titles') && (
            <>
              <div className="absolute bottom-1 left-2 text-xs text-white/70">
                {formatTime(clip.startTime)}
              </div>
              <div className="absolute bottom-1 right-2 text-xs text-white/70">
                {formatTime(clip.endTime)}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
};

// Futuristic color palette for index-based track coloring
const FUTURISTIC_PALETTE = [
  '#00FFFF', // cyan
  '#1E90FF', // blue  
  '#FF1493', // magenta
  '#FF4500', // red-orange
  '#32CD32', // lime green
  '#FFD700', // gold
  '#40E0D0', // turquoise
  '#FF6347'  // tomato
];

// Helper functions for index-based track colors with gradients
const getTrackBaseColor = (trackIndex: number): string => {
  return FUTURISTIC_PALETTE[trackIndex % FUTURISTIC_PALETTE.length];
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } => {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : { r: 0, g: 255, b: 255 }; // fallback to cyan
};


const getTrackWaveColor = (trackIndex: number, isMuted: boolean = false): string => {
  const baseColor = getTrackBaseColor(trackIndex);
  const { r, g, b } = hexToRgb(baseColor);
  
  if (isMuted) {
    return `rgba(${r}, ${g}, ${b}, 0.3)`;
  }
  
  // Create a subtle variation for the waveform
  const adjustedR = Math.max(0, Math.min(255, r - 10));
  const adjustedG = Math.max(0, Math.min(255, g - 10));
  const adjustedB = Math.max(0, Math.min(255, b - 10));
  
  return `rgb(${adjustedR}, ${adjustedG}, ${adjustedB})`;
};

const getTrackProgressColor = (trackIndex: number, isMuted: boolean = false): string => {
  const baseColor = getTrackBaseColor(trackIndex);
  const { r, g, b } = hexToRgb(baseColor);
  
  if (isMuted) {
    return `rgba(${r}, ${g}, ${b}, 0.4)`;
  }
  
  // Progress color should be brighter/more vibrant
  const enhancedR = Math.min(255, r + 30);
  const enhancedG = Math.min(255, g + 30);
  const enhancedB = Math.min(255, b + 30);
  
  return `rgb(${enhancedR}, ${enhancedG}, ${enhancedB})`;
};

const getTrackBorderColor = (trackIndex: number): string => {
  const baseColor = getTrackBaseColor(trackIndex);
  const { r, g, b } = hexToRgb(baseColor);
  
  // Create a custom border color class - we'll use inline style since we can't dynamically create CSS classes
  return `border-[rgba(${r},${g},${b},0.6)]`;
};

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};