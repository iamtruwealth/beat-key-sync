import { useState, useEffect } from "react";
import { Search, Plus, FolderOpen, Music, Play, MoreVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface BeatPack {
  id: string;
  name: string;
  description?: string;
  artwork_url?: string;
  created_at: string;
  track_count: number;
}

export default function Projects() {
  const [beatPacks, setBeatPacks] = useState<BeatPack[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newPackName, setNewPackName] = useState("");
  const [newPackDescription, setNewPackDescription] = useState("");
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    fetchBeatPacks();
  }, []);

  const fetchBeatPacks = async () => {
    try {
      const { data, error } = await supabase
        .from('beat_packs')
        .select(`
          *,
          beat_pack_tracks(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const packsWithCount = data?.map(pack => ({
        ...pack,
        track_count: pack.beat_pack_tracks?.[0]?.count || 0
      })) || [];

      setBeatPacks(packsWithCount);
    } catch (error) {
      console.error('Error fetching beat packs:', error);
      toast({
        title: "Error",
        description: "Failed to load beat packs",
        variant: "destructive"
      });
    }
  };

  const createBeatPack = async () => {
    if (!newPackName.trim()) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { error } = await supabase
        .from('beat_packs')
        .insert({
          name: newPackName.trim(),
          description: newPackDescription.trim() || null,
          user_id: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Beat pack created successfully"
      });

      setNewPackName("");
      setNewPackDescription("");
      setIsCreateDialogOpen(false);
      fetchBeatPacks();
    } catch (error) {
      console.error('Error creating beat pack:', error);
      toast({
        title: "Error",
        description: "Failed to create beat pack",
        variant: "destructive"
      });
    }
  };

  const filteredBeatPacks = beatPacks.filter(pack => 
    pack.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pack.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Beat Packs</h1>
          <p className="text-muted-foreground">
            Create and organize beat packs to showcase your production style.
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button variant="default">
              <Plus className="w-4 h-4" />
              New Beat Pack
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Beat Pack</DialogTitle>
              <DialogDescription>
                Create a new beat pack to organize your tracks
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="pack-name">Pack Name</Label>
                <Input
                  id="pack-name"
                  value={newPackName}
                  onChange={(e) => setNewPackName(e.target.value)}
                  placeholder="Enter pack name..."
                />
              </div>
              <div>
                <Label htmlFor="pack-description">Description (Optional)</Label>
                <Textarea
                  id="pack-description"
                  value={newPackDescription}
                  onChange={(e) => setNewPackDescription(e.target.value)}
                  placeholder="Describe your beat pack..."
                  rows={3}
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button onClick={createBeatPack}>
                  Create Pack
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 max-w-md">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search beat packs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 bg-background/50 border-border/50"
          />
        </div>
      </div>

      {filteredBeatPacks.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredBeatPacks.map((pack) => (
            <Card key={pack.id} className="group cursor-pointer hover:shadow-lg transition-all duration-200">
              <CardContent className="p-0">
                <div className="aspect-square bg-gradient-to-br from-primary/20 to-primary/5 rounded-t-lg relative overflow-hidden">
                  {pack.artwork_url ? (
                    <img 
                      src={pack.artwork_url} 
                      alt={pack.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-16 h-16 text-primary/40" />
                    </div>
                  )}
                  
                  {/* Play button overlay */}
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <Button size="icon" className="w-12 h-12 rounded-full bg-primary hover:bg-primary/90">
                      <Play className="w-6 h-6" />
                    </Button>
                  </div>
                  
                  {/* More options */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white"
                  >
                    <MoreVertical className="w-4 h-4" />
                  </Button>
                </div>
                
                <div className="p-4">
                  <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors">
                    {pack.name}
                  </h3>
                  {pack.description && (
                    <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                      {pack.description}
                    </p>
                  )}
                  <div className="flex items-center justify-between mt-3">
                    <Badge variant="secondary" className="text-xs">
                      {pack.track_count} track{pack.track_count !== 1 ? 's' : ''}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {new Date(pack.created_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="text-center py-12 text-muted-foreground">
          <FolderOpen className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">
            {searchQuery ? 'No beat packs found' : 'No beat packs yet'}
          </h3>
          <p className="mb-4">
            {searchQuery 
              ? 'Try adjusting your search query' 
              : 'Create your first beat pack to showcase your production style.'
            }
          </p>
          {!searchQuery && (
            <Button variant="outline" onClick={() => setIsCreateDialogOpen(true)}>
              Create Beat Pack
            </Button>
          )}
        </div>
      )}
    </div>
  );
}