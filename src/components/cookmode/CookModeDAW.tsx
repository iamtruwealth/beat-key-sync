import React, { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Plus, 
  Volume2, 
  VolumeX, 
  Headphones, 
  Trash2, 
  Upload,
  BarChart3,
  Settings,
  Clock,
  Layers
} from 'lucide-react';
import { toast } from 'sonner';
import { TimelineView } from './TimelineView';
import { FuturisticMixerBoard } from './FuturisticMixerBoard';

interface Track {
  id: string;
  name: string;
  file_url: string;
  stem_type: string;
  uploaded_by: string;
  version_number: number;
  duration?: number;
  volume: number;
  isMuted: boolean;
  isSolo: boolean;
  waveformData?: number[];
}

interface CookModeDAWProps {
  tracks: Track[];
  isPlaying: boolean;
  currentTime: number;
  bpm: number;
  metronomeEnabled?: boolean;
  onAddTrack: (file: File, trackName: string, stemType: string) => Promise<void>;
  onRemoveTrack: (trackId: string) => Promise<void>;
  onUpdateTrack: (trackId: string, updates: Partial<Track>) => void;
  onPlayPause: () => void;
  onSeek: (time: number) => void;
  externalActiveView?: 'timeline' | 'mixer';
  onActiveViewChange?: (view: 'timeline' | 'mixer') => void;
}

export const CookModeDAW: React.FC<CookModeDAWProps> = ({
  tracks,
  isPlaying,
  currentTime,
  bpm,
  metronomeEnabled = false,
  onAddTrack,
  onRemoveTrack,
  onUpdateTrack,
  onPlayPause,
  onSeek,
  externalActiveView,
  onActiveViewChange
}) => {
  const [isAddingTrack, setIsAddingTrack] = useState(false);
  const [activeView, setActiveView] = useState<'timeline' | 'mixer'>('timeline');
  const [isDragOver, setIsDragOver] = useState(false);
  const [newTrackData, setNewTrackData] = useState({
    name: '',
    stemType: 'melody',
    file: null as File | null
  });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Controlled/uncontrolled view state
  const view = externalActiveView ?? activeView;
  const handleViewChange = (value: string) => {
    if (onActiveViewChange) onActiveViewChange(value as 'timeline' | 'mixer');
    else setActiveView(value as 'timeline' | 'mixer');
  };

  const stemTypes = [
    { value: 'melody', label: 'Melody' },
    { value: 'drums', label: 'Drums' },
    { value: 'bass', label: 'Bass' },
    { value: 'vocal', label: 'Vocal' },
    { value: 'fx', label: 'FX' },
    { value: 'other', label: 'Other' }
  ];

  const validateAudioFile = (file: File) => {
    const validTypes = ['audio/wav', 'audio/mp3', 'audio/mpeg', 'audio/ogg', 'audio/aac', 'audio/m4a'];
    if (!validTypes.includes(file.type)) {
      toast.error('Please select a valid audio file (WAV, MP3, OGG, AAC, M4A)');
      return false;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast.error('File size must be less than 50MB');
      return false;
    }

    return true;
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);

    const files = Array.from(e.dataTransfer.files);
    const audioFiles = files.filter(file => file.type.startsWith('audio/'));

    if (audioFiles.length === 0) {
      toast.error('Please drop audio files only');
      return;
    }

    for (const file of audioFiles) {
      if (validateAudioFile(file)) {
        const trackName = file.name.replace(/\.[^/.]+$/, "");
        try {
          await onAddTrack(file, trackName, 'other');
          toast.success(`Added "${trackName}" to session`);
        } catch (error) {
          toast.error(`Failed to add "${trackName}"`);
        }
      }
    }
  };

  // Global window-level drag and drop to ensure drops work anywhere in the timeline
  React.useEffect(() => {
    const onWindowDragOver = (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      setIsDragOver(true);
    };

    const onWindowDrop = async (e: DragEvent) => {
      if (!e.dataTransfer) return;
      e.preventDefault();
      setIsDragOver(false);

      const files = Array.from(e.dataTransfer.files || []);
      const audioFiles = files.filter(file => file.type.startsWith('audio/'));
      if (audioFiles.length === 0) return;

      for (const file of audioFiles) {
        if (validateAudioFile(file)) {
          const trackName = file.name.replace(/\.[^/.]+$/, "");
          try {
            await onAddTrack(file, trackName, 'other');
            toast.success(`Added "${trackName}" to session`);
          } catch (error) {
            toast.error(`Failed to add "${trackName}"`);
          }
        }
      }
    };

    window.addEventListener('dragover', onWindowDragOver);
    window.addEventListener('drop', onWindowDrop);

    return () => {
      window.removeEventListener('dragover', onWindowDragOver);
      window.removeEventListener('drop', onWindowDrop);
    };
  }, [onAddTrack]);

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && validateAudioFile(file)) {
      setNewTrackData(prev => ({ 
        ...prev, 
        file,
        name: prev.name || file.name.replace(/\.[^/.]+$/, "")
      }));
    }
  };

  const handleAddTrack = async () => {
    if (!newTrackData.file || !newTrackData.name) {
      toast.error('Please select a file and enter a track name');
      return;
    }

    try {
      await onAddTrack(newTrackData.file, newTrackData.name, newTrackData.stemType);
      setNewTrackData({ name: '', stemType: 'melody', file: null });
      setIsAddingTrack(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error) {
      console.error('Error adding track:', error);
    }
  };

  const handleVolumeChange = (trackId: string, volume: number) => {
    onUpdateTrack(trackId, { volume: volume / 100 });
  };

  const handleMute = (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      onUpdateTrack(trackId, { isMuted: !track.isMuted });
    }
  };

  const handleSolo = (trackId: string) => {
    const track = tracks.find(t => t.id === trackId);
    if (track) {
      onUpdateTrack(trackId, { isSolo: !track.isSolo });
    }
  };

  // Handle track deletions coming from TimelineView
  const handleTracksUpdateFromTimeline = async (updatedTracks: Track[]) => {
    const currentIds = new Set(tracks.map(t => t.id));
    const updatedIds = new Set(updatedTracks.map(t => t.id));

    // Tracks present before but not in updated list are deletions
    const removedIds = Array.from(currentIds).filter(id => !updatedIds.has(id));

    for (const id of removedIds) {
      try {
        await onRemoveTrack(id);
        toast.success('Track Deleted');
      } catch (err) {
        console.error('Failed to remove track from session:', err);
        toast.error('Failed to delete track');
      }
    }
  };
  
  const getStemColor = (stemType: string) => {
    const colors = {
      melody: 'text-neon-cyan',
      drums: 'text-electric-blue', 
      bass: 'text-neon-magenta',
      vocal: 'text-neon-cyan',
      fx: 'text-electric-blue',
      other: 'text-muted-foreground'
    } as const;
    return colors[stemType as keyof typeof colors] || colors.other;
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-background/50">
      {/* Content Area */}
      <div 
        className={`flex-1 overflow-hidden relative ${isDragOver ? 'bg-neon-cyan/5' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Drag overlay */}
        {isDragOver && (
          <div className="absolute inset-0 z-50 bg-background/80 backdrop-blur-sm border-2 border-dashed border-neon-cyan flex items-center justify-center">
            <div className="text-center">
              <Upload className="w-16 h-16 text-neon-cyan mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-neon-cyan mb-2">Drop Audio Files Here</h3>
              <p className="text-muted-foreground">WAV, MP3, OGG, AAC, M4A files supported</p>
            </div>
          </div>
        )}
        <Tabs value={view} onValueChange={handleViewChange}>
          <TabsContent value="timeline" className="h-full m-0">
            {tracks.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center p-8">
                  <Clock className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-foreground mb-2">No tracks in timeline</h4>
                  <p className="text-muted-foreground mb-4">Add your first track to see the arrangement view</p>
                  <div className="space-y-3">
                    <Dialog open={isAddingTrack} onOpenChange={setIsAddingTrack}>
                      <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-neon-cyan to-electric-blue text-black hover:opacity-90">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Track
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-card border-border/50">{/* ... dialog content ... */}
                      <DialogHeader>
                        <DialogTitle className="text-neon-cyan">Add New Track</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4">
                        <div className="space-y-2">
                          <Label htmlFor="trackFile">Audio File</Label>
                          <div className="flex items-center gap-2">
                            <Button
                              variant="outline"
                              onClick={() => fileInputRef.current?.click()}
                              className="border-border/50"
                            >
                              <Upload className="w-4 h-4 mr-2" />
                              Choose File
                            </Button>
                            <span className="text-sm text-muted-foreground">
                              {newTrackData.file?.name || 'No file selected'}
                            </span>
                          </div>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="audio/*"
                            onChange={handleFileSelect}
                            className="hidden"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label htmlFor="trackName">Track Name</Label>
                          <Input
                            id="trackName"
                            value={newTrackData.name}
                            onChange={(e) => setNewTrackData(prev => ({ ...prev, name: e.target.value }))}
                            placeholder="e.g., Main Melody"
                            className="bg-background/50 border-border/50"
                          />
                        </div>

                        <div className="space-y-2">
                          <Label>Stem Type</Label>
                          <Select 
                            value={newTrackData.stemType} 
                            onValueChange={(value) => setNewTrackData(prev => ({ ...prev, stemType: value }))}
                          >
                            <SelectTrigger className="bg-background/50 border-border/50">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              {stemTypes.map(type => (
                                <SelectItem key={type.value} value={type.value}>
                                  {type.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="flex gap-2 pt-4">
                          <Button
                            onClick={handleAddTrack}
                            className="flex-1 bg-gradient-to-r from-neon-cyan to-electric-blue text-black hover:opacity-90"
                            disabled={!newTrackData.file || !newTrackData.name}
                          >
                            Add Track
                          </Button>
                          <Button
                            variant="outline"
                            onClick={() => setIsAddingTrack(false)}
                            className="border-border/50"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    </DialogContent>
                    </Dialog>
                    <p className="text-xs text-muted-foreground">
                      or drag and drop audio files anywhere
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <TimelineView
                tracks={tracks}
                isPlaying={isPlaying}
                currentTime={currentTime}
                bpm={bpm}
                metronomeEnabled={metronomeEnabled}
                onPlayPause={onPlayPause}
                onSeek={onSeek}
                onTracksUpdate={handleTracksUpdateFromTimeline}
              />
            )}
          </TabsContent>

          <TabsContent value="mixer" className="h-full m-0">
            {tracks.length === 0 ? (
              <div className="h-full flex items-center justify-center">
                <div className="text-center p-8">
                  <Layers className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-foreground mb-2">No tracks in mixer</h4>
                  <p className="text-muted-foreground mb-4">Add tracks to start mixing</p>
                  <div className="space-y-3">
                    <Dialog open={isAddingTrack} onOpenChange={setIsAddingTrack}>
                      <DialogTrigger asChild>
                        <Button className="bg-gradient-to-r from-neon-cyan to-electric-blue text-black hover:opacity-90">
                          <Plus className="w-4 h-4 mr-2" />
                          Add Track
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-card border-border/50">
                        <DialogHeader>
                          <DialogTitle className="text-neon-cyan">Add New Track</DialogTitle>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="trackFile">Audio File</Label>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                onClick={() => fileInputRef.current?.click()}
                                className="border-border/50"
                              >
                                <Upload className="w-4 h-4 mr-2" />
                                Choose File
                              </Button>
                              <span className="text-sm text-muted-foreground">
                                {newTrackData.file?.name || 'No file selected'}
                              </span>
                            </div>
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="audio/*"
                              onChange={handleFileSelect}
                              className="hidden"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="trackName">Track Name</Label>
                            <Input
                              id="trackName"
                              value={newTrackData.name}
                              onChange={(e) => setNewTrackData(prev => ({ ...prev, name: e.target.value }))}
                              placeholder="e.g., Main Melody"
                              className="bg-background/50 border-border/50"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label>Stem Type</Label>
                            <Select 
                              value={newTrackData.stemType} 
                              onValueChange={(value) => setNewTrackData(prev => ({ ...prev, stemType: value }))}
                            >
                              <SelectTrigger className="bg-background/50 border-border/50">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {stemTypes.map(type => (
                                  <SelectItem key={type.value} value={type.value}>
                                    {type.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="flex gap-2 pt-4">
                            <Button
                              onClick={handleAddTrack}
                              className="flex-1 bg-gradient-to-r from-neon-cyan to-electric-blue text-black hover:opacity-90"
                              disabled={!newTrackData.file || !newTrackData.name}
                            >
                              Add Track
                            </Button>
                            <Button
                              variant="outline"
                              onClick={() => setIsAddingTrack(false)}
                              className="border-border/50"
                            >
                              Cancel
                            </Button>
                          </div>
                        </div>
                      </DialogContent>
                    </Dialog>
                    <p className="text-xs text-muted-foreground">
                      or drag and drop audio files anywhere
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <FuturisticMixerBoard
                tracks={tracks}
                onUpdateTrack={onUpdateTrack}
                onRemoveTrack={onRemoveTrack}
              />
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};