import React, { useRef, useEffect, useState } from 'react';
import { Copy, Circle, Trash2 } from 'lucide-react';
import { usePeaksCache } from '@/hooks/usePeaksCache';
import { StaticWaveform } from './StaticWaveform';

// Debug build stamp for WaveformTrack
const WAVEFORM_TRACK_BUILD = 'WaveformTrack@2025-10-04T03:12:00Z';
console.warn('[WaveformTrack] build', WAVEFORM_TRACK_BUILD);

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
  const [isLoaded, setIsLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [peaks, setPeaks] = useState<Float32Array[] | null>(null);
  const [audioDuration, setAudioDuration] = useState<number>(0);
  const { getPeaks } = usePeaksCache();

  const track = clip.originalTrack;
  const clipDuration = clip.endTime - clip.startTime;
  const clipWidth = clipDuration * pixelsPerSecond;
  
  // Calculate visual properties
  const isMuted = track.isMuted || false;
  const opacity = isMuted ? 0.3 : 1;

  // Calculate progress for waveform display
  const fullDuration = clip.fullDuration || clip.originalTrack.analyzed_duration || clip.originalTrack.duration || clipDuration;
  const startOffset = Math.max(0, clip.trimStart ?? 0);
  const endOffset = Math.min(fullDuration, clip.trimEnd ?? fullDuration);
  const trimmedDuration = Math.max(0.01, endOffset - startOffset);

  const relativeTime = currentTime - clip.startTime;
  let audioProgress = 0;
  if (relativeTime >= 0 && relativeTime <= clipDuration) {
    const progress = relativeTime / clipDuration;
    const audioTime = startOffset + (progress * trimmedDuration);
    audioProgress = Math.max(0, Math.min(1, audioTime / fullDuration));
  } else if (currentTime < clip.startTime) {
    audioProgress = Math.max(0, Math.min(1, startOffset / fullDuration));
  } else {
    audioProgress = Math.max(0, Math.min(1, endOffset / fullDuration));
  }

  // Load peaks from cache or decode
  useEffect(() => {
    if (!track.file_url || track.file_url.trim() === '') {
      return;
    }

    let mounted = true;

    console.info('[WaveformTrack] getPeaks start', { trackId: track.id, url: track.file_url });
    getPeaks(track.file_url, 100)
      .then(({ peaks: loadedPeaks, duration }) => {
        if (mounted) {
          console.info('[WaveformTrack] getPeaks success', { trackId: track.id, duration, channels: loadedPeaks?.length });
          setPeaks(loadedPeaks);
          setAudioDuration(duration);
          setIsLoaded(true);
          setError(null);
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error(`Failed to load peaks for ${track.name}:`, err);
          setError('Failed to load waveform');
          setIsLoaded(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [track.id, track.file_url, getPeaks, track.name]);

  // Debug: mount/unmount and key prop changes
  useEffect(() => {
    console.info('[WaveformTrack] mount', {
      clipId: clip.id,
      trackId: track.id,
      clipDuration,
      clipWidth,
      trackHeight,
      pixelsPerSecond,
    });
    return () => {
      console.info('[WaveformTrack] unmount', { clipId: clip.id, trackId: track.id });
    };
  }, []);

  useEffect(() => {
    console.info('[WaveformTrack] props update', {
      clipId: clip.id,
      currentTime,
      audioProgress,
      isPlaying,
      isMuted,
      hasPeaks: !!peaks,
      audioDuration,
    });
  }, [currentTime, audioProgress, isPlaying, isMuted, peaks, audioDuration]);

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

  const containerClassName = `relative pointer-events-none ${className}`;

  return (
    <div
      className={containerClassName}
      data-build={WAVEFORM_TRACK_BUILD}
      style={{
        width: clipWidth,
        height: trackHeight - 8,
        minWidth: 100,
        pointerEvents: 'none'
      }}
    >
      {/* Visible WF build badge */}
      <div className="absolute top-1 left-1 z-20 bg-accent/80 text-accent-foreground px-1.5 py-0.5 rounded text-[10px] font-mono pointer-events-none">
        WF: {WAVEFORM_TRACK_BUILD} | peaks: {peaks ? 'yes' : 'no'}
      </div>
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
          {/* Static Waveform Renderer */}
          {peaks && (
            <StaticWaveform
              peaks={peaks}
              duration={audioDuration}
              width={clipWidth}
              height={trackHeight - 16}
              waveColor={getTrackWaveColor(trackIndex, isMuted)}
              progressColor={getTrackProgressColor(trackIndex, isMuted)}
              progress={audioProgress}
              className="absolute inset-0 z-5"
            />
          )}

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
                    className="pointer-events-none absolute top-0 left-0 h-full z-10 bg-background/60 border-r border-border/40"
                    style={{ width: `${leftPct}%` }}
                  />
                )}
                {rightPct > 0 && (
                  <div
                    className="pointer-events-none absolute top-0 right-0 h-full z-10 bg-background/60 border-l border-border/40"
                    style={{ width: `${rightPct}%` }}
                  />
                )}
              </>
            );
          })()}
           
          {/* Clip action buttons */}
          <div className="absolute bottom-1 right-1 z-20 flex gap-1 pointer-events-auto">
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
