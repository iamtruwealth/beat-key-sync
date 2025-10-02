import React, { useRef, useState, useCallback, useEffect } from 'react';
import { PianoRollNote, SampleTrigger, TrackMode } from '@/types/pianoRoll';
import { cn } from '@/lib/utils';

interface PianoRollGridProps {
  mode: TrackMode;
  notes: PianoRollNote[];
  triggers: SampleTrigger[];
  startNote?: number;
  endNote?: number;
  noteHeight?: number;
  beatsPerBar?: number;
  barsVisible?: number;
  zoom?: number;
  currentTime?: number;
  selectedNotes?: string[];
  onAddNote?: (pitch: number, startTime: number) => void;
  onAddTrigger?: (pitch: number, startTime: number) => void;
  onDeleteNote?: (noteId: string) => void;
  onDeleteTrigger?: (triggerId: string) => void;
  onUpdateNote?: (noteId: string, updates: Partial<PianoRollNote>) => void;
  onSelectNotes?: (noteIds: string[]) => void;
  onClearSelection?: () => void;
}

export const PianoRollGrid: React.FC<PianoRollGridProps> = ({
  mode,
  notes,
  triggers,
  startNote = 0,
  endNote = 127,
  noteHeight = 20,
  beatsPerBar = 4,
  barsVisible = 16,
  zoom = 1,
  currentTime = 0,
  selectedNotes = [],
  onAddNote,
  onAddTrigger,
  onDeleteNote,
  onDeleteTrigger,
  onUpdateNote,
  onSelectNotes,
  onClearSelection,
}) => {
  const gridRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNoteId, setDraggedNoteId] = useState<string | null>(null);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [resizingNoteId, setResizingNoteId] = useState<string | null>(null);

  const totalNotes = endNote - startNote + 1;
  const totalBeats = barsVisible * beatsPerBar;
  const beatWidth = 80 * zoom;
  const gridWidth = totalBeats * beatWidth;
  const gridHeight = totalNotes * noteHeight;

  // Convert pixel position to musical time
  const pixelToTime = useCallback((x: number): number => {
    return Math.max(0, x / beatWidth);
  }, [beatWidth]);

  // Convert pixel Y position to pitch
  const pixelToPitch = useCallback((y: number): number => {
    const pitch = endNote - Math.floor(y / noteHeight);
    return Math.max(startNote, Math.min(endNote, pitch));
  }, [startNote, endNote, noteHeight]);

  // Convert time to pixel X position
  const timeToPixel = useCallback((time: number): number => {
    return time * beatWidth;
  }, [beatWidth]);

  // Convert pitch to pixel Y position
  const pitchToPixel = useCallback((pitch: number): number => {
    return (endNote - pitch) * noteHeight;
  }, [endNote, noteHeight]);

  // Handle grid click to add note/trigger
  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target !== gridRef.current) return; // Only handle clicks on grid background

    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return;

    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const time = pixelToTime(x);
    const pitch = pixelToPitch(y);

    if (mode === 'midi' && onAddNote) {
      onAddNote(pitch, time);
    } else if (mode === 'sample' && onAddTrigger) {
      onAddTrigger(pitch, time);
    }

    onClearSelection?.();
  }, [mode, pixelToTime, pixelToPitch, onAddNote, onAddTrigger, onClearSelection]);

  // Handle note click
  const handleNoteClick = useCallback((e: React.MouseEvent, noteId: string) => {
    e.stopPropagation();
    
    if (e.shiftKey) {
      // Multi-select
      const newSelection = selectedNotes.includes(noteId)
        ? selectedNotes.filter(id => id !== noteId)
        : [...selectedNotes, noteId];
      onSelectNotes?.(newSelection);
    } else {
      // Single select
      onSelectNotes?.([noteId]);
    }
  }, [selectedNotes, onSelectNotes]);

  // Handle note deletion
  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNotes.length > 0) {
      selectedNotes.forEach(noteId => {
        if (mode === 'midi') {
          onDeleteNote?.(noteId);
        } else {
          onDeleteTrigger?.(noteId);
        }
      });
      onClearSelection?.();
    }
  }, [selectedNotes, mode, onDeleteNote, onDeleteTrigger, onClearSelection]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  // Render grid lines
  const renderGridLines = () => {
    const lines = [];

    // Vertical lines (beats)
    for (let i = 0; i <= totalBeats; i++) {
      const x = i * beatWidth;
      const isBarLine = i % beatsPerBar === 0;
      lines.push(
        <line
          key={`v-${i}`}
          x1={x}
          y1={0}
          x2={x}
          y2={gridHeight}
          stroke="currentColor"
          strokeWidth={isBarLine ? 2 : 1}
          className={isBarLine ? "text-border" : "text-border/30"}
        />
      );
    }

    // Horizontal lines (notes)
    for (let i = 0; i <= totalNotes; i++) {
      const y = i * noteHeight;
      const pitch = endNote - i;
      const isC = pitch % 12 === 0;
      lines.push(
        <line
          key={`h-${i}`}
          x1={0}
          y1={y}
          x2={gridWidth}
          y2={y}
          stroke="currentColor"
          strokeWidth={1}
          className={isC ? "text-border" : "text-border/30"}
        />
      );
    }

    return lines;
  };

  // Render notes for MIDI mode
  const renderNotes = () => {
    return notes.map(note => {
      const x = timeToPixel(note.startTime);
      const y = pitchToPixel(note.pitch);
      const width = timeToPixel(note.duration);
      const isSelected = selectedNotes.includes(note.id);

      return (
        <g key={note.id}>
          <rect
            x={x}
            y={y}
            width={width}
            height={noteHeight - 2}
            className={cn(
              "cursor-move transition-colors",
              isSelected ? "fill-primary stroke-primary-foreground" : "fill-accent stroke-accent-foreground",
              "hover:brightness-110"
            )}
            strokeWidth={2}
            rx={2}
            onClick={(e) => handleNoteClick(e, note.id)}
          />
          {/* Resize handle */}
          {isSelected && (
            <rect
              x={x + width - 4}
              y={y}
              width={8}
              height={noteHeight - 2}
              className="fill-primary-foreground cursor-ew-resize"
              opacity={0.5}
            />
          )}
        </g>
      );
    });
  };

  // Render triggers for sample mode
  const renderTriggers = () => {
    return triggers.map(trigger => {
      const x = timeToPixel(trigger.startTime);
      const y = pitchToPixel(trigger.pitch);
      const isSelected = selectedNotes.includes(trigger.id);

      return (
        <g key={trigger.id}>
          <rect
            x={x - 4}
            y={y}
            width={8}
            height={noteHeight - 2}
            className={cn(
              "cursor-move transition-colors",
              isSelected ? "fill-primary stroke-primary-foreground" : "fill-orange-500 stroke-orange-300",
              "hover:brightness-110"
            )}
            strokeWidth={2}
            rx={2}
            onClick={(e) => handleNoteClick(e, trigger.id)}
          />
          {/* Visual indicator */}
          <line
            x1={x}
            y1={y}
            x2={x + 20}
            y2={y + noteHeight / 2}
            stroke="currentColor"
            strokeWidth={2}
            className="text-orange-500 opacity-50 pointer-events-none"
          />
        </g>
      );
    });
  };

  // Render playhead
  const renderPlayhead = () => {
    const x = timeToPixel(currentTime);
    return (
      <line
        x1={x}
        y1={0}
        x2={x}
        y2={gridHeight}
        stroke="currentColor"
        strokeWidth={2}
        className="text-primary pointer-events-none"
      />
    );
  };

  return (
    <div className="relative overflow-auto bg-background" style={{ height: '400px' }}>
      <div
        ref={gridRef}
        className="relative cursor-crosshair"
        style={{ width: `${gridWidth}px`, height: `${gridHeight}px` }}
        onClick={handleGridClick}
      >
        <svg
          width={gridWidth}
          height={gridHeight}
          className="absolute inset-0 pointer-events-none"
        >
          {renderGridLines()}
          {mode === 'midi' ? renderNotes() : renderTriggers()}
          {renderPlayhead()}
        </svg>
      </div>
    </div>
  );
};
