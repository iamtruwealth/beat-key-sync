import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Settings, Plus, Minus, Music, Play, Pause } from "lucide-react";
import { useAudio } from "@/contexts/AudioContext";

interface Beat {
  id: string;
  title: string;
  artist: string;
  duration: number;
  file_url: string;
  price_cents: number;
  is_free: boolean;
  genre?: string;
  bpm?: number;
  key?: string;
}

interface BeatPack {
  id: string;
  name: string;
  description?: string;
  artwork_url?: string;
}

interface BeatPackManagerProps {
  beatPack: BeatPack;
  onUpdate: () => void;
}

export function BeatPackManager({ beatPack, onUpdate }: BeatPackManagerProps) {
  const [open, setOpen] = useState(false);
  const [allBeats, setAllBeats] = useState<Beat[]>([]);
  const [packBeats, setPackBeats] = useState<Beat[]>([]);
  const [selectedBeats, setSelectedBeats] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();
  const { currentTrack, isPlaying, playTrack, pauseTrack } = useAudio();

  useEffect(() => {
    if (open) {
      fetchData();
    }
  }, [open]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get current user's beats
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Fetch all producer beats
      const { data: beatsData, error: beatsError } = await supabase
        .from('beats')
        .select('*')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false });

      if (beatsError) throw beatsError;

      // Fetch current pack beats
      const { data: packTracksData, error: packTracksError } = await supabase
        .from('beat_pack_tracks')
        .select('track_id')
        .eq('beat_pack_id', beatPack.id);

      if (packTracksError) throw packTracksError;

      const packBeatIds = packTracksData.map(pt => pt.track_id);
      const packedBeats = (beatsData || []).filter(beat => packBeatIds.includes(beat.id));
      const currentSelected = new Set(packBeatIds);

      setAllBeats(beatsData || []);
      setPackBeats(packedBeats);
      setSelectedBeats(currentSelected);
    } catch (error) {
      console.error('Error fetching beats:', error);
      toast({
        title: "Error",
        description: "Failed to load beats",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleBeatToggle = (beatId: string, isAdding: boolean) => {
    const newSelected = new Set(selectedBeats);
    if (isAdding) {
      newSelected.add(beatId);
    } else {
      newSelected.delete(beatId);
    }
    setSelectedBeats(newSelected);
  };

  const saveChanges = async () => {
    setLoading(true);
    try {
      // Get current pack tracks
      const { data: currentTracks, error: currentError } = await supabase
        .from('beat_pack_tracks')
        .select('track_id')
        .eq('beat_pack_id', beatPack.id);

      if (currentError) throw currentError;

      const currentTrackIds = new Set(currentTracks.map(t => t.track_id));
      const newTrackIds = new Set(selectedBeats);

      // Find tracks to add and remove
      const toAdd = Array.from(newTrackIds).filter(id => !currentTrackIds.has(id));
      const toRemove = Array.from(currentTrackIds).filter(id => !newTrackIds.has(id));

      // Remove tracks
      if (toRemove.length > 0) {
        const { error: removeError } = await supabase
          .from('beat_pack_tracks')
          .delete()
          .eq('beat_pack_id', beatPack.id)
          .in('track_id', toRemove);

        if (removeError) throw removeError;
      }

      // Add tracks
      if (toAdd.length > 0) {
        const insertsData = toAdd.map((trackId, index) => ({
          beat_pack_id: beatPack.id,
          track_id: trackId,
          position: Array.from(currentTrackIds).length + index
        }));

        const { error: addError } = await supabase
          .from('beat_pack_tracks')
          .insert(insertsData);

        if (addError) throw addError;
      }

      toast({
        title: "Success",
        description: "Beat pack updated successfully"
      });

      onUpdate();
      setOpen(false);
    } catch (error) {
      console.error('Error updating pack:', error);
      toast({
        title: "Error",
        description: "Failed to update beat pack",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePlayBeat = (beat: Beat) => {
    const audioTrack = {
      id: beat.id,
      title: beat.title,
      artist: beat.artist || 'Unknown Artist',
      file_url: beat.file_url,
      duration: beat.duration,
    };

    if (currentTrack?.id === beat.id && isPlaying) {
      pauseTrack();
    } else {
      playTrack(audioTrack);
    }
  };

  const formatPrice = (cents: number) => {
    return (cents / 100).toFixed(2);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Settings className="w-4 h-4 mr-2" />
          Manage Beats
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Manage "{beatPack.name}" Beat Pack</DialogTitle>
        </DialogHeader>
        
        <div className="grid grid-cols-2 gap-6 h-full overflow-hidden">
          {/* Available Beats */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">Your Beats</h3>
            <div className="h-96 overflow-y-auto space-y-2">
              {allBeats.map((beat) => {
                const isSelected = selectedBeats.has(beat.id);
                const isCurrentlyPlaying = currentTrack?.id === beat.id && isPlaying;
                
                return (
                  <Card key={beat.id} className={`transition-all ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                    <CardContent className="p-3">
                      <div className="flex items-center gap-3">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={(checked) => handleBeatToggle(beat.id, !!checked)}
                        />
                        
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handlePlayBeat(beat)}
                          className="h-8 w-8 flex-shrink-0"
                        >
                          {isCurrentlyPlaying ? (
                            <Pause className="w-4 h-4" />
                          ) : (
                            <Play className="w-4 h-4" />
                          )}
                        </Button>

                        <div className="flex-1 min-w-0">
                          <p className="font-medium truncate">{beat.title}</p>
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {beat.genre && <span>{beat.genre}</span>}
                            {beat.bpm && <span>• {beat.bpm} BPM</span>}
                            {beat.key && <span>• {beat.key}</span>}
                          </div>
                        </div>

                        <div className="text-right">
                          <Badge variant={beat.is_free ? "secondary" : "default"}>
                            {beat.is_free ? 'FREE' : `$${formatPrice(beat.price_cents)}`}
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>

          {/* Current Pack Beats */}
          <div className="space-y-4">
            <h3 className="text-lg font-semibold">In This Pack ({selectedBeats.size})</h3>
            <div className="h-96 overflow-y-auto space-y-2">
              {allBeats
                .filter(beat => selectedBeats.has(beat.id))
                .map((beat) => {
                  const isCurrentlyPlaying = currentTrack?.id === beat.id && isPlaying;
                  
                  return (
                    <Card key={beat.id} className="border-primary/50">
                      <CardContent className="p-3">
                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePlayBeat(beat)}
                            className="h-8 w-8 flex-shrink-0"
                          >
                            {isCurrentlyPlaying ? (
                              <Pause className="w-4 h-4" />
                            ) : (
                              <Play className="w-4 h-4" />
                            )}
                          </Button>

                          <div className="flex-1 min-w-0">
                            <p className="font-medium truncate">{beat.title}</p>
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              {beat.genre && <span>{beat.genre}</span>}
                              {beat.bpm && <span>• {beat.bpm} BPM</span>}
                              {beat.key && <span>• {beat.key}</span>}
                            </div>
                          </div>

                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleBeatToggle(beat.id, false)}
                            className="h-8 w-8 text-destructive hover:text-destructive"
                          >
                            <Minus className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button onClick={saveChanges} disabled={loading}>
            {loading ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}