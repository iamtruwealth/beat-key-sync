import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Plus, Lock } from "lucide-react";
import { ExclusivePostDialog } from "./ExclusivePostDialog";

export function ExclusiveContentManager() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [posts, setPosts] = useState<any[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPost, setEditingPost] = useState<any>(null);

  useEffect(() => {
    loadExclusivePosts();
  }, []);

  const loadExclusivePosts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("artist_exclusive_posts")
        .select("*")
        .eq("artist_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPosts(data || []);
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold">Exclusive Content</h2>
          <p className="text-muted-foreground">Paywalled content for your subscribers</p>
        </div>
        <Button onClick={handleAddPost} className="bg-gradient-to-r from-primary to-accent">
          <Plus className="h-4 w-4 mr-2" />
          Create Post
        </Button>
      </div>

      {posts.length === 0 ? (
        <Card className="p-12 text-center border-dashed border-2">
          <Lock className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground mb-4">
            No exclusive content yet. Create members-only posts to reward your subscribers!
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

      <ExclusivePostDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingPost={editingPost}
        onSuccess={loadExclusivePosts}
      />
    </div>
  );
}
