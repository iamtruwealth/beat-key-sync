import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Tables } from "@/integrations/supabase/types";
import { Badge } from "@/components/ui/badge";
import { X } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type Beat = Tables<"beats">;
type BeatPack = Tables<"beat_packs">;

interface TrackMetadataDialogProps {
  track: Beat;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTrackUpdated: (updatedTrack: Beat) => void;
}

export function TrackMetadataDialog({ track, open, onOpenChange, onTrackUpdated }: TrackMetadataDialogProps) {
  const [loading, setLoading] = useState(false);
  const [beatPacks, setBeatPacks] = useState<BeatPack[]>([]);
  const { toast } = useToast();
  
  const [formData, setFormData] = useState({
    title: track.title || '',
    artist: track.artist || '',
    genre: track.genre || '',
    manual_bpm: track.manual_bpm?.toString() || '',
    manual_key: track.manual_key || '',
    tags: track.tags || [],
    newTag: '',
    selectedBeatPack: '',
    description: track.description || '',
    is_free: track.is_free || false,
    price_cents: track.price_cents?.toString() || '0'
  });

  useEffect(() => {
    if (open) {
      setFormData({
        title: track.title || '',
        artist: track.artist || '',
        genre: track.genre || '',
        manual_bpm: track.manual_bpm?.toString() || '',
        manual_key: track.manual_key || '',
        tags: track.tags || [],
        newTag: '',
        selectedBeatPack: '',
        description: track.description || '',
        is_free: track.is_free || false,
        price_cents: track.price_cents?.toString() || '0'
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
        .order('name');

      if (error) {
        console.error('Error fetching beat packs:', error);
      } else {
        setBeatPacks(data || []);
      }
    } catch (error) {
      console.error('Error:', error);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleAddTag = () => {
    if (formData.newTag.trim() && !formData.tags.includes(formData.newTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, prev.newTag.trim()],
        newTag: ''
      }));
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      handleAddTag();
    }
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      // Update beat metadata
      const updateData: Partial<Beat> = {
        title: formData.title,
        artist: formData.artist,
        genre: formData.genre,
        manual_bpm: formData.manual_bpm ? parseFloat(formData.manual_bpm) : null,
        manual_key: formData.manual_key || null,
        tags: formData.tags,
        description: formData.description,
        is_free: formData.is_free,
        price_cents: formData.is_free ? 0 : parseInt(formData.price_cents) || 0
      };

      // Create Stripe product if not free and doesn't have one
      if (!formData.is_free && !track.stripe_product_id) {
        try {
          const { data: productResult } = await supabase.functions.invoke('create-beat-product', {
            body: {
              beatId: track.id,
              title: formData.title,
              description: formData.description,
              priceCents: parseInt(formData.price_cents) || 100
            }
          });

          if (productResult?.productId && productResult?.priceId) {
            updateData.stripe_product_id = productResult.productId;
            updateData.stripe_price_id = productResult.priceId;
          }
        } catch (productError) {
          console.error('Error creating Stripe product:', productError);
        }
      }

      const { data, error } = await supabase
        .from('beats')
        .update(updateData)
        .eq('id', track.id)
        .select()
        .single();

      if (error) throw error;

      // Add to beat pack if selected
      if (formData.selectedBeatPack) {
        const { data: existing } = await supabase
          .from('beat_pack_tracks')
          .select('id')
          .eq('beat_pack_id', formData.selectedBeatPack)
          .eq('track_id', track.id)
          .maybeSingle();

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

      onTrackUpdated(data);
      onOpenChange(false);
      
      toast({
        title: "Success",
        description: "Beat metadata updated successfully"
      });
    } catch (error) {
      console.error('Error updating beat:', error);
      toast({
        title: "Error",
        description: "Failed to update beat metadata",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Beat Metadata</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Beat title"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="artist">Artist/Producer</Label>
              <Input
                id="artist"
                value={formData.artist}
                onChange={(e) => handleInputChange('artist', e.target.value)}
                placeholder="Artist name"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Describe your beat..."
              rows={3}
            />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="genre">Genre</Label>
              <Input
                id="genre"
                value={formData.genre}
                onChange={(e) => handleInputChange('genre', e.target.value)}
                placeholder="e.g. Hip Hop"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="bpm">BPM</Label>
              <Input
                id="bpm"
                type="number"
                value={formData.manual_bpm}
                onChange={(e) => handleInputChange('manual_bpm', e.target.value)}
                placeholder="120"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="key">Key</Label>
              <Input
                id="key"
                value={formData.manual_key}
                onChange={(e) => handleInputChange('manual_key', e.target.value)}
                placeholder="C Major"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Pricing</Label>
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={formData.is_free}
                  onChange={() => handleInputChange('is_free', true)}
                />
                Free
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  checked={!formData.is_free}
                  onChange={() => handleInputChange('is_free', false)}
                />
                Paid
              </label>
              {!formData.is_free && (
                <div className="flex items-center gap-2">
                  <span>$</span>
                  <Input
                    type="number"
                    value={(parseInt(formData.price_cents) / 100).toFixed(2)}
                    onChange={(e) => handleInputChange('price_cents', (parseFloat(e.target.value) * 100).toString())}
                    placeholder="9.99"
                    className="w-20"
                  />
                </div>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2 mb-2">
              <Input
                value={formData.newTag}
                onChange={(e) => handleInputChange('newTag', e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Add a tag..."
              />
              <Button type="button" onClick={handleAddTag} variant="outline">
                Add
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <button
                    onClick={() => handleRemoveTag(tag)}
                    className="ml-1 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="beatPack">Add to Beat Pack</Label>
            <Select value={formData.selectedBeatPack} onValueChange={(value) => handleInputChange('selectedBeatPack', value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select a beat pack (optional)" />
              </SelectTrigger>
              <SelectContent>
                {beatPacks.map((pack) => (
                  <SelectItem key={pack.id} value={pack.id}>
                    {pack.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}