import React from 'react';
import { cn } from '@/lib/utils';

interface PianoRollKeyboardProps {
  startNote?: number;
  endNote?: number;
  noteHeight?: number;
  onKeyClick?: (pitch: number) => void;
  onKeyRightClick?: (pitch: number) => void;
  highlightedKeys?: number[];
  sampleMappings?: Record<number, string>; // pitch -> sample name
  containerRef?: React.Ref<HTMLDivElement>;
  onScroll?: (e: React.UIEvent<HTMLDivElement>) => void;
  className?: string;
}

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

const isBlackKey = (pitch: number): boolean => {
  const note = pitch % 12;
  return [1, 3, 6, 8, 10].includes(note);
};

const getNoteName = (pitch: number): string => {
  const octave = Math.floor(pitch / 12) - 1;
  const note = NOTE_NAMES[pitch % 12];
  return `${note}${octave}`;
};

export const PianoRollKeyboard: React.FC<PianoRollKeyboardProps> = ({
  startNote = 0,
  endNote = 127,
  noteHeight = 20,
  onKeyClick,
  onKeyRightClick,
  highlightedKeys = [],
  sampleMappings = {},
  containerRef,
  onScroll,
  className,
}) => {
  const notes = Array.from({ length: endNote - startNote + 1 }, (_, i) => startNote + i).reverse();

  return (
    <div className={cn("w-32 border-r border-border bg-background flex flex-col flex-shrink-0 relative", className)}>
      {/* Render white keys first */}
      {notes.filter(pitch => !isBlackKey(pitch)).map((pitch, whiteKeyIndex) => {
        const isHighlighted = highlightedKeys.includes(pitch);
        const hasSample = pitch in sampleMappings;
        const isC = pitch % 12 === 0;
        const actualIndex = notes.indexOf(pitch);

        return (
          <div
            key={pitch}
            className={cn(
              "flex items-center justify-between px-2 cursor-pointer transition-colors relative",
              "bg-white text-black border-r border-gray-300",
              isHighlighted && "bg-primary/20",
              hasSample && "bg-accent/30",
              "hover:bg-gray-100"
            )}
            style={{ 
              height: `${noteHeight}px`,
              boxSizing: 'border-box',
              borderBottom: '1px solid hsl(var(--border))',
              boxShadow: 'inset 0 -1px 2px rgba(0,0,0,0.1)'
            }}
            onClick={() => onKeyClick?.(pitch)}
            onContextMenu={(e) => {
              e.preventDefault();
              onKeyRightClick?.(pitch);
            }}
            title={hasSample ? `${getNoteName(pitch)} - ${sampleMappings[pitch]}` : `${getNoteName(pitch)} - Right-click to load sample`}
          >
            <span className={cn("text-xs font-mono", isC && "font-bold text-primary")}>
              {getNoteName(pitch)}
            </span>
            {hasSample && (
              <span className="text-[10px] text-primary truncate max-w-[30px]" title={sampleMappings[pitch]}>
                ●
              </span>
            )}
          </div>
        );
      })}
      
      {/* Render black keys on top */}
      {notes.filter(pitch => isBlackKey(pitch)).map((pitch) => {
        const isHighlighted = highlightedKeys.includes(pitch);
        const hasSample = pitch in sampleMappings;
        const actualIndex = notes.indexOf(pitch);

        return (
          <div
            key={pitch}
            className={cn(
              "absolute left-0 flex items-center justify-start px-2 cursor-pointer transition-colors z-10",
              "bg-black text-white border border-white/20",
              isHighlighted && "bg-primary/60",
              hasSample && "bg-primary/40",
              "hover:bg-gray-800"
            )}
            style={{ 
              height: `${noteHeight}px`,
              width: '65%',
              top: `${actualIndex * noteHeight}px`,
              boxSizing: 'border-box',
              boxShadow: 'inset 0 -2px 4px rgba(0,0,0,0.5), 2px 2px 4px rgba(0,0,0,0.3)',
              pointerEvents: 'auto'
            }}
            onClick={() => onKeyClick?.(pitch)}
            onContextMenu={(e) => {
              e.preventDefault();
              onKeyRightClick?.(pitch);
            }}
            title={hasSample ? `${getNoteName(pitch)} - ${sampleMappings[pitch]}` : `${getNoteName(pitch)} - Right-click to load sample`}
          >
            <span className="text-[10px] font-mono font-bold">
              {getNoteName(pitch)}
            </span>
            {hasSample && (
              <span className="text-[8px] text-primary ml-1" title={sampleMappings[pitch]}>●</span>
            )}
          </div>
        );
      })}
    </div>
  );
};
