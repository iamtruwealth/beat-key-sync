import { Search, Upload, Grid3X3, List, SlidersHorizontal, Play, MoreHorizontal, Music, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { TrackCard } from "@/components/dashboard/TrackCard";

type Track = Tables<"tracks">;
type BeatPack = Tables<"beat_packs">;

export default function Library() {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [beatPacks, setBeatPacks] = useState<BeatPack[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("All Files");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchTracks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTracks(data || []);
    } catch (error) {
      console.error('Error fetching tracks:', error);
      toast({
        title: "Error",
        description: "Failed to load tracks",
        variant: "destructive",
      });
    }
  };

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
      toast({
        title: "Error",
        description: "Failed to load beat packs",
        variant: "destructive",
      });
    }
  };

  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      await Promise.all([fetchTracks(), fetchBeatPacks()]);
      setIsLoading(false);
    };
    loadData();
  }, []);

  const filteredTracks = tracks.filter(track => {
    const matchesSearch = track.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      track.detected_bpm?.toString().includes(searchQuery) ||
      track.detected_key?.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (selectedCategory === "All Files") return matchesSearch;
    return matchesSearch && track.tags?.includes(selectedCategory.toLowerCase());
  });

  const categories = ["All Files", "Vocals", "Drums", "Bass", "Melody", "FX"];

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Library</h1>
          <p className="text-muted-foreground">
            Browse and manage all your audio files and stems.
          </p>
        </div>
        
        <Button variant="producer">
          <Upload className="w-4 h-4" />
          Upload Audio
        </Button>
      </div>

      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
            <Input
              placeholder="Search by filename, BPM, key..."
              className="pl-10 bg-background/50 border-border/50"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <SlidersHorizontal className="w-4 h-4" />
            Filters
          </Button>
          <Button 
            variant={viewMode === "grid" ? "default" : "ghost"} 
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button 
            variant={viewMode === "list" ? "default" : "ghost"} 
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        {categories.map((category) => (
          <Badge 
            key={category}
            variant={selectedCategory === category ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </Badge>
        ))}
      </div>

      {isLoading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Loading your library...</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Beat Packs Section */}
          {beatPacks.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Folder className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Beat Packs</h2>
                <Badge variant="secondary">{beatPacks.length}</Badge>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {beatPacks.map((pack) => (
                  <Card key={pack.id} className="group hover:shadow-lg transition-shadow cursor-pointer">
                    <CardContent className="p-4">
                      <div className="aspect-square bg-gradient-to-br from-primary/20 to-primary/10 rounded-lg mb-3 flex items-center justify-center relative overflow-hidden">
                        {pack.artwork_url ? (
                          <img 
                            src={pack.artwork_url} 
                            alt={pack.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <Music className="w-8 h-8 text-primary/60" />
                        )}
                        <Button
                          size="sm"
                          className="absolute inset-0 bg-black/50 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <Play className="w-4 h-4" />
                        </Button>
                      </div>
                      <h3 className="font-medium text-sm truncate">{pack.name}</h3>
                      <p className="text-xs text-muted-foreground truncate">{pack.description}</p>
                      <div className="flex items-center justify-between mt-2">
                        <span className="text-xs text-muted-foreground">
                          {new Date(pack.created_at).toLocaleDateString()}
                        </span>
                        <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                          <MoreHorizontal className="w-3 h-3" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Tracks Section */}
          {filteredTracks.length > 0 ? (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Music className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-semibold">Audio Files</h2>
                <Badge variant="secondary">{filteredTracks.length}</Badge>
              </div>
              
              {viewMode === "grid" ? (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {filteredTracks.map((track) => (
                    <TrackCard key={track.id} track={track} />
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  {filteredTracks.map((track) => (
                    <Card key={track.id} className="group hover:bg-muted/50 transition-colors">
                      <CardContent className="p-4">
                        <div className="flex items-center gap-4">
                          <div className="w-12 h-12 bg-gradient-to-br from-secondary/20 to-secondary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                            {track.artwork_url ? (
                              <img 
                                src={track.artwork_url} 
                                alt={track.title}
                                className="w-full h-full object-cover rounded-lg"
                              />
                            ) : (
                              <Music className="w-5 h-5 text-secondary/60" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <h3 className="font-medium truncate">{track.title}</h3>
                            <div className="flex items-center gap-4 text-sm text-muted-foreground">
                              {track.detected_bpm && <span>{track.detected_bpm} BPM</span>}
                              {track.detected_key && <span>{track.detected_key}</span>}
                              <span>{new Date(track.created_at).toLocaleDateString()}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Button size="sm" variant="ghost" className="opacity-0 group-hover:opacity-100 transition-opacity">
                              <Play className="w-4 h-4" />
                            </Button>
                            <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </div>
          ) : tracks.length === 0 && beatPacks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Upload className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No audio files yet</h3>
              <p className="mb-4">Upload your first audio file to get started with the library.</p>
              <Button variant="producer">Upload Audio Files</Button>
            </div>
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Search className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No files match your search</h3>
              <p className="mb-4">Try adjusting your search or filter criteria.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}