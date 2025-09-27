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
  onClipClick?: (clipId: string, event: React.MouseEvent) => void;
  onClipDoubleClick?: (clipId: string) => void;
  className?: string;
}

export const WaveformTrack: React.FC<WaveformTrackProps> = ({
  clip,
  containerId,
  currentTime,
  isPlaying,
  pixelsPerSecond,
  trackHeight,
  onClipClick,
  onClipDoubleClick,
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
      const waveColor = getStemWaveColor(track.stem_type);
      const progressColor = getStemProgressColor(track.stem_type);
      
      console.log(`Creating WaveSurfer for ${track.name} with colors:`, { waveColor, progressColor });
      
      const waveSurfer = WaveSurfer.create({
        container: containerRef.current,
        waveColor: waveColor,
        progressColor: progressColor,
        cursorColor: '#00ffff',
        barWidth: 3,
        barGap: 1,
        barRadius: 2,
        height: trackHeight - 16,
        normalize: true,
        interact: false,
        hideScrollbar: true,
        minPxPerSec: pixelsPerSecond,
        fillParent: false,
        mediaControls: false,
        autoplay: false,
        backend: 'WebAudio'
      });

      waveSurferRef.current = waveSurfer;

      // Load the audio file
      waveSurfer.load(track.file_url).then(() => {
        setIsLoaded(true);
        setError(null);
        console.log(`WaveSurfer loaded for track: ${track.name}, final colors:`, {
          waveColor: waveSurfer.options.waveColor,
          progressColor: waveSurfer.options.progressColor
        });
        
        // Force color update after loading
        waveSurfer.setOptions({
          waveColor: waveColor,
          progressColor: progressColor
        });
        
      }).catch((err) => {
        console.error(`Failed to load waveform for track ${track.name}:`, err);
        setError('Failed to load waveform');
        setIsLoaded(false);
      });

      // Prevent WaveSurfer from playing audio and force colors
      waveSurfer.on('ready', () => {
        waveSurfer.pause();
        
        // Direct canvas manipulation for colors
        const canvas = containerRef.current?.querySelector('canvas');
        if (canvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // Apply color filter directly to canvas
            canvas.style.filter = `hue-rotate(${getHueRotationForStem(track.stem_type)}deg) saturate(300%) brightness(120%)`;
          }
        }
        
        console.log(`WaveSurfer ready for ${track.name}, applied colors:`, { waveColor, progressColor });
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
  }, [track.file_url, track.name, pixelsPerSecond, trackHeight, track.stem_type]);

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
          waveColor: isMuted ? getStemWaveColor(track.stem_type) + '60' : getStemWaveColor(track.stem_type),
          progressColor: isMuted ? getStemProgressColor(track.stem_type) + '60' : getStemProgressColor(track.stem_type)
        });
      } catch (err) {
        console.error('Error updating waveform colors:', err);
      }
    }
  }, [isMuted, opacity, track.stem_type, isLoaded]);

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
      className={`relative rounded-lg cursor-pointer overflow-hidden backdrop-blur-sm ${getStemBorderColor(track.stem_type)} ${className}`}
      style={{
        width: clipWidth,
        height: trackHeight - 8,
        minWidth: 100,
        background: getStemBackgroundGradient(track.stem_type),
        border: `2px solid ${getStemBorderColorHex(track.stem_type)}`,
        boxShadow: `0 0 20px ${getStemGlowColor(track.stem_type)}`
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {error ? (
        <div className="flex items-center justify-center h-full bg-red-500/20 border-red-400 rounded-lg">
          <span className="text-xs text-red-300">Failed to load</span>
        </div>
      ) : (
        <>
          {/* Animated background effect */}
          <div 
            className="absolute inset-0 opacity-30"
            style={{
              background: `linear-gradient(45deg, ${getStemWaveColor(track.stem_type)}20, transparent, ${getStemProgressColor(track.stem_type)}20)`,
              animation: 'pulse 2s ease-in-out infinite'
            }}
          />
          
          {/* WaveSurfer container with enhanced styling */}
          <div
            ref={containerRef}
            id={containerId}
            className="relative w-full h-full z-10"
            style={{ 
              opacity,
              filter: isMuted ? 'grayscale(100%)' : 'none'
            }}
          />
          
          {/* Add custom CSS for WaveSurfer colors */}
          <style>{`
            #${containerId} wave {
              fill: ${getStemWaveColor(track.stem_type)} !important;
            }
            #${containerId} .wavesurfer-cursor {
              border-color: #00ffff !important;
            }
            #${containerId} canvas {
              filter: hue-rotate(0deg) saturate(2) brightness(1.2) !important;
            }
          `}</style>
          
          {/* Loading overlay with neon effect */}
          {!isLoaded && !error && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm">
              <div 
                className="w-6 h-6 border-2 rounded-full animate-spin"
                style={{
                  borderColor: getStemWaveColor(track.stem_type),
                  borderTopColor: 'transparent',
                  boxShadow: `0 0 10px ${getStemWaveColor(track.stem_type)}`
                }}
              />
            </div>
          )}
          
          {/* Track name overlay with glow */}
          <div className="absolute top-1 left-2 right-2 z-20">
            <span 
              className="text-xs font-bold text-white truncate block drop-shadow-lg"
              style={{ 
                textShadow: `0 0 8px ${getStemWaveColor(track.stem_type)}` 
              }}
            >
              {track.name}
            </span>
          </div>
          
          {/* Time markers with neon styling */}
          <div 
            className="absolute bottom-1 left-2 text-xs font-mono font-bold"
            style={{ 
              color: getStemWaveColor(track.stem_type),
              textShadow: `0 0 4px ${getStemWaveColor(track.stem_type)}`
            }}
          >
            {formatTime(clip.startTime)}
          </div>
          <div 
            className="absolute bottom-1 right-2 text-xs font-mono font-bold"
            style={{ 
              color: getStemWaveColor(track.stem_type),
              textShadow: `0 0 4px ${getStemWaveColor(track.stem_type)}`
            }}
          >
            {formatTime(clip.endTime)}
          </div>
          
          {/* Stem type indicator */}
          <div 
            className="absolute top-1 right-2 px-2 py-0.5 rounded text-xs font-bold uppercase"
            style={{
              background: `${getStemWaveColor(track.stem_type)}40`,
              color: getStemWaveColor(track.stem_type),
              border: `1px solid ${getStemWaveColor(track.stem_type)}80`,
              textShadow: `0 0 4px ${getStemWaveColor(track.stem_type)}`
            }}
          >
            {track.stem_type}
          </div>
        </>
      )}
    </div>
  );
};

// Enhanced helper functions for vibrant neon colors
const getStemWaveColor = (stemType: string): string => {
  const colors = {
    drums: '#ff0080',      // Neon magenta
    bass: '#00ffff',       // Neon cyan  
    melody: '#00ff80',     // Neon green
    vocals: '#8000ff',     // Neon purple
    fx: '#ff8000',         // Neon orange
    other: '#ffffff'       // Bright white
  };
  return colors[stemType as keyof typeof colors] || colors.other;
};

const getStemProgressColor = (stemType: string): string => {
  const colors = {
    drums: '#ff00ff',      // Bright magenta
    bass: '#0080ff',       // Electric blue
    melody: '#80ff00',     // Electric green
    vocals: '#ff00ff',     // Electric magenta
    fx: '#ffff00',         // Electric yellow
    other: '#cccccc'       // Light gray
  };
  return colors[stemType as keyof typeof colors] || colors.other;
};

const getStemBackgroundGradient = (stemType: string): string => {
  const gradients = {
    drums: 'linear-gradient(135deg, rgba(255,0,128,0.2) 0%, rgba(255,0,255,0.1) 50%, rgba(0,0,0,0.8) 100%)',
    bass: 'linear-gradient(135deg, rgba(0,255,255,0.2) 0%, rgba(0,128,255,0.1) 50%, rgba(0,0,0,0.8) 100%)',
    melody: 'linear-gradient(135deg, rgba(0,255,128,0.2) 0%, rgba(128,255,0,0.1) 50%, rgba(0,0,0,0.8) 100%)',
    vocals: 'linear-gradient(135deg, rgba(128,0,255,0.2) 0%, rgba(255,0,255,0.1) 50%, rgba(0,0,0,0.8) 100%)',
    fx: 'linear-gradient(135deg, rgba(255,128,0,0.2) 0%, rgba(255,255,0,0.1) 50%, rgba(0,0,0,0.8) 100%)',
    other: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(128,128,128,0.1) 50%, rgba(0,0,0,0.8) 100%)'
  };
  return gradients[stemType as keyof typeof gradients] || gradients.other;
};

const getStemGlowColor = (stemType: string): string => {
  const colors = {
    drums: 'rgba(255,0,128,0.4)',
    bass: 'rgba(0,255,255,0.4)',
    melody: 'rgba(0,255,128,0.4)',
    vocals: 'rgba(128,0,255,0.4)',
    fx: 'rgba(255,128,0,0.4)',
    other: 'rgba(255,255,255,0.2)'
  };
  return colors[stemType as keyof typeof colors] || colors.other;
};

const getStemBorderColorHex = (stemType: string): string => {
  const colors = {
    drums: '#ff0080',
    bass: '#00ffff',
    melody: '#00ff80',
    vocals: '#8000ff',
    fx: '#ff8000',
    other: '#ffffff'
  };
  return colors[stemType as keyof typeof colors] || colors.other;
};

const getStemBorderColor = (stemType: string): string => {
  const colors = {
    drums: 'border-pink-500',
    bass: 'border-cyan-400',
    melody: 'border-green-400', 
    vocals: 'border-purple-500',
    fx: 'border-orange-400',
    other: 'border-gray-400'
  };
  return colors[stemType as keyof typeof colors] || colors.other;
};

// Get hue rotation for CSS filter
const getHueRotationForStem = (stemType: string): number => {
  const rotations = {
    drums: 300,    // Pink/Magenta
    bass: 180,     // Cyan
    melody: 120,   // Green
    vocals: 270,   // Purple
    fx: 30,        // Orange
    other: 0       // White/Gray
  };
  return rotations[stemType as keyof typeof rotations] || rotations.other;
};

const formatTime = (seconds: number): string => {
  const minutes = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};