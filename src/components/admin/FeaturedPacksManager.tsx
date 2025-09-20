import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Star, Plus, X, ArrowUp, ArrowDown } from "lucide-react";

interface BeatPack {
  id: string;
  name: string;
  artwork_url?: string;
  user_id: string;
  profiles?: {
    producer_name?: string;
    first_name?: string;
  };
}

interface FeaturedPack {
  id: string;
  beat_pack_id: string;
  position: number;
  beat_packs: {
    id: string;
    name: string;
    artwork_url?: string;
    user_id: string;
    profiles?: {
      producer_name?: string;
      first_name?: string;
    };
  };
}

export function FeaturedPacksManager() {
  const [isOpen, setIsOpen] = useState(false);
  const [featuredPacks, setFeaturedPacks] = useState<FeaturedPack[]>([]);
  const [availablePacks, setAvailablePacks] = useState<BeatPack[]>([]);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchFeaturedPacks();
      fetchAvailablePacks();
    }
  }, [isOpen]);

  const fetchFeaturedPacks = async () => {
    try {
      const { data, error } = await supabase
        .from('featured_beat_packs')
        .select(`
          id,
          beat_pack_id,
          position,
          beat_packs!inner(
            id,
            name,
            artwork_url,
            user_id,
            profiles!inner(producer_name, first_name)
          )
        `)
        .order('position', { ascending: true });

      if (error) throw error;
      setFeaturedPacks((data as any) || []);
    } catch (error) {
      console.error('Error fetching featured packs:', error);
    }
  };

  const fetchAvailablePacks = async () => {
    try {
      const { data: featured } = await supabase
        .from('featured_beat_packs')
        .select('beat_pack_id');

      const featuredIds = featured?.map(f => f.beat_pack_id) || [];

      const { data, error } = await supabase
        .from('beat_packs')
        .select(`
          id,
          name,
          artwork_url,
          user_id,
          profiles!inner(producer_name, first_name)
        `)
        .eq('is_public', true)
        .not('id', 'in', featuredIds.length > 0 ? `(${featuredIds.join(',')})` : '()')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAvailablePacks((data as any) || []);
    } catch (error) {
      console.error('Error fetching available packs:', error);
    }
  };

  const addToFeatured = async (beatPackId: string) => {
    setLoading(true);
    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const maxPosition = Math.max(...featuredPacks.map(f => f.position), -1);

      const { error } = await supabase
        .from('featured_beat_packs')
        .insert({
          beat_pack_id: beatPackId,
          position: maxPosition + 1,
          added_by: user.user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Beat pack added to featured list"
      });

      await fetchFeaturedPacks();
      await fetchAvailablePacks();
    } catch (error) {
      console.error('Error adding to featured:', error);
      toast({
        title: "Error",
        description: "Failed to add beat pack to featured list",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const removeFromFeatured = async (id: string) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('featured_beat_packs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Beat pack removed from featured list"
      });

      await fetchFeaturedPacks();
      await fetchAvailablePacks();
    } catch (error) {
      console.error('Error removing from featured:', error);
      toast({
        title: "Error",
        description: "Failed to remove beat pack from featured list",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const updatePosition = async (id: string, newPosition: number) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('featured_beat_packs')
        .update({ position: newPosition })
        .eq('id', id);

      if (error) throw error;

      await fetchFeaturedPacks();
    } catch (error) {
      console.error('Error updating position:', error);
      toast({
        title: "Error",
        description: "Failed to update position",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const moveUp = (pack: FeaturedPack) => {
    const currentIndex = featuredPacks.findIndex(f => f.id === pack.id);
    if (currentIndex > 0) {
      const swapPack = featuredPacks[currentIndex - 1];
      updatePosition(pack.id, swapPack.position);
      updatePosition(swapPack.id, pack.position);
    }
  };

  const moveDown = (pack: FeaturedPack) => {
    const currentIndex = featuredPacks.findIndex(f => f.id === pack.id);
    if (currentIndex < featuredPacks.length - 1) {
      const swapPack = featuredPacks[currentIndex + 1];
      updatePosition(pack.id, swapPack.position);
      updatePosition(swapPack.id, pack.position);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" className="flex items-center gap-2">
          <Star className="w-4 h-4" />
          Manage Featured Packs
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Manage Featured Beat Packs</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current Featured Packs */}
          <div>
            <h3 className="text-lg font-semibold mb-4">Currently Featured ({featuredPacks.length}/4)</h3>
            <div className="space-y-2">
              {featuredPacks.map((pack, index) => (
                <div key={pack.id} className="flex items-center gap-3 p-3 border rounded-lg">
                  <Badge variant="secondary">#{pack.position + 1}</Badge>
                  
                  {pack.beat_packs.artwork_url && (
                    <img 
                      src={pack.beat_packs.artwork_url} 
                      alt={pack.beat_packs.name}
                      className="w-12 h-12 object-cover rounded"
                    />
                  )}
                  
                  <div className="flex-1">
                    <p className="font-medium">{pack.beat_packs.name}</p>
                    <p className="text-sm text-muted-foreground">
                      by {(pack.beat_packs.profiles as any)?.producer_name || (pack.beat_packs.profiles as any)?.first_name || 'Unknown'}
                    </p>
                  </div>

                  <div className="flex items-center gap-1">
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => moveUp(pack)}
                      disabled={index === 0 || loading}
                    >
                      <ArrowUp className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="ghost"
                      onClick={() => moveDown(pack)}
                      disabled={index === featuredPacks.length - 1 || loading}
                    >
                      <ArrowDown className="w-4 h-4" />
                    </Button>
                    <Button 
                      size="sm" 
                      variant="destructive"
                      onClick={() => removeFromFeatured(pack.id)}
                      disabled={loading}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Available Packs */}
          {featuredPacks.length < 4 && (
            <div>
              <h3 className="text-lg font-semibold mb-4">Available Beat Packs</h3>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {availablePacks.map((pack) => (
                  <div key={pack.id} className="flex items-center gap-3 p-3 border rounded-lg">
                    {pack.artwork_url && (
                      <img 
                        src={pack.artwork_url} 
                        alt={pack.name}
                        className="w-12 h-12 object-cover rounded"
                      />
                    )}
                    
                    <div className="flex-1">
                      <p className="font-medium">{pack.name}</p>
                      <p className="text-sm text-muted-foreground">
                        by {(pack.profiles as any)?.producer_name || (pack.profiles as any)?.first_name || 'Unknown'}
                      </p>
                    </div>

                    <Button 
                      size="sm"
                      onClick={() => addToFeatured(pack.id)}
                      disabled={loading}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}