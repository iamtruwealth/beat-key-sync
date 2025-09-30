/**
 * Cook Mode Audio Controls
 * UI controls for the Cook Mode Audio Engine
 */

import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { 
  Play, 
  Square, 
  Circle, 
  Mic, 
  Upload, 
  Music, 
  Volume2,
  Piano,
  Undo,
  Plus
} from 'lucide-react';
import { useCookModeAudio } from '@/hooks/useCookModeAudio';
import { undoManager } from '@/lib/UndoManager';

interface CookModeAudioControlsProps {
  className?: string;
  canEdit?: boolean;
}

export const CookModeAudioControls: React.FC<CookModeAudioControlsProps> = ({
  className = "",
  canEdit = true
}) => {
  const {
    tracks,
    midiDevices,
    isRecording,
    isInitialized,
    hasMidiDevices,
    lastMidiEvent,
    isAudioRecordingSupported,
    createTrack,
    loadSample,
    triggerSample,
    startRecording,
    stopRecording,
    playbackRecording,
    recordAudioInput
  } = useCookModeAudio(canEdit);

  const [newTrackName, setNewTrackName] = useState('');
  const [selectedTrackId, setSelectedTrackId] = useState<string>('');
  const [recordingDuration, setRecordingDuration] = useState(10);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Handle file upload for samples
  const handleSampleUpload = (trackId: string) => {
    if (fileInputRef.current) {
      fileInputRef.current.onclick = null;
      fileInputRef.current.onchange = async (e) => {
        const files = (e.target as HTMLInputElement).files;
        if (files && files[0]) {
          try {
            await loadSample(trackId, files[0]);
          } catch (error) {
            console.error('Failed to load sample:', error);
          }
        }
      };
      fileInputRef.current.click();
    }
  };

  // Create new track
  const handleCreateTrack = () => {
    if (newTrackName.trim()) {
      const trackId = createTrack(newTrackName.trim());
      setSelectedTrackId(trackId);
      setNewTrackName('');
    }
  };

  // Record audio input
  const handleRecordAudio = async () => {
    if (!selectedTrackId) return;
    
    try {
      await recordAudioInput(selectedTrackId, recordingDuration * 1000);
    } catch (error) {
      console.error('Failed to record audio:', error);
    }
  };

  // Test sample trigger
  const handleTestSample = (trackId: string) => {
    triggerSample(trackId, 60, 100); // Middle C, medium velocity
  };

  if (!isInitialized) {
    return (
      <Card className={`${className}`}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="ml-2 text-muted-foreground">Initializing Audio Engine...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* MIDI Status */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Piano className="w-5 h-5" />
            MIDI Controllers
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {midiDevices.length === 0 ? (
              <div className="flex items-center gap-2 text-muted-foreground">
                <div className="w-2 h-2 rounded-full bg-red-500"></div>
                <span>No MIDI controllers detected</span>
              </div>
            ) : (
              midiDevices.map((device) => (
                <div key={device.id} className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    device.connected ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm">{device.name}</span>
                  <Badge variant={device.connected ? 'default' : 'secondary'}>
                    {device.connected ? 'Connected' : 'Disconnected'}
                  </Badge>
                </div>
              ))
            )}
            
            {lastMidiEvent && (
              <div className="mt-2 p-2 bg-muted rounded text-xs">
                Last MIDI: Note {lastMidiEvent.note}, Velocity {lastMidiEvent.velocity}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Track Management */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Music className="w-5 h-5" />
            Tracks ({tracks.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Create New Track */}
          <div className="flex gap-2">
            <Input
              placeholder="Track name"
              value={newTrackName}
              onChange={(e) => setNewTrackName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handleCreateTrack();
                }
              }}
            />
            <Button onClick={handleCreateTrack} disabled={!newTrackName.trim()}>
              <Plus className="w-4 h-4 mr-2" />
              Create
            </Button>
          </div>

          <Separator />

          {/* Track List */}
          <div className="space-y-2">
            {tracks.length === 0 ? (
              <p className="text-muted-foreground text-sm">No tracks created yet</p>
            ) : (
              tracks.map((track) => (
                <div
                  key={track.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                    selectedTrackId === track.id 
                      ? 'border-primary bg-primary/5' 
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => setSelectedTrackId(track.id)}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div 
                        className="w-3 h-3 rounded-full"
                        style={{ backgroundColor: track.color }}
                      ></div>
                      <span className="font-medium">{track.name}</span>
                      {track.sample && (
                        <Badge variant="secondary" className="text-xs">
                          Sample Loaded
                        </Badge>
                      )}
                    </div>
                    
                    <div className="flex gap-1">
                      {track.sample && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTestSample(track.id);
                          }}
                        >
                          <Play className="w-3 h-3" />
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSampleUpload(track.id);
                        }}
                      >
                        <Upload className="w-3 h-3" />
                      </Button>
                    </div>
                  </div>
                  
                  {track.recordedNotes.length > 0 && (
                    <div className="mt-2 text-xs text-muted-foreground">
                      {track.recordedNotes.length} recorded notes
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>

      {/* Recording Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Circle className="w-5 h-5" />
            Recording
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* MIDI Recording */}
          <div className="space-y-2">
            <Label>MIDI Recording</Label>
            <div className="flex gap-2">
              <Button
                onClick={startRecording}
                disabled={isRecording || !hasMidiDevices}
                variant={isRecording ? "destructive" : "default"}
              >
                <Circle className="w-4 h-4 mr-2" />
                {isRecording ? 'Recording...' : 'Start MIDI Recording'}
              </Button>
              
              <Button
                onClick={stopRecording}
                disabled={!isRecording}
                variant="outline"
              >
                <Square className="w-4 h-4 mr-2" />
                Stop
              </Button>
              
              <Button
                onClick={playbackRecording}
                disabled={isRecording}
                variant="outline"
              >
                <Play className="w-4 h-4 mr-2" />
                Playback
              </Button>
            </div>
            
            {!hasMidiDevices && (
              <p className="text-xs text-muted-foreground">
                Connect a MIDI controller to enable MIDI recording
              </p>
            )}
          </div>

          <Separator />

          {/* Audio Recording */}
          {isAudioRecordingSupported && (
            <div className="space-y-2">
              <Label>Audio Input Recording</Label>
              <div className="flex gap-2 items-center">
                <Input
                  type="number"
                  min="1"
                  max="60"
                  value={recordingDuration}
                  onChange={(e) => setRecordingDuration(Number(e.target.value))}
                  className="w-20"
                />
                <span className="text-sm text-muted-foreground">seconds</span>
                
                <Button
                  onClick={handleRecordAudio}
                  disabled={!selectedTrackId}
                  variant="outline"
                >
                  <Mic className="w-4 h-4 mr-2" />
                  Record Audio
                </Button>
              </div>
              
              {!selectedTrackId && (
                <p className="text-xs text-muted-foreground">
                  Select a track to record audio
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Undo Controls */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2">
            <Undo className="w-5 h-5" />
            Undo Stack
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => undoManager.undo()}
              disabled={!undoManager.canUndo()}
              variant="outline"
            >
              <Undo className="w-4 h-4 mr-2" />
              Undo Last Action
            </Button>
            
            <Badge variant="secondary">
              {undoManager.getStackSize()} actions
            </Badge>
          </div>
          
          {undoManager.canUndo() && (
            <p className="text-xs text-muted-foreground mt-2">
              Last action: {undoManager.peekLastAction()?.description || 'Unknown'}
            </p>
          )}
        </CardContent>
      </Card>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="audio/*"
        style={{ display: 'none' }}
      />
    </div>
  );
};