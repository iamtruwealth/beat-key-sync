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
  secondsPerBeat: number;
  onClipMove: (clipId: string, newStartTime: number) => void;
  onClipClick?: (clipId: string, event: React.MouseEvent) => void;
  onClipDoubleClick?: (clipId: string) => void;
  className?: string;
}

export const DraggableClip: React.FC<DraggableClipProps> = ({
  clip,
  currentTime,
  isPlaying,
  pixelsPerSecond,
  trackHeight,
  secondsPerBeat,
  onClipMove,
  onClipClick,
  onClipDoubleClick,
  className = ""
}) => {
  const clipRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, startTime: 0 });

  const clipWidth = (clip.endTime - clip.startTime) * pixelsPerSecond;
  const clipLeft = clip.startTime * pixelsPerSecond;

  // Grid snapping function
  const snapToGrid = useCallback((time: number): number => {
    return Math.round(time / secondsPerBeat) * secondsPerBeat;
  }, [secondsPerBeat]);

  // Handle mouse down to start dragging
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsDragging(true);
    setDragStart({
      x: e.clientX,
      startTime: clip.startTime
    });
    
    // Prevent text selection during drag
    document.body.style.userSelect = 'none';
  }, [clip.startTime]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = e.clientX - dragStart.x;
    const deltaTime = deltaX / pixelsPerSecond;
    const newStartTime = Math.max(0, dragStart.startTime + deltaTime);
    const snappedStartTime = snapToGrid(newStartTime);
    
    // Update clip position visually
    if (clipRef.current) {
      const newLeft = snappedStartTime * pixelsPerSecond;
      clipRef.current.style.left = `${newLeft}px`;
    }
  }, [isDragging, dragStart, pixelsPerSecond, snapToGrid]);

  // Handle mouse up to end dragging
  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (!isDragging) return;
    
    setIsDragging(false);
    document.body.style.userSelect = '';
    
    const deltaX = e.clientX - dragStart.x;
    const deltaTime = deltaX / pixelsPerSecond;
    const newStartTime = Math.max(0, dragStart.startTime + deltaTime);
    const snappedStartTime = snapToGrid(newStartTime);
    
    // Only call onClipMove if position actually changed
    if (Math.abs(snappedStartTime - clip.startTime) > 0.01) {
      onClipMove(clip.id, snappedStartTime);
    }
  }, [isDragging, dragStart, pixelsPerSecond, snapToGrid, clip.id, clip.startTime, onClipMove]);

  // Add global mouse event listeners for dragging
  React.useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Handle click events (only if not dragging)
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (isDragging) return;
    
    event.stopPropagation();
    if (onClipClick) {
      onClipClick(clip.id, event);
    }
  }, [isDragging, onClipClick, clip.id]);

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    if (isDragging) return;
    
    event.stopPropagation();
    if (onClipDoubleClick) {
      onClipDoubleClick(clip.id);
    }
  }, [isDragging, onClipDoubleClick, clip.id]);

  return (
    <div
      ref={clipRef}
      className={`absolute cursor-move ${className}`}
      style={{
        left: clipLeft,
        width: clipWidth,
        height: trackHeight - 8,
        top: 4,
        zIndex: isDragging ? 1000 : 1
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
        className={`clip-hide-titles ${isDragging ? 'opacity-80' : ''}`}
      />
      
      {/* Drag handle indicator */}
      {isDragging && (
        <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-l opacity-80" />
      )}
    </div>
  );
};