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
  startTime: number;
  endTime: number;
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
  onTrimClip?: (trackId: string, trimStart: number, trimEnd: number) => void;
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

  // Calculate trim values
  const track = clip.originalTrack;
  const trackDuration = track.analyzed_duration || track.duration || 0;
  const trimStart = track.trimStart || 0;
  const trimEnd = track.trimEnd || trackDuration;
  
  const clipWidth = (clip.endTime - clip.startTime) * pixelsPerSecond;
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
    
    setIsTrimming(trimType);
    setDragStart({
      x: e.clientX,
      startTime: trimType === 'start' ? trimStart : trimEnd
    });
    
    document.body.style.userSelect = 'none';
  }, [trimStart, trimEnd]);

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
    } else if (isTrimming && trackDuration > 0) {
      const newTime = Math.max(0, Math.min(trackDuration, dragStart.startTime + deltaTime));
      const snappedTime = snapToGrid(newTime);
      
      // Visual feedback for trimming (you could add visual indicators here)
      console.log(`Trimming ${isTrimming}: ${snappedTime.toFixed(2)}s`);
    }
  }, [isDragging, isTrimming, dragStart, pixelsPerSecond, snapToGrid, trackDuration]);

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
    } else if (isTrimming && onTrimClip && trackDuration > 0) {
      const newTime = Math.max(0, Math.min(trackDuration, dragStart.startTime + deltaTime));
      const snappedTime = snapToGrid(newTime);
      
      let newTrimStart = trimStart;
      let newTrimEnd = trimEnd;
      
      if (isTrimming === 'start') {
        newTrimStart = Math.min(snappedTime, trimEnd - 0.1); // Ensure start < end
      } else {
        newTrimEnd = Math.max(snappedTime, trimStart + 0.1); // Ensure end > start
      }
      
      if (Math.abs(newTrimStart - trimStart) > 0.01 || Math.abs(newTrimEnd - trimEnd) > 0.01) {
        onTrimClip(track.id, newTrimStart, newTrimEnd);
      }
      
      setIsTrimming(null);
    }
  }, [isDragging, isTrimming, dragStart, pixelsPerSecond, snapToGrid, clip.id, clip.startTime, onClipMove, track.id, trimStart, trimEnd, trackDuration, onTrimClip]);

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
            className="absolute left-0 top-0 w-2 h-full bg-primary/20 hover:bg-primary/40 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleTrimMouseDown(e, 'start')}
            style={{ zIndex: 1001 }}
          >
            <div className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-4 bg-primary rounded-r" />
          </div>
          
          {/* Right trim handle */}
          <div
            className="absolute right-0 top-0 w-2 h-full bg-primary/20 hover:bg-primary/40 cursor-ew-resize opacity-0 group-hover:opacity-100 transition-opacity"
            onMouseDown={(e) => handleTrimMouseDown(e, 'end')}
            style={{ zIndex: 1001 }}
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