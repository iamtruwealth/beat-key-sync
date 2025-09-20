import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Star, Plus, X, ArrowUp, ArrowDown, Search } from "lucide-react";

interface BeatPack {
  id: string;
  name: string;
  artwork_url?: string;
  user_id: string;
  created_at: string;
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
  const [allPacks, setAllPacks] = useState<BeatPack[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen) {
      fetchFeaturedPacks();
      fetchAllPacks();
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

  const fetchAllPacks = async () => {
    try {
      const { data, error } = await supabase
        .from('beat_packs')
        .select(`
          id,
          name,
          artwork_url,
          user_id,
          created_at,
          profiles!inner(producer_name, first_name)
        `)
        .eq('is_public', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAllPacks((data as any) || []);
    } catch (error) {
      console.error('Error fetching all packs:', error);
    }
  };

  // Filter packs based on search term
  const filteredPacks = allPacks.filter(pack => {
    const packName = pack.name.toLowerCase();
    const producerName = ((pack.profiles as any)?.producer_name || (pack.profiles as any)?.first_name || '').toLowerCase();
    const search = searchTerm.toLowerCase();
    
    return packName.includes(search) || producerName.includes(search);
  });

  // Separate featured and non-featured packs
  const featuredIds = featuredPacks.map(f => f.beat_pack_id);
  const nonFeaturedPacks = filteredPacks.filter(pack => !featuredIds.includes(pack.id));

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
      await fetchAllPacks();
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
      await fetchAllPacks();
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

          {/* Search and Browse All Packs */}
          <div>
            <div className="flex items-center gap-4 mb-4">
              <h3 className="text-lg font-semibold">All Beat Packs ({allPacks.length})</h3>
              <div className="relative flex-1 max-w-sm">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  placeholder="Search by pack name or producer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {/* Show currently featured packs in search results */}
            {searchTerm && featuredPacks.some(pack => {
              const packName = pack.beat_packs.name.toLowerCase();
              const producerName = ((pack.beat_packs.profiles as any)?.producer_name || (pack.beat_packs.profiles as any)?.first_name || '').toLowerCase();
              return packName.includes(searchTerm.toLowerCase()) || producerName.includes(searchTerm.toLowerCase());
            }) && (
              <div className="mb-4">
                <p className="text-sm text-muted-foreground mb-2">Currently Featured:</p>
                <div className="space-y-2 max-h-32 overflow-y-auto">
                  {featuredPacks
                    .filter(pack => {
                      const packName = pack.beat_packs.name.toLowerCase();
                      const producerName = ((pack.beat_packs.profiles as any)?.producer_name || (pack.beat_packs.profiles as any)?.first_name || '').toLowerCase();
                      return packName.includes(searchTerm.toLowerCase()) || producerName.includes(searchTerm.toLowerCase());
                    })
                    .map((pack) => (
                      <div key={pack.id} className="flex items-center gap-3 p-3 border rounded-lg bg-blue-50">
                        <Badge variant="secondary">Featured #{pack.position + 1}</Badge>
                        
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

                        <Button 
                          size="sm" 
                          variant="destructive"
                          onClick={() => removeFromFeatured(pack.id)}
                          disabled={loading}
                        >
                          <X className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                </div>
              </div>
            )}

            {/* Available packs */}
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {nonFeaturedPacks.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  {searchTerm ? 'No packs found matching your search.' : 'No available packs to feature.'}
                </p>
              ) : (
                nonFeaturedPacks.map((pack) => (
                  <div key={pack.id} className="flex items-center gap-3 p-3 border rounded-lg hover:bg-muted/50">
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
                      <p className="text-xs text-muted-foreground">
                        Created: {new Date(pack.created_at).toLocaleDateString()}
                      </p>
                    </div>

                    <Button 
                      size="sm"
                      onClick={() => addToFeatured(pack.id)}
                      disabled={loading || featuredPacks.length >= 4}
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      {featuredPacks.length >= 4 ? 'Full' : 'Add'}
                    </Button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}