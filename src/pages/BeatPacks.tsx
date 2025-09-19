import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { 
  Music, 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  Eye,
  Download,
  DollarSign,
  Upload,
  Share,
  MoreVertical,
  TrendingUp,
  Users,
  Play
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";

interface BeatPack {
  id: string;
  name: string;
  description?: string;
  artwork_url?: string;
  is_public: boolean;
  download_enabled: boolean;
  created_at: string;
  updated_at: string;
  track_count?: number;
  downloads_count?: number;
  plays_count?: number;
}

export default function BeatPacksPage() {
  const [beatPacks, setBeatPacks] = useState<BeatPack[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPack, setEditingPack] = useState<BeatPack | null>(null);
  const [newPack, setNewPack] = useState({
    name: "",
    description: "",
    is_public: true,
    download_enabled: false
  });
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    loadBeatPacks();
  }, []);

  const loadBeatPacks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('beat_packs')
        .select(`
          *,
          beat_pack_tracks(count)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform data to include track counts
      const packsWithCounts = data?.map(pack => ({
        ...pack,
        track_count: pack.beat_pack_tracks?.length || 0,
        downloads_count: Math.floor(Math.random() * 100), // Mock data
        plays_count: Math.floor(Math.random() * 1000) // Mock data
      })) || [];

      setBeatPacks(packsWithCounts);
    } catch (error) {
      console.error('Error loading beat packs:', error);
      toast({
        title: "Error",
        description: "Failed to load beat packs",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const createBeatPack = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('beat_packs')
        .insert({
          ...newPack,
          user_id: user.id
        });

      if (error) throw error;

      setShowCreateDialog(false);
      setNewPack({ name: "", description: "", is_public: true, download_enabled: false });
      await loadBeatPacks();

      toast({
        title: "Success",
        description: "Beat pack created successfully"
      });
    } catch (error) {
      console.error('Error creating beat pack:', error);
      toast({
        title: "Error",
        description: "Failed to create beat pack",
        variant: "destructive"
      });
    }
  };

  const updateBeatPack = async (pack: BeatPack) => {
    try {
      const { error } = await supabase
        .from('beat_packs')
        .update({
          name: pack.name,
          description: pack.description,
          is_public: pack.is_public,
          download_enabled: pack.download_enabled
        })
        .eq('id', pack.id);

      if (error) throw error;

      setEditingPack(null);
      await loadBeatPacks();

      toast({
        title: "Success",
        description: "Beat pack updated successfully"
      });
    } catch (error) {
      console.error('Error updating beat pack:', error);
      toast({
        title: "Error",
        description: "Failed to update beat pack",
        variant: "destructive"
      });
    }
  };

  const deleteBeatPack = async (packId: string) => {
    if (!confirm('Are you sure you want to delete this beat pack?')) return;

    try {
      const { error } = await supabase
        .from('beat_packs')
        .delete()
        .eq('id', packId);

      if (error) throw error;

      await loadBeatPacks();

      toast({
        title: "Success",
        description: "Beat pack deleted successfully"
      });
    } catch (error) {
      console.error('Error deleting beat pack:', error);
      toast({
        title: "Error",
        description: "Failed to delete beat pack",
        variant: "destructive"
      });
    }
  };

  const filteredBeatPacks = beatPacks.filter(pack =>
    pack.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    pack.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const copyPackLink = async (packId: string) => {
    const url = `${window.location.origin}/pack/${packId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({
        title: "Success",
        description: "Pack link copied to clipboard"
      });
    } catch (error) {
      toast({
        title: "Error", 
        description: "Failed to copy link",
        variant: "destructive"
      });
    }
  };

  const navigateToBeatPack = (packId: string) => {
    navigate(`/pack/${packId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-lg">Loading beat packs...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Beat Packs</h1>
          <p className="text-muted-foreground">Create and manage your beat pack collection</p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Beat Pack
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Beat Pack</DialogTitle>
              <DialogDescription>
                Create a new beat pack to organize and share your beats
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="pack-name">Pack Name</Label>
                <Input
                  id="pack-name"
                  value={newPack.name}
                  onChange={(e) => setNewPack({ ...newPack, name: e.target.value })}
                  placeholder="e.g., Fire Trap Beats Vol. 1"
                />
              </div>
              <div>
                <Label htmlFor="pack-description">Description</Label>
                <Textarea
                  id="pack-description"
                  value={newPack.description}
                  onChange={(e) => setNewPack({ ...newPack, description: e.target.value })}
                  placeholder="Describe your beat pack..."
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="is-public">Make Public</Label>
                <Switch
                  id="is-public"
                  checked={newPack.is_public}
                  onCheckedChange={(checked) => setNewPack({ ...newPack, is_public: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="download-enabled">Enable Downloads</Label>
                <Switch
                  id="download-enabled"
                  checked={newPack.download_enabled}
                  onCheckedChange={(checked) => setNewPack({ ...newPack, download_enabled: checked })}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={createBeatPack} disabled={!newPack.name.trim()}>
                  Create Pack
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search beat packs..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-8"
        />
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Packs</CardTitle>
            <Music className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{beatPacks.length}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Downloads</CardTitle>
            <Download className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {beatPacks.reduce((sum, pack) => sum + (pack.downloads_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Plays</CardTitle>
            <Play className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {beatPacks.reduce((sum, pack) => sum + (pack.plays_count || 0), 0)}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Public Packs</CardTitle>
            <Eye className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {beatPacks.filter(pack => pack.is_public).length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Beat Packs Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {filteredBeatPacks.map((pack) => (
          <Card key={pack.id} className="group hover:shadow-lg transition-shadow cursor-pointer" onClick={() => navigateToBeatPack(pack.id)}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="flex items-center gap-2">
                    <div className="w-12 h-12 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center">
                      <Music className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{pack.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {pack.track_count} tracks
                      </p>
                    </div>
                  </CardTitle>
                </div>
                <div className="flex items-center gap-1">
                  {pack.is_public && <Badge variant="secondary">Public</Badge>}
                  {pack.download_enabled && <Badge variant="outline">Downloads</Badge>}
                </div>
              </div>
              {pack.description && (
                <CardDescription>{pack.description}</CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-1">
                    <Eye className="w-4 h-4" />
                    {pack.plays_count}
                  </div>
                  <div className="flex items-center gap-1">
                    <Download className="w-4 h-4" />
                    {pack.downloads_count}
                  </div>
                </div>
                <div className="text-xs">
                  Updated {new Date(pack.updated_at).toLocaleDateString()}
                </div>
              </div>

              <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                <Button 
                  size="sm" 
                  variant="outline" 
                  className="flex-1"
                  onClick={() => navigate('/library')}
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Add Beats
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => setEditingPack(pack)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => copyPackLink(pack.id)}
                >
                  <Share className="w-4 h-4" />
                </Button>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => deleteBeatPack(pack.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredBeatPacks.length === 0 && (
        <div className="text-center py-12">
          <Music className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium mb-2">
            {searchQuery ? 'No beat packs found' : 'No beat packs yet'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery 
              ? 'Try adjusting your search terms'
              : 'Create your first beat pack to start organizing your beats'
            }
          </p>
          {!searchQuery && (
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Your First Beat Pack
            </Button>
          )}
        </div>
      )}

      {/* Edit Dialog */}
      {editingPack && (
        <Dialog open={!!editingPack} onOpenChange={() => setEditingPack(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Beat Pack</DialogTitle>
              <DialogDescription>
                Update your beat pack details
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-pack-name">Pack Name</Label>
                <Input
                  id="edit-pack-name"
                  value={editingPack.name}
                  onChange={(e) => setEditingPack({ ...editingPack, name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="edit-pack-description">Description</Label>
                <Textarea
                  id="edit-pack-description"
                  value={editingPack.description || ""}
                  onChange={(e) => setEditingPack({ ...editingPack, description: e.target.value })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-is-public">Make Public</Label>
                <Switch
                  id="edit-is-public"
                  checked={editingPack.is_public}
                  onCheckedChange={(checked) => setEditingPack({ ...editingPack, is_public: checked })}
                />
              </div>
              <div className="flex items-center justify-between">
                <Label htmlFor="edit-download-enabled">Enable Downloads</Label>
                <Switch
                  id="edit-download-enabled"
                  checked={editingPack.download_enabled}
                  onCheckedChange={(checked) => setEditingPack({ ...editingPack, download_enabled: checked })}
                />
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setEditingPack(null)}>
                  Cancel
                </Button>
                <Button onClick={() => updateBeatPack(editingPack)}>
                  Save Changes
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}