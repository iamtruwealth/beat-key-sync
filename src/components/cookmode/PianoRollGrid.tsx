import React, { useRef, useState, useCallback, useEffect } from 'react';
import { PianoRollNote, SampleTrigger, TrackMode, SnapGridValue } from '@/types/pianoRoll';
import { cn } from '@/lib/utils';

interface PianoRollGridProps {
  mode: TrackMode;
  notes: PianoRollNote[];
  triggers: SampleTrigger[];
  snapGrid: SnapGridValue;
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
  snapGrid,
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
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0, noteStartTime: 0, notePitch: 0 });
  const [resizingNoteId, setResizingNoteId] = useState<string | null>(null);
  const [resizeStartWidth, setResizeStartWidth] = useState(0);

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

  // Handle grid click to add note/trigger (left click)
  const handleGridClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const target = e.target as HTMLElement;
    // Ignore if clicking on a note/trigger or resize handle
    if (target?.dataset?.role === 'note' || target?.dataset?.role === 'resize') return;

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

  // Handle note right-click (delete)
  const handleNoteRightClick = useCallback((e: React.MouseEvent, noteId: string) => {
    e.preventDefault();
    e.stopPropagation();
    
    if (mode === 'midi') {
      onDeleteNote?.(noteId);
    } else {
      onDeleteTrigger?.(noteId);
    }
  }, [mode, onDeleteNote, onDeleteTrigger]);

  // Handle note drag start
  const handleNoteDragStart = useCallback((e: React.MouseEvent, noteId: string, note: PianoRollNote | SampleTrigger) => {
    e.stopPropagation();
    setIsDragging(true);
    setDraggedNoteId(noteId);

    // Select the note when dragging starts
    onSelectNotes?.([noteId]);

    setDragStartPos({
      x: e.clientX,
      y: e.clientY,
      noteStartTime: note.startTime,
      notePitch: note.pitch,
    });
  }, [onSelectNotes]);

  // Handle resize start
  const handleResizeStart = useCallback((e: React.MouseEvent, noteId: string, currentDuration: number) => {
    e.stopPropagation();
    setResizingNoteId(noteId);
    setResizeStartWidth(currentDuration);
    setDragStartPos({ x: e.clientX, y: e.clientY, noteStartTime: 0, notePitch: 0 });

    // Select note when resize starts
    onSelectNotes?.([noteId]);
  }, [onSelectNotes]);

  // Handle mouse move
  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!gridRef.current) return;
    const rect = gridRef.current.getBoundingClientRect();
    
    if (isDragging && draggedNoteId) {
      const deltaX = e.clientX - dragStartPos.x;
      const deltaY = e.clientY - dragStartPos.y;
      
      const deltaTime = deltaX / beatWidth;
      const deltaPitch = -Math.round(deltaY / noteHeight);
      
      const newStartTime = Math.max(0, dragStartPos.noteStartTime + deltaTime);
      const newPitch = Math.max(startNote, Math.min(endNote, dragStartPos.notePitch + deltaPitch));
      
      onUpdateNote?.(draggedNoteId, {
        startTime: newStartTime,
        pitch: newPitch,
      });
    } else if (resizingNoteId) {
      const deltaX = e.clientX - dragStartPos.x;
      const deltaTime = deltaX / beatWidth;
      const newDuration = Math.max(0.25, resizeStartWidth + deltaTime);
      
      onUpdateNote?.(resizingNoteId, {
        duration: newDuration,
      });
    }
  }, [isDragging, draggedNoteId, resizingNoteId, dragStartPos, beatWidth, noteHeight, startNote, endNote, resizeStartWidth, onUpdateNote]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDraggedNoteId(null);
    setResizingNoteId(null);
  }, []);

  // Add/remove mouse event listeners
  useEffect(() => {
    if (isDragging || resizingNoteId) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, resizingNoteId, handleMouseMove, handleMouseUp]);

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

  // Get subdivision amount based on snap grid
  const getSubdivision = useCallback((): number => {
    switch (snapGrid) {
      case 'none': return 1; // Show beat lines only
      case 'line': return 0.01; // Very fine
      case 'cell': return 0.25; // Quarter beat
      case '1/6-step': return 1/24; // 1/6 of 1/4 beat
      case '1/4-step': return 1/16;
      case '1/3-step': return 1/12;
      case '1/2-step': return 1/8;
      case '1-step': return 0.25;
      case '1/6-beat': return 1/6;
      case '1/4-beat': return 0.25;
      case '1/3-beat': return 1/3;
      case '1/2-beat': return 0.5;
      case '1-beat': return 1;
      case '1-bar': return beatsPerBar;
      default: return 0.25;
    }
  }, [snapGrid, beatsPerBar]);

  // Render grid lines
  const renderGridLines = () => {
    const lines = [];
    const subdivision = getSubdivision();

    // Vertical lines based on snap grid
    if (snapGrid === 'none') {
      // Only show bar lines
      for (let i = 0; i <= barsVisible; i++) {
        const x = i * beatsPerBar * beatWidth;
        lines.push(
          <line
            key={`v-bar-${i}`}
            x1={x}
            y1={0}
            x2={x}
            y2={gridHeight}
            stroke="currentColor"
            strokeWidth={2}
            className="text-border"
          />
        );
      }
    } else {
      // Calculate number of subdivisions
      const totalSubdivisions = Math.ceil(totalBeats / subdivision);
      
      for (let i = 0; i <= totalSubdivisions; i++) {
        const beatPosition = i * subdivision;
        const x = beatPosition * beatWidth;
        
        // Determine line importance
        const isBarLine = Math.abs(beatPosition % beatsPerBar) < 0.001;
        const isBeatLine = Math.abs(beatPosition % 1) < 0.001;
        const isQuarterBeat = Math.abs(beatPosition % 0.25) < 0.001;
        
        let strokeWidth = 1;
        let opacity = "text-border/20";
        
        if (isBarLine) {
          strokeWidth = 2;
          opacity = "text-border";
        } else if (isBeatLine) {
          strokeWidth = 1.5;
          opacity = "text-border/60";
        } else if (isQuarterBeat) {
          opacity = "text-border/40";
        }
        
        lines.push(
          <line
            key={`v-${i}`}
            x1={x}
            y1={0}
            x2={x}
            y2={gridHeight}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className={opacity}
          />
        );
      }
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
            data-role="note"
            onMouseDown={(e) => handleNoteDragStart(e, note.id, note)}
            onContextMenu={(e) => handleNoteRightClick(e, note.id)}
            style={{ pointerEvents: 'all' }}
          />
          {/* Resize handle */}
          <rect
            x={x + width - 4}
            y={y}
            width={8}
            height={noteHeight - 2}
            className="fill-primary-foreground cursor-ew-resize"
            opacity={isSelected ? 0.7 : 0.3}
            data-role="resize"
            onMouseDown={(e) => handleResizeStart(e, note.id, note.duration)}
            style={{ pointerEvents: 'all' }}
          />
        </g>
      );
    });
  };

  // Render triggers for sample mode (now with duration like notes)
  const renderTriggers = () => {
    return triggers.map(trigger => {
      const x = timeToPixel(trigger.startTime);
      const y = pitchToPixel(trigger.pitch);
      // For sample mode, we'll treat triggers like notes with a default duration if not set
      const duration = 'duration' in trigger ? trigger.duration : 1;
      const width = timeToPixel(duration);
      const isSelected = selectedNotes.includes(trigger.id);

      return (
        <g key={trigger.id}>
          <rect
            x={x}
            y={y}
            width={width}
            height={noteHeight - 2}
            className={cn(
              "cursor-move transition-colors",
              isSelected ? "fill-primary stroke-primary-foreground" : "fill-orange-500 stroke-orange-300",
              "hover:brightness-110"
            )}
            strokeWidth={2}
            rx={2}
            data-role="note"
            onMouseDown={(e) => handleNoteDragStart(e, trigger.id, trigger)}
            onContextMenu={(e) => handleNoteRightClick(e, trigger.id)}
            style={{ pointerEvents: 'all' }}
          />
          {/* Resize handle */}
          <rect
            x={x + width - 4}
            y={y}
            width={8}
            height={noteHeight - 2}
            className="fill-primary-foreground cursor-ew-resize"
            opacity={isSelected ? 0.7 : 0.3}
            data-role="resize"
            onMouseDown={(e) => handleResizeStart(e, trigger.id, duration)}
            style={{ pointerEvents: 'all' }}
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
    <div className="relative overflow-auto bg-background flex-1">
      <div
        ref={gridRef}
        className="relative cursor-crosshair min-h-full"
        style={{ width: `${gridWidth}px`, minHeight: `${gridHeight}px` }}
        onClick={handleGridClick}
      >
        <svg
          width={gridWidth}
          height={gridHeight}
          className="absolute inset-0"
        >
          {renderGridLines()}
          {mode === 'midi' ? renderNotes() : renderTriggers()}
          {renderPlayhead()}
        </svg>
      </div>
    </div>
  );
};
