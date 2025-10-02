import React, { useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PianoRollToolbar } from './PianoRollToolbar';
import { PianoRollGrid } from './PianoRollGrid';
import { PianoRollKeyboard } from './PianoRollKeyboard';
import { usePianoRoll } from '@/hooks/usePianoRoll';
import { TrackMode } from '@/types/pianoRoll';
import { useToast } from '@/hooks/use-toast';
import * as Tone from 'tone';

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
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const samplersRef = useRef<Map<number, Tone.Player>>(new Map());
  
  // Initialize Tone.js instruments
  useEffect(() => {
    if (!isOpen) return;
    
    if (trackMode === 'midi') {
      if (!synthRef.current) {
        synthRef.current = new Tone.PolySynth(Tone.Synth, {
          oscillator: { type: 'triangle' },
          envelope: {
            attack: 0.005,
            decay: 0.1,
            sustain: 0.3,
            release: 1
          }
        }).toDestination();
        synthRef.current.volume.value = -10;
      }
    }
    
    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
        synthRef.current = null;
      }
      samplersRef.current.forEach(player => player.dispose());
      samplersRef.current.clear();
    };
  }, [trackMode, isOpen]);
  
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
    }
  };

  const handleKeyClick = async (pitch: number) => {
    // Start audio context if needed
    if (Tone.getContext().state !== 'running') {
      await Tone.start();
    }
    
    if (trackMode === 'sample') {
      // Check if we have a sample loaded for this pitch
      const sampler = samplersRef.current.get(pitch);
      if (sampler) {
        console.log(`🎵 Playing sample for pitch ${pitch}`);
        sampler.start();
      } else {
        console.log(`⚠️ No sample loaded for pitch ${pitch}`);
        toast({
          title: "No Sample",
          description: `No sample mapped to key ${pitch}. Load a sample first.`,
          variant: "default",
        });
      }
    } else {
      // Play MIDI note with Tone.js
      if (synthRef.current) {
        const noteName = Tone.Frequency(pitch, "midi").toNote();
        console.log(`🎹 Playing MIDI note: ${noteName} (${pitch})`);
        synthRef.current.triggerAttackRelease(noteName, "8n");
      }
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
              snapGrid={state.snapGrid}
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
