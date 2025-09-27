import React, { useState, useCallback } from 'react';
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
  selectedClips: Set<string>;
  secondsPerBeat: number;
  onClipMove: (clipId: string, newStartTime: number) => void;
  onClipSelect: (clipId: string, event: React.MouseEvent) => void;
  onClipDoubleClick: (clipId: string) => void;
  className?: string;
}

export const DraggableClip: React.FC<DraggableClipProps> = ({
  clip,
  currentTime,
  isPlaying,
  pixelsPerSecond,
  trackHeight,
  selectedClips,
  secondsPerBeat,
  onClipMove,
  onClipSelect,
  onClipDoubleClick,
  className = ""
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartX, setDragStartX] = useState(0);
  const [dragStartTime, setDragStartTime] = useState(0);

  const clipDuration = clip.endTime - clip.startTime;
  const clipWidth = clipDuration * pixelsPerSecond;
  const clipLeft = clip.startTime * pixelsPerSecond;

  // Grid snapping function
  const snapToGrid = useCallback((time: number): number => {
    const beatTime = secondsPerBeat;
    return Math.round(time / beatTime) * beatTime;
  }, [secondsPerBeat]);

  const handleMouseDown = useCallback((event: React.MouseEvent) => {
    if (event.button !== 0) return; // Only handle left mouse button
    
    event.preventDefault();
    event.stopPropagation();
    
    setIsDragging(true);
    setDragStartX(event.clientX);
    setDragStartTime(clip.startTime);
    
    // Select the clip
    onClipSelect(clip.id, event);
  }, [clip.id, clip.startTime, onClipSelect]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isDragging) return;
    
    const deltaX = event.clientX - dragStartX;
    const deltaTime = deltaX / pixelsPerSecond;
    const newStartTime = Math.max(0, snapToGrid(dragStartTime + deltaTime));
    
    // Update clip position
    onClipMove(clip.id, newStartTime);
  }, [isDragging, dragStartX, dragStartTime, pixelsPerSecond, snapToGrid, clip.id, onClipMove]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Attach global mouse events for dragging
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

  return (
    <div
      className={`absolute ${isDragging ? 'z-50 opacity-80' : 'z-10'} ${className}`}
      style={{
        left: clipLeft,
        width: clipWidth,
        height: trackHeight - 8,
        top: 4,
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}
    >
      <WaveformTrack
        clip={clip}
        containerId={`wave-${clip.id}`}
        currentTime={currentTime}
        isPlaying={isPlaying}
        pixelsPerSecond={pixelsPerSecond}
        trackHeight={trackHeight - 8}
        onClipClick={onClipSelect}
        onClipDoubleClick={onClipDoubleClick}
        className={selectedClips.has(clip.id) ? 'ring-2 ring-primary' : ''}
      />
      
      {/* Drag handle indicator */}
      {isDragging && (
        <div className="absolute inset-0 border-2 border-primary bg-primary/20 rounded pointer-events-none">
          <div className="absolute top-1 left-2 text-xs text-white font-bold">
            Moving...
          </div>
        </div>
      )}
    </div>
  );
};