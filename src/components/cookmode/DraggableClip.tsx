import React, { useRef, useState, useCallback } from 'react';
import { WaveformTrack } from './WaveformTrack';

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
  startTime: number; // position on timeline (seconds)
  endTime: number;   // derived: startTime + (trimEnd - trimStart)
  fullDuration: number; // total length of original audio (seconds)
  trimStart: number; // visible starts at this offset within the file
  trimEnd: number;   // visible ends at this offset within the file
  originalTrack: Track;
  isSelected?: boolean;
}

interface DraggableClipProps {
  clip: AudioClip;
  currentTime: number;
  isPlaying: boolean;
  pixelsPerSecond: number;
  trackHeight: number;
  trackIndex: number;
  secondsPerBeat: number;
  onClipMove: (clipId: string, newStartTime: number) => void;
  onClipClick?: (clipId: string, event: React.MouseEvent) => void;
  onClipDoubleClick?: (clipId: string) => void;
  onDuplicateClip?: (clipId: string) => void;
  onDeleteClip?: (clipId: string) => void;
  onTrimClip?: (clipId: string, edge: 'start' | 'end', trimStart: number, trimEnd: number) => void;
  className?: string;
}

export const DraggableClip: React.FC<DraggableClipProps> = ({
  clip,
  currentTime,
  isPlaying,
  pixelsPerSecond,
  trackHeight,
  trackIndex,
  secondsPerBeat,
  onClipMove,
  onClipClick,
  onClipDoubleClick,
  onDuplicateClip,
  onDeleteClip,
  onTrimClip,
  className = ""
}) => {
  const clipRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isTrimming, setIsTrimming] = useState<'start' | 'end' | null>(null);
  const [dragStart, setDragStart] = useState({ x: 0, startTime: 0 });
  const initialTrimRef = useRef<{ leftPx: number; widthPx: number; rightPx: number }>({ leftPx: 0, widthPx: 0, rightPx: 0 });

  // Calculate clip timings
  const fullDuration = clip.fullDuration || clip.originalTrack.analyzed_duration || clip.originalTrack.duration || 0;
  const trimStart = Math.max(0, clip.trimStart ?? 0);
  const trimEnd = Math.min(fullDuration, clip.trimEnd ?? fullDuration);
  const visibleDuration = Math.max(0.1, trimEnd - trimStart);
  
  const clipWidth = visibleDuration * pixelsPerSecond;
  const clipLeft = clip.startTime * pixelsPerSecond;

  // Grid snapping function
  const snapToGrid = useCallback((time: number): number => {
    return Math.round(time / secondsPerBeat) * secondsPerBeat;
  }, [secondsPerBeat]);

  // Handle mouse down for clip movement
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      startTime: clip.startTime
    });
    
    document.body.style.userSelect = 'none';
  }, [clip.startTime]);

  // Handle mouse down for trim handles
  const handleTrimMouseDown = useCallback((e: React.MouseEvent, trimType: 'start' | 'end') => {
    if (e.button !== 0) return;
    
    e.preventDefault();
    e.stopPropagation();
    
    // Cache initial geometry so we can lock the opposite edge visually
    initialTrimRef.current = {
      leftPx: clipLeft,
      widthPx: clipWidth,
      rightPx: clipLeft + clipWidth,
    };
    
    setIsTrimming(trimType);
    setDragStart({
      x: e.clientX,
      startTime: trimType === 'start' ? trimStart : trimEnd
    });
    
    document.body.style.userSelect = 'none';
  }, [trimStart, trimEnd, clipLeft, clipWidth]);

  // Handle mouse move during drag or trim
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging && !isTrimming) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaTime = deltaX / pixelsPerSecond;
    
    if (isDragging) {
      const newStartTime = Math.max(0, dragStart.startTime + deltaTime);
      const snappedStartTime = snapToGrid(newStartTime);
      
      if (clipRef.current) {
        const newLeft = snappedStartTime * pixelsPerSecond;
        clipRef.current.style.left = `${newLeft}px`;
      }
    } else if (isTrimming && fullDuration > 0) {
      // For trimming, do NOT snap to grid for smoother precision
      const timeForTrim = Math.max(0, Math.min(fullDuration, dragStart.startTime + deltaTime));
      
      let tempTrimStart = trimStart;
      let tempTrimEnd = trimEnd;
      if (isTrimming === 'start') {
        tempTrimStart = Math.min(timeForTrim, trimEnd - 0.1);
      } else {
        tempTrimEnd = Math.max(timeForTrim, trimStart + 0.1);
      }
      const tempWidthPx = Math.max(4, (tempTrimEnd - tempTrimStart) * pixelsPerSecond);
      // Live visual feedback: keep the non-dragged edge fixed
      if (clipRef.current) {
        if (isTrimming === 'start') {
          const newLeft = Math.max(0, initialTrimRef.current.rightPx - tempWidthPx);
          clipRef.current.style.left = `${newLeft}px`;
          clipRef.current.style.width = `${tempWidthPx}px`;
        } else {
          // end trim: lock left, adjust width only
          clipRef.current.style.width = `${tempWidthPx}px`;
        }
      }
    }
  }, [isDragging, isTrimming, dragStart, pixelsPerSecond, snapToGrid, fullDuration, trimStart, trimEnd]);

  // Handle mouse up
  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!isDragging && !isTrimming) return;
    
    document.body.style.userSelect = '';
    
    const deltaX = e.clientX - dragStart.x;
    const deltaTime = deltaX / pixelsPerSecond;
    
    if (isDragging) {
      setIsDragging(false);
      const newStartTime = Math.max(0, dragStart.startTime + deltaTime);
      const snappedStartTime = snapToGrid(newStartTime);
      
      if (Math.abs(snappedStartTime - clip.startTime) > 0.01) {
        onClipMove(clip.id, snappedStartTime);
      }
    } else if (isTrimming && onTrimClip && fullDuration > 0) {
      // For trimming, avoid grid snapping to prevent "dragging" feel
      const newTime = Math.max(0, Math.min(fullDuration, dragStart.startTime + deltaTime));
      
      let newTrimStart = trimStart;
      let newTrimEnd = trimEnd;
      
      if (isTrimming === 'start') {
        newTrimStart = Math.min(newTime, trimEnd - 0.1); // Ensure start < end
        // Only change start, keep end the same
        if (Math.abs(newTrimStart - trimStart) > 0.01) {
          onTrimClip(clip.id, isTrimming, newTrimStart, trimEnd);
        }
      } else {
        newTrimEnd = Math.max(newTime, trimStart + 0.1); // Ensure end > start
        // Only change end, keep start the same
        if (Math.abs(newTrimEnd - trimEnd) > 0.01) {
          onTrimClip(clip.id, isTrimming, trimStart, newTrimEnd);
        }
      }
      
      setIsTrimming(null);
    }
  }, [isDragging, isTrimming, dragStart, pixelsPerSecond, snapToGrid, clip.id, clip.startTime, onClipMove, clip.originalTrack.id, trimStart, trimEnd, fullDuration, onTrimClip]);

  // Add global mouse event listeners
  React.useEffect(() => {
    if (isDragging || isTrimming) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isTrimming, handleMouseMove, handleMouseUp]);

  const handleClick = useCallback((event: React.MouseEvent) => {
    if (isDragging || isTrimming) return;
    
    event.stopPropagation();
    if (onClipClick) {
      onClipClick(clip.id, event);
    }
  }, [isDragging, isTrimming, onClipClick, clip.id]);

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    if (isDragging || isTrimming) return;
    
    event.stopPropagation();
    if (onClipDoubleClick) {
      onClipDoubleClick(clip.id);
    }
  }, [isDragging, isTrimming, onClipDoubleClick, clip.id]);

  return (
    <div
      ref={clipRef}
      className={`absolute cursor-move group ${className}`}
      style={{
        left: clipLeft,
        width: clipWidth,
        height: trackHeight - 8,
        top: 4,
        zIndex: isDragging || isTrimming ? 1000 : 1
      }}
      onMouseDown={handleMouseDown}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      <WaveformTrack
        clip={clip}
        containerId={`wave-${clip.id}`}
        currentTime={currentTime}
        isPlaying={isPlaying}
        pixelsPerSecond={pixelsPerSecond}
        trackHeight={trackHeight - 8}
        trackIndex={trackIndex}
        onDuplicateClip={onDuplicateClip}
        onClipDoubleClick={onClipDoubleClick}
        onClipClick={onClipClick}
        onDeleteClip={onDeleteClip}
        className={`clip-hide-titles ${isDragging || isTrimming ? 'opacity-80' : ''}`}
      />
      
      {/* Trim handles */}
      {onTrimClip && (
        <>
          {/* Left trim handle */}
          <div
            className="absolute left-0 top-0 w-4 h-full bg-primary/10 hover:bg-primary/30 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleTrimMouseDown(e, 'start')}
            style={{ zIndex: 1001, pointerEvents: 'auto' }}
          >
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-r" />
          </div>
          
          {/* Right trim handle */}
          <div
            className="absolute right-0 top-0 w-4 h-full bg-primary/10 hover:bg-primary/30 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleTrimMouseDown(e, 'end')}
            style={{ zIndex: 1001, pointerEvents: 'auto' }}
          >
            <div className="absolute right-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-l" />
          </div>
        </>
      )}
      
      {/* Drag indicator */}
      {isDragging && (
        <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-l opacity-80" />
      )}
      
      {/* Trim indicator */}
      {isTrimming && (
        <div className={`absolute top-0 ${isTrimming === 'start' ? 'left-0' : 'right-0'} w-1 h-full bg-accent rounded opacity-80`} />
      )}
    </div>
  );
};