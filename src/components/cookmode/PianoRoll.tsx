import React, { useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PianoRollToolbar } from './PianoRollToolbar';
import { PianoRollGrid } from './PianoRollGrid';
import { PianoRollKeyboard } from './PianoRollKeyboard';
import { usePianoRoll } from '@/hooks/usePianoRoll';
import { TrackMode } from '@/types/pianoRoll';
import { useToast } from '@/hooks/use-toast';
import { useCookModeAudio } from '@/hooks/useCookModeAudio';

interface PianoRollProps {
  isOpen: boolean;
  onClose: () => void;
  trackId: string;
  trackName: string;
  trackMode: TrackMode;
  sessionBpm?: number;
  onSave?: (trackId: string, data: any) => void;
}

export const PianoRoll: React.FC<PianoRollProps> = ({
  isOpen,
  onClose,
  trackId,
  trackName,
  trackMode,
  sessionBpm = 120,
  onSave,
}) => {
  const { toast } = useToast();
  const { triggerSample } = useCookModeAudio(true);
  
  const {
    state,
    createTrack,
    setActiveTrack,
    addNote,
    addTrigger,
    deleteNote,
    deleteTrigger,
    updateNote,
    setSnapGrid,
    setZoom,
    togglePlayback,
    stopPlayback,
    selectNotes,
    clearSelection,
  } = usePianoRoll(sessionBpm);

  // Initialize track on open
  useEffect(() => {
    if (isOpen) {
      // Check if track exists, if not create it
      if (!state.tracks[trackId]) {
        createTrack(trackName, trackMode);
      }
      setActiveTrack(trackId);
    }
  }, [isOpen, trackId, trackName, trackMode, state.tracks, createTrack, setActiveTrack]);

  const activeTrack = state.tracks[trackId];

  const handleAddNote = (pitch: number, startTime: number) => {
    if (!trackId) return;
    
    if (trackMode === 'midi') {
      addNote(trackId, {
        pitch,
        startTime,
        duration: 1, // Default 1 beat duration
        velocity: 100,
      });
    } else {
      addTrigger(trackId, {
        pitch,
        startTime,
        velocity: 100,
      });
      
      // Trigger sample preview
      triggerSample(trackId, pitch, 100);
    }
  };

  const handleKeyClick = (pitch: number) => {
    if (trackMode === 'sample') {
      // Preview sample
      triggerSample(trackId, pitch, 100);
    } else {
      // Play MIDI note preview (could be implemented with Tone.js)
      toast({
        title: "MIDI Preview",
        description: `Note: ${pitch}`,
      });
    }
  };

  const handleZoomIn = () => {
    setZoom(state.zoom + 0.25);
  };

  const handleZoomOut = () => {
    setZoom(state.zoom - 0.25);
  };

  const handleClose = () => {
    // Save track data before closing
    if (activeTrack && onSave) {
      onSave(trackId, {
        notes: activeTrack.notes,
        triggers: activeTrack.triggers,
        sampleMappings: activeTrack.sampleMappings,
      });
    }
    onClose();
  };

  const sampleMappings = activeTrack?.sampleMappings.reduce((acc, mapping) => {
    acc[mapping.pitch] = mapping.sampleName;
    return acc;
  }, {} as Record<number, string>) || {};

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-[90vw] h-[80vh] p-0">
        <DialogHeader className="px-4 pt-4 pb-2">
          <DialogTitle className="flex items-center gap-2">
            Piano Roll - {trackName}
            <span className="text-sm text-muted-foreground">
              ({trackMode === 'midi' ? 'MIDI' : 'Sample'} Mode)
            </span>
          </DialogTitle>
        </DialogHeader>
        
        <div className="flex flex-col h-full">
          <PianoRollToolbar
            isPlaying={state.isPlaying}
            snapGrid={state.snapGrid}
            zoom={state.zoom}
            onTogglePlayback={togglePlayback}
            onStop={stopPlayback}
            onSnapGridChange={setSnapGrid}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
          />
          
          <div className="flex flex-1 overflow-hidden">
            <PianoRollKeyboard
              startNote={24}
              endNote={96}
              noteHeight={20}
              onKeyClick={handleKeyClick}
              sampleMappings={trackMode === 'sample' ? sampleMappings : undefined}
            />
            
            <PianoRollGrid
              mode={trackMode}
              notes={activeTrack?.notes || []}
              triggers={activeTrack?.triggers || []}
              startNote={24}
              endNote={96}
              noteHeight={20}
              beatsPerBar={4}
              barsVisible={16}
              zoom={state.zoom}
              currentTime={state.currentTime}
              selectedNotes={state.selectedNotes}
              onAddNote={trackMode === 'midi' ? handleAddNote : undefined}
              onAddTrigger={trackMode === 'sample' ? handleAddNote : undefined}
              onDeleteNote={trackMode === 'midi' ? (id) => deleteNote(trackId, id) : undefined}
              onDeleteTrigger={trackMode === 'sample' ? (id) => deleteTrigger(trackId, id) : undefined}
              onUpdateNote={(id, updates) => updateNote(trackId, id, updates)}
              onSelectNotes={selectNotes}
              onClearSelection={clearSelection}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
