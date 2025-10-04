import React from 'react';
import { PianoRollNote, SampleTrigger } from '@/types/pianoRoll';

interface PianoRollNoteVisualizerProps {
  trackId: string;
  notes: PianoRollNote[];
  triggers: SampleTrigger[];
  mode: 'midi' | 'sample';
  bpm: number;
  pixelsPerSecond: number;
  currentTime: number;
  isPlaying: boolean;
}

export const PianoRollNoteVisualizer: React.FC<PianoRollNoteVisualizerProps> = ({
  notes,
  triggers,
  mode,
  bpm,
  pixelsPerSecond,
  currentTime,
  isPlaying,
}) => {
  const secondsPerBeat = 60 / bpm;

  // Convert beats to pixels
  const beatsToPixels = (beats: number) => {
    const seconds = beats * secondsPerBeat;
    return seconds * pixelsPerSecond;
  };

  // Get note color based on pitch (for visual variety)
  const getNoteColor = (pitch: number) => {
    const hue = (pitch * 7) % 360; // Spread colors across spectrum
    return `hsl(${hue}, 70%, 60%)`;
  };

  const items = mode === 'midi' ? notes : triggers;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {items.map((item) => {
        const startX = beatsToPixels(item.startTime);
        const width = beatsToPixels('duration' in item ? item.duration : 1);
        const color = getNoteColor(item.pitch);
        
        // Highlight active notes during playback
        const isActive = isPlaying && 
          currentTime >= item.startTime * secondsPerBeat && 
          currentTime <= (item.startTime + ('duration' in item ? item.duration : 1)) * secondsPerBeat;

        return (
          <div
            key={item.id}
            className="absolute h-full opacity-30 rounded-sm transition-opacity"
            style={{
              left: `${startX}px`,
              width: `${width}px`,
              backgroundColor: color,
              opacity: isActive ? 0.7 : 0.3,
              boxShadow: isActive ? `0 0 8px ${color}` : 'none',
            }}
          />
        );
      })}
    </div>
  );
};
