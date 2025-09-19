import { useState, useEffect, useRef } from "react";
import { Search, Plus, FolderOpen, Music, Play, MoreVertical, Edit, Trash2, Upload, X, Link, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface BeatPack {
  id: string;
  name: string;
  description?: string;
  artwork_url?: string;
  created_at: string;
  track_count: number;
  download_enabled?: boolean;
}

export default function Projects() {
  const [beatPacks, setBeatPacks] = useState<BeatPack[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [newPackName, setNewPackName] = useState("");
  const [newPackDescription, setNewPackDescription] = useState("");
  const [newPackDownloadEnabled, setNewPackDownloadEnabled] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingPack, setEditingPack] = useState<BeatPack | null>(null);
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
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
          beat_pack_tracks(count),
          beat_pack_views(count),
          beat_pack_downloads(count)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const packsWithCount = data?.map(pack => ({
        ...pack,
        track_count: pack.beat_pack_tracks?.[0]?.count || 0,
        views_count: pack.beat_pack_views?.[0]?.count || 0,
        downloads_count: pack.beat_pack_downloads?.[0]?.count || 0
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
          download_enabled: newPackDownloadEnabled,
          user_id: user.id
        });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Beat pack created successfully"
      });

      setNewPackName("");
      setNewPackDescription("");
      setNewPackDownloadEnabled(false);
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

  const uploadArtwork = async (file: File, packId: string): Promise<string | null> => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const fileName = `${user.id}/beat-packs/${packId}/artwork-${Date.now()}.${file.name.split('.').pop()}`;
      const { data, error } = await supabase.storage
        .from('artwork')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('artwork')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error('Artwork upload error:', error);
      return null;
    }
  };

  const handleArtworkChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setArtworkPreview(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const saveArtwork = async () => {
    if (!editingPack || !fileInputRef.current?.files?.[0]) return;

    try {
      const file = fileInputRef.current.files[0];
      const artworkUrl = await uploadArtwork(file, editingPack.id);
      
      if (!artworkUrl) {
        throw new Error('Failed to upload artwork');
      }

      const { error } = await supabase
        .from('beat_packs')
        .update({ artwork_url: artworkUrl })
        .eq('id', editingPack.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Artwork updated successfully"
      });

      setIsEditDialogOpen(false);
      setEditingPack(null);
      setArtworkPreview(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      fetchBeatPacks();
    } catch (error) {
      console.error('Error updating artwork:', error);
      toast({
        title: "Error",
        description: "Failed to update artwork",
        variant: "destructive"
      });
    }
  };

  const deleteBeatPack = async (packId: string) => {
    try {
      const { error } = await supabase
        .from('beat_packs')
        .delete()
        .eq('id', packId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Beat pack deleted successfully"
      });

      fetchBeatPacks();
    } catch (error) {
      console.error('Error deleting beat pack:', error);
      toast({
        title: "Error",
        description: "Failed to delete beat pack",
        variant: "destructive"
      });
    }
  };

  const openEditDialog = (pack: BeatPack) => {
    setEditingPack(pack);
    setArtworkPreview(pack.artwork_url || null);
    setIsEditDialogOpen(true);
  };

  const copyPackLink = (packId: string) => {
    const url = `${window.location.origin}/pack/${packId}`;
    navigator.clipboard.writeText(url);
    toast({
      title: "Link copied",
      description: "Beat pack link copied to clipboard"
    });
  };

  const toggleDownload = async (packId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('beat_packs')
        .update({ download_enabled: !currentStatus })
        .eq('id', packId);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Downloads ${!currentStatus ? 'enabled' : 'disabled'} for this beat pack`
      });

      fetchBeatPacks();
    } catch (error) {
      console.error('Error updating download settings:', error);
      toast({
        title: "Error",
        description: "Failed to update download settings",
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
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="download-enabled"
                    checked={newPackDownloadEnabled}
                    onCheckedChange={(checked) => setNewPackDownloadEnabled(checked === true)}
                  />
                  <Label htmlFor="download-enabled" className="text-sm">
                    Allow downloads (users can download tracks from this pack)
                  </Label>
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

        {/* Edit Artwork Dialog */}
        <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Beat Pack Artwork</DialogTitle>
              <DialogDescription>
                Upload a new artwork or logo for {editingPack?.name}
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-4">
                <div className="w-48 h-48 border-2 border-dashed border-border rounded-lg overflow-hidden bg-muted">
                  {artworkPreview ? (
                    <img 
                      src={artworkPreview} 
                      alt="Preview"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Music className="w-16 h-16 text-muted-foreground" />
                    </div>
                  )}
                </div>
                
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-4 h-4 mr-2" />
                    Choose Image
                  </Button>
                  {artworkPreview && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setArtworkPreview(null);
                        if (fileInputRef.current) fileInputRef.current.value = '';
                      }}
                    >
                      <X className="w-4 h-4 mr-2" />
                      Remove
                    </Button>
                  )}
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleArtworkChange}
                  className="hidden"
                />
                
                <p className="text-sm text-muted-foreground text-center">
                  Recommended: Square image (1:1 ratio), minimum 400x400px
                </p>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setIsEditDialogOpen(false);
                    setEditingPack(null);
                    setArtworkPreview(null);
                    if (fileInputRef.current) fileInputRef.current.value = '';
                  }}
                >
                  Cancel
                </Button>
                <Button 
                  onClick={saveArtwork}
                  disabled={!fileInputRef.current?.files?.[0]}
                >
                  Save Artwork
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
            <Card 
              key={pack.id} 
              className="group cursor-pointer hover:shadow-lg transition-all duration-200"
              onClick={() => navigate(`/pack/${pack.id}`)}
            >
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
                    <Button 
                      size="icon" 
                      className="w-12 h-12 rounded-full bg-primary hover:bg-primary/90"
                      onClick={() => navigate(`/pack/${pack.id}`)}
                    >
                      <Play className="w-6 h-6" />
                    </Button>
                  </div>
                  
                  {/* More options */}
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 hover:bg-black/70 text-white"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => copyPackLink(pack.id)}>
                        <Link className="w-4 h-4 mr-2" />
                        Copy Share Link
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => openEditDialog(pack)}>
                        <Edit className="w-4 h-4 mr-2" />
                        Edit Artwork
                      </DropdownMenuItem>
                      <DropdownMenuItem onClick={() => toggleDownload(pack.id, pack.download_enabled || false)}>
                        <Download className="w-4 h-4 mr-2" />
                        {pack.download_enabled ? 'Disable' : 'Enable'} Downloads
                      </DropdownMenuItem>
                      <DropdownMenuItem 
                        onClick={() => deleteBeatPack(pack.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        Delete Pack
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
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
                    <div className="flex gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {pack.track_count} track{pack.track_count !== 1 ? 's' : ''}
                      </Badge>
                      {pack.download_enabled && (
                        <Badge variant="outline" className="text-xs">
                          <Download className="w-3 h-3 mr-1" />
                          Downloads
                        </Badge>
                      )}
                    </div>
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