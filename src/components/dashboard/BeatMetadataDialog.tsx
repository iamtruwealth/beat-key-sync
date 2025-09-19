import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, DollarSign } from "lucide-react";

type Track = Tables<"tracks">;
type BeatPack = Tables<"beat_packs">;

interface TrackMetadataDialogProps {
  track: Track & { is_beat?: boolean } | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTrackUpdated: (updatedTrack: Track) => void;
}

const musicalKeys = [
  "C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B",
  "Cm", "C#m", "Dm", "D#m", "Em", "Fm", "F#m", "Gm", "G#m", "Am", "A#m", "Bm"
];

export function TrackMetadataDialog({ track, open, onOpenChange, onTrackUpdated }: TrackMetadataDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [beatPacks, setBeatPacks] = useState<BeatPack[]>([]);
  const [formData, setFormData] = useState({
    title: "",
    artist: "",
    manual_bpm: "",
    manual_key: "",
    tags: [] as string[],
    selectedBeatPack: "" as string,
    price: "",
    isFree: true
  });
  const { toast } = useToast();

  useEffect(() => {
    if (track && open) {
      const isBeat = track.is_beat;
      const beatMetadata = track.metadata as any;
      
      setFormData({
        title: track.title || "",
        artist: track.artist || "",
        manual_bpm: track.manual_bpm?.toString() || "",
        manual_key: track.manual_key || "",
        tags: track.tags || [],
        selectedBeatPack: "",
        price: isBeat && beatMetadata?.price_cents ? (beatMetadata.price_cents / 100).toFixed(2) : "0.00",
        isFree: isBeat ? (beatMetadata?.is_free || false) : true
      });
      fetchBeatPacks();
    }
  }, [track, open]);

  const fetchBeatPacks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('beat_packs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setBeatPacks(data || []);
    } catch (error) {
      console.error('Error fetching beat packs:', error);
    }
  };

  const handleSave = async () => {
    if (!track) return;

    setIsLoading(true);
    try {
      const isBeat = track.is_beat;
      
      if (isBeat) {
        // Handle beat update
        const priceCents = formData.isFree ? 0 : Math.round(parseFloat(formData.price || "0") * 100);
        
        const { data, error } = await supabase
          .from('beats')
          .update({
            title: formData.title,
            description: formData.artist,
            bpm: formData.manual_bpm ? parseInt(formData.manual_bpm) : null,
            key: formData.manual_key || null,
            tags: formData.tags,
            price_cents: priceCents,
            is_free: formData.isFree,
            updated_at: new Date().toISOString()
          })
          .eq('id', track.id)
          .select()
          .single();

        if (error) throw error;

        // Create or update Stripe product if price is set
        if (!formData.isFree && priceCents > 0) {
          try {
            const { error: productError } = await supabase.functions.invoke('create-beat-product', {
              body: {
                beatId: track.id,
                title: formData.title,
                description: formData.artist,
                priceCents: priceCents
              }
            });
            
            if (productError) {
              console.error('Error creating Stripe product:', productError);
              // Don't fail the entire operation if Stripe fails
            }
          } catch (productError) {
            console.error('Error calling create-beat-product:', productError);
          }
        }

        // No need to mirror beats into tracks anymore since they're the same table

        // Convert back to track format for the callback
        const updatedTrack = {
          ...track,
          title: data.title,
          artist: data.description,
          manual_bpm: data.bpm,
          manual_key: data.key,
          tags: data.tags,
          metadata: {
            ...((track.metadata as any) || {}),
            price_cents: data.price_cents,
            is_free: data.is_free
          }
        } as Track;
        
        onTrackUpdated(updatedTrack);
      } else {
        // Handle regular track update
        const updateData: Partial<Track> = {
          title: formData.title,
          artist: formData.artist,
          manual_bpm: formData.manual_bpm ? parseFloat(formData.manual_bpm) : null,
          manual_key: formData.manual_key || null,
          tags: formData.tags,
          updated_at: new Date().toISOString()
        };

        const { data, error } = await supabase
          .from('beats')
          .update(updateData)
          .eq('id', track.id)
          .select()
          .single();

        if (error) throw error;

        // If beat pack is selected, add track to beat pack (avoid duplicates)
        if (formData.selectedBeatPack) {
          // Check if already exists to avoid duplicate key error
          const { data: existing } = await supabase
            .from('beat_pack_tracks')
            .select('id')
            .eq('beat_pack_id', formData.selectedBeatPack)
            .eq('track_id', track.id)
            .single();

          if (!existing) {
            await supabase
              .from('beat_pack_tracks')
              .insert({
                beat_pack_id: formData.selectedBeatPack,
                track_id: track.id,
                position: 0
              });
          }
        }

        // Call learning function if BPM or key was manually set
        if (formData.manual_bpm || formData.manual_key) {
          await supabase.functions.invoke('learn-from-corrections', {
            body: {
              track_id: track.id,
              detected_bpm: track.detected_bpm,
              detected_key: track.detected_key,
              manual_bpm: formData.manual_bpm ? parseFloat(formData.manual_bpm) : null,
              manual_key: formData.manual_key || null
            }
          });
        }

        onTrackUpdated(data);
      }

      onOpenChange(false);
      toast({
        title: "Success",
        description: `${isBeat ? 'Beat' : 'Track'} metadata updated successfully`,
      });
    } catch (error) {
      console.error('Error updating track:', error);
      toast({
        title: "Error",
        description: `Failed to update ${track.is_beat ? 'beat' : 'track'} metadata`,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const addTag = (tag: string) => {
    if (tag && !formData.tags.includes(tag)) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, tag]
      }));
    }
  };

  const removeTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  if (!track) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Edit {track.is_beat ? 'Beat' : 'Track'} Metadata</DialogTitle>
        </DialogHeader>
        
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="artist">Artist/Producer</Label>
              <Input
                id="artist"
                value={formData.artist}
                onChange={(e) => setFormData(prev => ({ ...prev, artist: e.target.value }))}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="bpm">BPM</Label>
              <Input
                id="bpm"
                type="number"
                placeholder={track.detected_bpm?.toString() || "120"}
                value={formData.manual_bpm}
                onChange={(e) => setFormData(prev => ({ ...prev, manual_bpm: e.target.value }))}
              />
              {track.detected_bpm && (
                <p className="text-xs text-muted-foreground">
                  Detected: {track.detected_bpm} BPM
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="key">Musical Key</Label>
              <Select value={formData.manual_key} onValueChange={(value) => setFormData(prev => ({ ...prev, manual_key: value }))}>
                <SelectTrigger>
                  <SelectValue placeholder={track.detected_key || "Select key"} />
                </SelectTrigger>
                <SelectContent>
                  {musicalKeys.map((key) => (
                    <SelectItem key={key} value={key}>{key}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {track.detected_key && (
                <p className="text-xs text-muted-foreground">
                  Detected: {track.detected_key}
                </p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="beatpack">Add to Beat Pack</Label>
            <Select value={formData.selectedBeatPack} onValueChange={(value) => setFormData(prev => ({ ...prev, selectedBeatPack: value }))}>
              <SelectTrigger>
                <SelectValue placeholder="Select beat pack" />
              </SelectTrigger>
              <SelectContent>
                {beatPacks.map((pack) => (
                  <SelectItem key={pack.id} value={pack.id}>{pack.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Pricing Controls */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="isFree"
                checked={formData.isFree}
                onCheckedChange={(checked) => setFormData(prev => ({ ...prev, isFree: checked }))}
              />
              <Label htmlFor="isFree">Free Download</Label>
            </div>

            {!formData.isFree && (
              <div className="space-y-2">
                <Label htmlFor="price" className="flex items-center gap-2">
                  <DollarSign className="h-4 w-4" />
                  Price (USD)
                </Label>
                <Input
                  id="price"
                  type="number"
                  step="0.01"
                  min="0.99"
                  value={formData.price}
                  onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                  placeholder="9.99"
                />
              </div>
            )}
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex flex-wrap gap-2 mb-2">
              {formData.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 bg-primary/10 text-primary px-2 py-1 rounded-md text-sm cursor-pointer"
                  onClick={() => removeTag(tag)}
                >
                  {tag} ×
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              {['vocals', 'drums', 'bass', 'melody', 'fx', 'trap', 'hip-hop', 'pop'].map((suggestedTag) => (
                <Button
                  key={suggestedTag}
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addTag(suggestedTag)}
                  disabled={formData.tags.includes(suggestedTag)}
                >
                  {suggestedTag}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={isLoading}>
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Save Changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}