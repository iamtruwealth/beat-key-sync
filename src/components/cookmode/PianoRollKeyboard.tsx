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
    <div ref={containerRef} onScroll={onScroll} className={cn("w-20 border-r border-border bg-background flex flex-col overflow-y-auto", className)}>
      {notes.map((pitch) => {
        const isBlack = isBlackKey(pitch);
        const isHighlighted = highlightedKeys.includes(pitch);
        const hasSample = pitch in sampleMappings;
        const isC = pitch % 12 === 0;

        return (
          <div
            key={pitch}
            className={cn(
              "flex items-center justify-between px-2 border-b border-border cursor-pointer transition-colors",
              isBlack ? "bg-muted text-muted-foreground" : "bg-background text-foreground",
              isHighlighted && "bg-primary/20",
              hasSample && "bg-accent/30",
              "hover:bg-accent/50"
            )}
            style={{ height: `${noteHeight}px` }}
            onClick={() => onKeyClick?.(pitch)}
            onContextMenu={(e) => {
              e.preventDefault();
              onKeyRightClick?.(pitch);
            }}
            title={hasSample ? `${getNoteName(pitch)} - ${sampleMappings[pitch]}` : `${getNoteName(pitch)} - Right-click to load sample`}
          >
            <span className={cn("text-xs font-mono", isC && "font-bold")}>
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
    </div>
  );
};
