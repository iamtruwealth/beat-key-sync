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

  const getStemColor = (stemType: string) => {
    const colors = {
      melody: 'text-neon-cyan',
      drums: 'text-electric-blue', 
      bass: 'text-neon-magenta',
      vocal: 'text-neon-cyan',
      fx: 'text-electric-blue',
      other: 'text-muted-foreground'
    };
    return colors[stemType as keyof typeof colors] || colors.other;
  };

  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="h-full flex flex-col bg-background/50">
      {/* Header */}
      <div className="p-4 border-b border-border/50 bg-card/20 backdrop-blur-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-foreground">Cook Mode DAW</h3>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {bpm} BPM
            </Badge>
            <Badge variant="outline" className="text-xs">
              {tracks.length} tracks
            </Badge>
          </div>
        </div>
      </div>

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
                onPlayPause={onPlayPause}
                onSeek={onSeek}
              />
            )}
          </TabsContent>

          <TabsContent value="mixer" className="h-full m-0">
            <div className="h-full overflow-auto p-4">
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
                <div className="space-y-2">
                  {tracks.map((track, index) => (
                    <Card key={track.id} className="bg-card/30 border-border/50 hover:bg-card/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          {/* Track Info */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-sm font-medium text-muted-foreground">
                                Track {index + 1}
                              </span>
                              <Badge variant="outline" className={`text-xs ${getStemColor(track.stem_type)}`}>
                                {track.stem_type}
                              </Badge>
                            </div>
                            <h4 className="font-medium text-foreground truncate">{track.name}</h4>
                            
                            {/* Waveform Placeholder */}
                            <div className="mt-3 h-12 bg-background/50 rounded border border-border/30 relative overflow-hidden">
                              <div className="absolute inset-0 flex items-center justify-center">
                                <BarChart3 className="w-6 h-6 text-muted-foreground/50" />
                              </div>
                              {/* Progress indicator */}
                              {isPlaying && (
                                <div 
                                  className="absolute top-0 bottom-0 bg-neon-cyan/30 transition-all duration-100"
                                  style={{ 
                                    width: `${Math.min((currentTime / (track.duration || 60)) * 100, 100)}%` 
                                  }}
                                />
                              )}
                            </div>
                          </div>

                          {/* Controls */}
                          <div className="flex items-center gap-2">
                            {/* Volume */}
                            <div className="w-20">
                              <Slider
                                value={[track.volume * 100]}
                                onValueChange={(value) => handleVolumeChange(track.id, value[0])}
                                max={100}
                                step={1}
                                className="w-full"
                              />
                            </div>

                            {/* Mute */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleMute(track.id)}
                              className={`p-2 ${track.isMuted ? 'text-red-500' : 'text-muted-foreground'}`}
                            >
                              {track.isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                            </Button>

                            {/* Solo */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleSolo(track.id)}
                              className={`p-2 ${track.isSolo ? 'text-neon-cyan' : 'text-muted-foreground'}`}
                            >
                              <Headphones className="w-4 h-4" />
                            </Button>

                            {/* Delete */}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => onRemoveTrack(track.id)}
                              className="p-2 text-red-400 hover:text-red-300"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}

                  {/* Add Track Button */}
                  <Dialog open={isAddingTrack} onOpenChange={setIsAddingTrack}>
                    <DialogTrigger asChild>
                      <Card className="bg-card/10 border-border/30 border-dashed hover:bg-card/20 transition-colors cursor-pointer">
                        <CardContent className="p-4">
                          <div className="flex items-center justify-center gap-2 text-muted-foreground">
                            <Plus className="w-4 h-4" />
                            <span>Add Track</span>
                          </div>
                        </CardContent>
                      </Card>
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
                </div>
              )}
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};