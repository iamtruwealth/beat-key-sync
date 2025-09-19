import { Search, Upload, Grid3X3, List, SlidersHorizontal, Play, MoreHorizontal, Music, Folder } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";
import { TrackCard } from "@/components/dashboard/BeatCard";

type Beat = Tables<"beats">;
type BeatPack = Tables<"beat_packs">;

export default function Library() {
  const [beats, setBeats] = useState<Beat[]>([]);
  const [beatPacks, setBeatPacks] = useState<BeatPack[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('beats')
        .select('*')
        .eq('producer_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching beats:', error);
        toast({
          title: "Error",
          description: "Failed to load your beats"
        });
      } else {
        setBeats(data || []);
      }

      // Fetch beat packs
      const { data: packData, error: packError } = await supabase
        .from('beat_packs')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (packError) {
        console.error('Error fetching beat packs:', packError);
      } else {
        setBeatPacks(packData || []);
      }
    } catch (error) {
      console.error('Error:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const filteredBeats = beats.filter(beat =>
    beat.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (beat.artist && beat.artist.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (beat.tags && beat.tags.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase())))
  );

  const filteredBeatPacks = beatPacks.filter(pack =>
    pack.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (pack.description && pack.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleBeatUpdated = (updatedBeat: Beat) => {
    setBeats(prev => prev.map(beat => 
      beat.id === updatedBeat.id ? updatedBeat : beat
    ));
  };

  const handleBeatDeleted = (beatId: string) => {
    setBeats(prev => prev.filter(beat => beat.id !== beatId));
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number) => {
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return 'Just now';
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 48) return 'Yesterday';
    const diffInDays = Math.floor(diffInHours / 24);
    return `${diffInDays}d ago`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your library...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Library</h1>
          <p className="text-muted-foreground mt-2">
            Manage your beats, tracks, and beat packs
          </p>
        </div>
        <Button className="gap-2">
          <Upload className="w-4 h-4" />
          Upload Beat
        </Button>
      </div>

      {/* Search and Filter Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            placeholder="Search beats, packs, or tags..."
            className="pl-10"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="flex gap-2">
          <Button
            variant={viewMode === "grid" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("grid")}
          >
            <Grid3X3 className="w-4 h-4" />
          </Button>
          <Button
            variant={viewMode === "list" ? "default" : "outline"}
            size="sm"
            onClick={() => setViewMode("list")}
          >
            <List className="w-4 h-4" />
          </Button>
          <Button variant="outline" size="sm">
            <SlidersHorizontal className="w-4 h-4" />
            Filter
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                <Music className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{beats.length}</p>
                <p className="text-muted-foreground text-sm">Total Beats</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-secondary/10 rounded-lg flex items-center justify-center">
                <Folder className="w-6 h-6 text-secondary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{beatPacks.length}</p>
                <p className="text-muted-foreground text-sm">Beat Packs</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-accent/10 rounded-lg flex items-center justify-center">
                <Play className="w-6 h-6 text-accent" />
              </div>
              <div>
                <p className="text-2xl font-bold">0</p>
                <p className="text-muted-foreground text-sm">Total Plays</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="space-y-8">
        {/* Beat Packs Section */}
        {filteredBeatPacks.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Folder className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Beat Packs</h2>
              <Badge variant="secondary">{filteredBeatPacks.length}</Badge>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredBeatPacks.map((pack) => (
                <Card key={pack.id} className="group cursor-pointer hover:shadow-lg transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/70 rounded-lg flex items-center justify-center">
                        <Folder className="w-6 h-6 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium truncate">{pack.name}</h3>
                        <p className="text-sm text-muted-foreground truncate">
                          {pack.description || 'No description'}
                        </p>
                        <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                          <span>{getTimeAgo(pack.created_at)}</span>
                        </div>
                      </div>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Beats Section */}
        {filteredBeats.length > 0 ? (
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Music className="w-5 h-5 text-primary" />
              <h2 className="text-xl font-semibold">Beats</h2>
              <Badge variant="secondary">{filteredBeats.length}</Badge>
            </div>
            
            {viewMode === "grid" ? (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredBeats.map((beat) => {
                  // Transform beat to match expected interface
                  const beatWithExtras = {
                    ...beat,
                    formattedDuration: beat.duration ? formatDuration(beat.duration) : 'Unknown',
                    formattedSize: beat.file_size ? formatFileSize(beat.file_size) : 'Unknown',
                    lastModified: getTimeAgo(beat.updated_at),
                    is_beat: true
                  };
                  
                  return (
                    <TrackCard 
                      key={beat.id} 
                      track={beatWithExtras} 
                      onTrackUpdated={handleBeatUpdated}
                      onTrackDeleted={handleBeatDeleted}
                    />
                  );
                })}
              </div>
            ) : (
              <div className="space-y-2">
                {filteredBeats.map((beat) => {
                  const beatWithExtras = {
                    ...beat,
                    formattedDuration: beat.duration ? formatDuration(beat.duration) : 'Unknown',
                    formattedSize: beat.file_size ? formatFileSize(beat.file_size) : 'Unknown',
                    lastModified: getTimeAgo(beat.updated_at),
                    is_beat: true
                  };
                  
                  return (
                    <TrackCard 
                      key={beat.id} 
                      track={beatWithExtras} 
                      onTrackUpdated={handleBeatUpdated}
                      onTrackDeleted={handleBeatDeleted}
                    />
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-12">
            <Music className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No beats found</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery ? 'Try adjusting your search terms' : 'Upload your first beat to get started'}
            </p>
            <Button>
              <Upload className="w-4 h-4 mr-2" />
              Upload Beat
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}