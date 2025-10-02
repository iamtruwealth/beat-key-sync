import React, { useEffect, useRef, useState } from 'react';
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
  trackSampleUrl?: string;
  sessionBpm?: number;
  onSave?: (trackId: string, data: any) => void;
}

export const PianoRoll: React.FC<PianoRollProps> = ({
  isOpen,
  onClose,
  trackId,
  trackName,
  trackMode,
  trackSampleUrl,
  sessionBpm = 120,
  onSave,
}) => {
  const { toast } = useToast();
  const synthRef = useRef<Tone.PolySynth | null>(null);
  const samplersRef = useRef<Map<number, Tone.Player>>(new Map());
  
  const {
    state,
    createTrack,
    setActiveTrack,
    addNote,
    addTrigger,
    deleteNote,
    deleteTrigger,
    updateNote,
    addSampleMapping,
    setSnapGrid,
    setZoom,
    togglePlayback,
    stopPlayback,
    selectNotes,
    clearSelection,
  } = usePianoRoll(sessionBpm);
  
  // Initialize Tone.js instruments and load track sample
  useEffect(() => {
    if (!isOpen) return;
    
    const loadTrackSample = async () => {
      if (trackMode === 'sample' && trackSampleUrl) {
        try {
          console.log('🎵 Loading track sample:', trackSampleUrl);
          
          // Start audio context if needed
          if (Tone.getContext().state !== 'running') {
            await Tone.start();
          }

          // Fetch and decode the sample
          const response = await fetch(trackSampleUrl);
          const arrayBuffer = await response.arrayBuffer();
          const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
          
          // Root note is D#4 (MIDI 63) - sample plays at normal pitch here
          const rootPitch = 63; // D#4
          const startPitch = 39; // D#2 (2 octaves below)
          const endPitch = 87; // D#6 (2 octaves above)
          
          // Clear existing samples
          samplersRef.current.forEach(player => player.dispose());
          samplersRef.current.clear();
          
          // Create player for each key with pitch shifting relative to D#4
          for (let pitch = startPitch; pitch <= endPitch; pitch++) {
            const player = new Tone.Player(audioBuffer).toDestination();
            // Calculate pitch shift relative to D#4 (63)
            const semitoneShift = pitch - rootPitch;
            player.playbackRate = Math.pow(2, semitoneShift / 12);
            samplersRef.current.set(pitch, player);
            
            // Add to sample mappings
            addSampleMapping(trackId, {
              pitch,
              sampleId: trackName,
              sampleName: pitch === rootPitch ? `${trackName} (Root)` : trackName,
              audioBuffer,
            });
          }
          
          toast({
            title: "Sample Loaded",
            description: `${trackName} loaded - D#4 is root note`,
          });
        } catch (error) {
          console.error('Failed to load track sample:', error);
          toast({
            title: "Error",
            description: "Failed to load track sample",
            variant: "destructive",
          });
        }
      } else if (trackMode === 'midi') {
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
    };
    
    loadTrackSample();
    
    return () => {
      if (synthRef.current) {
        synthRef.current.dispose();
        synthRef.current = null;
      }
      samplersRef.current.forEach(player => player.dispose());
      samplersRef.current.clear();
    };
  }, [trackMode, isOpen, trackSampleUrl, trackName, trackId, toast, addSampleMapping]);

  // Initialize track on open
  useEffect(() => {
    if (isOpen) {
      // Check if track exists, if not create it bound to external trackId
      if (!state.tracks[trackId]) {
        createTrack(trackName, trackMode, trackId);
      }
      setActiveTrack(trackId);
    }
  }, [isOpen, trackId, trackName, trackMode, state.tracks, createTrack, setActiveTrack]);

  const [toolMode, setToolMode] = useState<'draw' | 'select'>('draw');

  const activeTrack = state.tracks[trackId];

  const handleAddNote = (pitch: number, startTime: number) => {
    if (!trackId) return;
    
    console.log('🎹 handleAddNote called', { trackMode, pitch, startTime });
    
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
        duration: 1, // Default 1 beat duration
      });
    }
  };

  // Load sample for a pitch
  const handleLoadSample = async (pitch: number) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'audio/*';
    
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      try {
        // Start audio context if needed
        if (Tone.getContext().state !== 'running') {
          await Tone.start();
        }

        const arrayBuffer = await file.arrayBuffer();
        const audioBuffer = await Tone.getContext().decodeAudioData(arrayBuffer);
        
        // Create a new player for this pitch
        const player = new Tone.Player(audioBuffer).toDestination();
        
        // Remove old player if exists
        const oldPlayer = samplersRef.current.get(pitch);
        if (oldPlayer) {
          oldPlayer.dispose();
        }
        
        samplersRef.current.set(pitch, player);
        
        // Update sample mapping in state
        addSampleMapping(trackId, {
          pitch,
          sampleId: file.name,
          sampleName: file.name,
          audioBuffer,
        });

        toast({
          title: "Sample Loaded",
          description: `${file.name} mapped to key ${pitch}`,
        });
        
        // Play the sample as preview
        player.start();
      } catch (error) {
        console.error('Failed to load sample:', error);
        toast({
          title: "Error",
          description: "Failed to load sample",
          variant: "destructive",
        });
      }
    };
    
    input.click();
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
        // Auto-prompt to load a sample
        handleLoadSample(pitch);
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
            toolMode={toolMode}
            onTogglePlayback={togglePlayback}
            onStop={stopPlayback}
            onSnapGridChange={setSnapGrid}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onToolModeChange={setToolMode}
          />
          
          <div className="flex flex-1 overflow-hidden">
            <PianoRollKeyboard
              startNote={39}
              endNote={87}
              noteHeight={20}
              onKeyClick={handleKeyClick}
              onKeyRightClick={handleLoadSample}
              sampleMappings={trackMode === 'sample' ? sampleMappings : undefined}
            />
            
            <PianoRollGrid
              mode={trackMode}
              notes={activeTrack?.notes || []}
              triggers={activeTrack?.triggers || []}
              snapGrid={state.snapGrid}
              startNote={39}
              endNote={87}
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
              toolMode={toolMode}
            />
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
