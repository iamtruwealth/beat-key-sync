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
  trackIndex: number;
  onClipClick?: (clipId: string, event: React.MouseEvent) => void;
  onClipDoubleClick?: (clipId: string) => void;
  onDuplicateClip?: (clipId: string) => void;
  onDeleteClip?: (clipId: string) => void;
  className?: string;
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

  const track = clip.originalTrack;
  const clipDuration = clip.endTime - clip.startTime;
  const clipWidth = clipDuration * pixelsPerSecond;
  
  // Calculate visual properties
  const isMuted = track.isMuted || false;
  const opacity = isMuted ? 0.3 : 1;

  // Initialize WaveSurfer
  useEffect(() => {
    if (!containerRef.current || !track.file_url || track.file_url.trim() === '') {
      return;
    }

    // Use a ref to track if we've already loaded this exact file
    const currentTrackKey = `${track.id}-${track.file_url}`;
    
    // Clean up existing instance only if track/url changed
    if (waveSurferRef.current) {
      waveSurferRef.current.destroy();
      waveSurferRef.current = null;
    }

    try {
      console.log(`Loading WaveSurfer for track: ${track.name} (${track.file_url})`);
      
      const waveSurfer = WaveSurfer.create({
        container: containerRef.current,
        waveColor: getTrackWaveColor(trackIndex, isMuted),
        progressColor: getTrackProgressColor(trackIndex, isMuted),
        cursorColor: 'transparent',
        barWidth: 2,
        barGap: 1,
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

      waveSurfer.on('error', (e: any) => {
        console.error(`WaveSurfer error for track ${track.name}:`, e);
        setError('Failed to load waveform');
        setIsLoaded(false);
      });

      waveSurfer.load(track.file_url).then(() => {
        if (waveSurferRef.current === waveSurfer) {
          setIsLoaded(true);
          setError(null);
          console.log(`WaveSurfer loaded for track: ${track.name}`);
          waveSurfer.pause(); // Never play audio
        }
      }).catch((err) => {
        if (waveSurferRef.current === waveSurfer) {
          console.error(`Failed to load waveform for track ${track.name}:`, err);
          setError('Failed to load waveform');
          setIsLoaded(false);
        }
      });

      waveSurfer.on('ready', () => {
        if (waveSurferRef.current === waveSurfer) {
          waveSurfer.pause();
        }
      });

    } catch (err) {
      console.error('Error creating WaveSurfer:', err);
      setError('Failed to create waveform');
    }

    return () => {
      if (waveSurferRef.current) {
        waveSurferRef.current.destroy();
        waveSurferRef.current = null;
      }
    };
    // Only re-run when track ID or file URL actually changes
  }, [track.id, track.file_url]);

  // Resize/scale updates without re-creating WaveSurfer
  useEffect(() => {
    if (!waveSurferRef.current || !isLoaded) return;
    try {
      waveSurferRef.current.setOptions({
        height: trackHeight - 16,
        minPxPerSec: pixelsPerSecond,
        fillParent: false,
        hideScrollbar: true,
      });
    } catch (e) {
      console.warn('WaveSurfer setOptions (size) failed', e);
    }
  }, [trackHeight, pixelsPerSecond, isLoaded]);
  useEffect(() => {
    if (!waveSurferRef.current || !isLoaded) return;

    try {
      const fullDuration = clip.fullDuration || clip.originalTrack.analyzed_duration || clip.originalTrack.duration || clipDuration;
      const startOffset = Math.max(0, clip.trimStart ?? 0);
      const endOffset = Math.min(fullDuration, clip.trimEnd ?? fullDuration);
      const trimmedDuration = Math.max(0.01, endOffset - startOffset);

      const relativeTime = currentTime - clip.startTime;
      
      if (relativeTime >= 0 && relativeTime <= clipDuration) {
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
  }, [currentTime, isPlaying, clip.startTime, clip.endTime, clipDuration, isLoaded, clip.fullDuration, clip.trimStart, clip.trimEnd]);

  // Update visual opacity and colors based on mute state
  useEffect(() => {
    if (!containerRef.current) return;
    
    containerRef.current.style.opacity = opacity.toString();
    
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

  const containerClassName = `relative cursor-pointer overflow-hidden ${className}`;

  return (
    <div
      className={containerClassName}
      style={{
        width: clipWidth,
        height: trackHeight - 8,
        minWidth: 100
      }}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {error ? (
        <div className="flex items-center justify-center h-full bg-red-500/10 border-red-500">
          <span className="text-xs text-red-400">Failed to load</span>
        </div>
      ) : !track.file_url || track.file_url.trim() === '' ? (
        <div className="flex items-center justify-center h-full bg-purple-500/10 border-purple-500/30 border-dashed">
          <div className="text-center">
            <Circle className="w-4 h-4 mx-auto mb-1 text-purple-400" />
            <span className="text-xs text-purple-400">Ready to Record</span>
          </div>
        </div>
      ) : (
        <>
          {/* WaveSurfer container */}
          <div
            ref={containerRef}
            id={containerId}
            className="w-full h-full relative z-10"
          />

          {/* Trim overlays */}
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
  const base = getTrackWaveColor(trackIndex, isMuted);
  // increase opacity slightly so progress doesn't overwrite wave
  return base.replace('0.8', '1.0').replace('0.3', '0.6');
}
