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
  trackIndex: number;
  secondsPerBeat: number;
  onClipMove: (clipId: string, newStartTime: number) => void;
  onClipResize?: (clipId: string, newEndTime: number) => void;
  onClipClick?: (clipId: string, event: React.MouseEvent) => void;
  onClipDoubleClick?: (clipId: string) => void;
  onDuplicateClip?: (clipId: string) => void;
  onDeleteClip?: (clipId: string) => void;
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
  onClipResize,
  onClipClick,
  onClipDoubleClick,
  onDuplicateClip,
  onDeleteClip,
  className = ""
}) => {
  const clipRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, startTime: 0 });
  const [resizeStart, setResizeStart] = useState({ x: 0, endTime: 0 });

  const clipWidth = (clip.endTime - clip.startTime) * pixelsPerSecond;
  const clipLeft = clip.startTime * pixelsPerSecond;

  // Grid snapping function
  const snapToGrid = useCallback((time: number): number => {
    return Math.round(time / secondsPerBeat) * secondsPerBeat;
  }, [secondsPerBeat]);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return; // Only left click
    
    e.preventDefault();
    e.stopPropagation();
    
    setIsResizing(true);
    setResizeStart({
      x: e.clientX,
      endTime: clip.endTime
    });
    
    // Prevent text selection during resize
    document.body.style.userSelect = 'none';
  }, [clip.endTime]);

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

  // Handle mouse move during drag/resize
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (isDragging) {
      const deltaX = e.clientX - dragStart.x;
      const deltaTime = deltaX / pixelsPerSecond;
      const newStartTime = Math.max(0, dragStart.startTime + deltaTime);
      const snappedStartTime = snapToGrid(newStartTime);
      
      // Update clip position visually
      if (clipRef.current) {
        const newLeft = snappedStartTime * pixelsPerSecond;
        clipRef.current.style.left = `${newLeft}px`;
      }
    } else if (isResizing) {
      const deltaX = e.clientX - resizeStart.x;
      const deltaTime = deltaX / pixelsPerSecond;
      const newEndTime = Math.max(clip.startTime + 0.1, resizeStart.endTime + deltaTime);
      const snappedEndTime = snapToGrid(newEndTime);
      
      // Update clip width visually
      if (clipRef.current) {
        const newWidth = (snappedEndTime - clip.startTime) * pixelsPerSecond;
        clipRef.current.style.width = `${newWidth}px`;
      }
    }
  }, [isDragging, isResizing, dragStart, resizeStart, pixelsPerSecond, snapToGrid, clip.startTime]);

  // Handle mouse up to end dragging/resizing
  const handleMouseUp = useCallback((e: MouseEvent) => {
    if (isDragging) {
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
    } else if (isResizing) {
      setIsResizing(false);
      document.body.style.userSelect = '';
      
      const deltaX = e.clientX - resizeStart.x;
      const deltaTime = deltaX / pixelsPerSecond;
      const newEndTime = Math.max(clip.startTime + 0.1, resizeStart.endTime + deltaTime);
      const snappedEndTime = snapToGrid(newEndTime);
      
      // Only call onClipResize if size actually changed
      if (Math.abs(snappedEndTime - clip.endTime) > 0.01 && onClipResize) {
        onClipResize(clip.id, snappedEndTime);
      }
    }
  }, [isDragging, isResizing, dragStart, resizeStart, pixelsPerSecond, snapToGrid, clip.id, clip.startTime, clip.endTime, onClipMove, onClipResize]);

  // Add global mouse event listeners for dragging/resizing
  React.useEffect(() => {
    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, isResizing, handleMouseMove, handleMouseUp]);

  // Handle click events (only if not dragging/resizing)
  const handleClick = useCallback((event: React.MouseEvent) => {
    if (isDragging || isResizing) return;
    
    event.stopPropagation();
    if (onClipClick) {
      onClipClick(clip.id, event);
    }
  }, [isDragging, isResizing, onClipClick, clip.id]);

  const handleDoubleClick = useCallback((event: React.MouseEvent) => {
    if (isDragging || isResizing) return;
    
    event.stopPropagation();
    if (onClipDoubleClick) {
      onClipDoubleClick(clip.id);
    }
  }, [isDragging, isResizing, onClipDoubleClick, clip.id]);

  return (
    <div
      ref={clipRef}
      className={`absolute cursor-move ${className}`}
      style={{
        left: clipLeft,
        width: clipWidth,
        height: trackHeight - 8,
        top: 4,
        zIndex: isDragging || isResizing ? 1000 : 1
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
        className={`clip-hide-titles ${isDragging || isResizing ? 'opacity-80' : ''}`}
      />
      
      {/* Resize handle */}
      <div 
        className="absolute top-0 right-0 w-2 h-full cursor-ew-resize bg-primary/20 hover:bg-primary/40 transition-colors"
        onMouseDown={handleResizeStart}
        style={{ zIndex: 2 }}
      />
      
      {/* Drag handle indicator */}
      {isDragging && (
        <div className="absolute top-0 left-0 w-1 h-full bg-primary rounded-l opacity-80" />
      )}
      
      {/* Resize handle indicator */}
      {isResizing && (
        <div className="absolute top-0 right-0 w-1 h-full bg-accent rounded-r opacity-80" />
      )}
    </div>
  );
};