import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Lock, Music, Save } from "lucide-react";
import { ExclusivePostDialog } from "./ExclusivePostDialog";

export function ExclusiveContentManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [posts, setPosts] = useState<any[]>([]);
  const [beats, setBeats] = useState<any[]>([]);
  const [selectedBeatIds, setSelectedBeatIds] = useState<string[]>([]);
  const [epkProfileId, setEpkProfileId] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Load EPK profile with exclusive beat IDs
      const { data: epkData, error: epkError } = await supabase
        .from("artist_epk_profiles")
        .select("id, exclusive_beat_ids")
        .eq("artist_id", user.id)
        .single();

      if (epkError) throw epkError;
      
      setEpkProfileId(epkData.id);
      setSelectedBeatIds(epkData.exclusive_beat_ids || []);

      // Load posts
      const { data: postsData, error: postsError } = await supabase
        .from("artist_exclusive_posts")
        .select("*")
        .eq("artist_id", user.id)
        .order("created_at", { ascending: false });

      if (postsError) throw postsError;
      setPosts(postsData || []);

      // Load user's beats
      const { data: beatsData, error: beatsError } = await supabase
        .from("beats")
        .select("id, title, artwork_url, genre")
        .eq("producer_id", user.id)
        .order("created_at", { ascending: false });

      if (beatsError) throw beatsError;
      setBeats(beatsData || []);
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to load exclusive content",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAddPost = () => {
    setEditingPost(null);
    setDialogOpen(true);
  };

  const handleEditPost = (post: any) => {
    setEditingPost(post);
    setDialogOpen(true);
  };

  const handleNotifySubscribers = async (postId: string) => {
    try {
      const { error } = await supabase.functions.invoke("notify-new-exclusive-content", {
        body: { post_id: postId },
      });

      if (error) throw error;

      toast({
        title: "Success",
        description: "Subscribers have been notified about this post",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
      const { error } = await supabase
        .from("artist_exclusive_posts")
        .delete()
        .eq("id", postId);

      if (error) throw error;

      setPosts(posts.filter((p) => p.id !== postId));
      toast({
        title: "Post Deleted",
        description: "The exclusive content has been removed",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to delete post",
        variant: "destructive",
      });
    }
  };

  const toggleBeatSelection = (beatId: string) => {
    setSelectedBeatIds((prev) => {
      if (prev.includes(beatId)) {
        return prev.filter((id) => id !== beatId);
      } else {
        if (prev.length >= 10) {
          toast({
            title: "Limit Reached",
            description: "You can only select up to 10 exclusive tracks",
            variant: "destructive",
          });
          return prev;
        }
        return [...prev, beatId];
      }
    });
  };

  const saveExclusiveBeats = async () => {
    if (!epkProfileId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from("artist_epk_profiles")
        .update({ exclusive_beat_ids: selectedBeatIds })
        .eq("id", epkProfileId);

      if (error) throw error;

      toast({
        title: "Saved",
        description: "Exclusive music updated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: "Failed to save exclusive music",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Exclusive Music Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Music className="h-6 w-6" />
              Exclusive Music
            </h2>
            <p className="text-muted-foreground">
              Select up to 10 tracks for members only ({selectedBeatIds.length}/10 selected)
            </p>
          </div>
          <Button 
            onClick={saveExclusiveBeats} 
            disabled={saving}
            className="bg-gradient-to-r from-primary to-accent"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Save className="h-4 w-4 mr-2" />}
            Save Music
          </Button>
        </div>

        {beats.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-2">
            <Music className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground">
              No beats uploaded yet. Upload beats to make them exclusive for your fans!
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {beats.map((beat) => (
              <Card
                key={beat.id}
                className={`p-4 cursor-pointer transition-all ${
                  selectedBeatIds.includes(beat.id)
                    ? "border-primary border-2 bg-primary/5"
                    : "hover:border-primary/50"
                }`}
                onClick={() => toggleBeatSelection(beat.id)}
              >
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={selectedBeatIds.includes(beat.id)}
                    onCheckedChange={() => toggleBeatSelection(beat.id)}
                    className="mt-1"
                  />
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      {beat.artwork_url && (
                        <img
                          src={beat.artwork_url}
                          alt={beat.title}
                          className="h-10 w-10 rounded object-cover"
                        />
                      )}
                      <div className="flex-1">
                        <h3 className="font-semibold text-sm">{beat.title}</h3>
                        {beat.genre && (
                          <Badge variant="secondary" className="text-xs mt-1">
                            {beat.genre}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Exclusive Posts Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <Lock className="h-6 w-6" />
              Exclusive Posts
            </h2>
            <p className="text-muted-foreground">Members-only posts and updates</p>
          </div>
          <Button onClick={handleAddPost} className="bg-gradient-to-r from-primary to-accent">
            <Plus className="h-4 w-4 mr-2" />
            Create Post
          </Button>
        </div>

        {posts.length === 0 ? (
          <Card className="p-8 text-center border-dashed border-2">
            <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <p className="text-muted-foreground mb-4">
              No exclusive posts yet. Create members-only posts to reward your subscribers!
            </p>
            <Button variant="outline" onClick={handleAddPost}>
              <Plus className="h-4 w-4 mr-2" />
              Create Your First Post
            </Button>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {posts.map((post) => (
              <Card key={post.id} className="p-4 border-l-4 border-l-primary/50">
                <div className="flex items-start justify-between mb-3">
                  <h3 className="font-semibold">{post.title}</h3>
                  <Badge variant="outline" className="capitalize">
                    {post.required_tier.replace("_", " ")}
                  </Badge>
                </div>
                <p className="text-sm text-muted-foreground line-clamp-2">{post.content}</p>
                <div className="flex gap-2 mt-4">
                  <Button variant="outline" size="sm" onClick={() => handleEditPost(post)}>
                    Edit
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => handleNotifySubscribers(post.id)}>
                    Notify
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    className="text-destructive"
                    onClick={() => handleDeletePost(post.id)}
                  >
                    Delete
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        )}
      </div>

      <ExclusivePostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingPost={editingPost}
        onSuccess={loadData}
      />
    </div>
  );
}
