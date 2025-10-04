import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface ExclusivePostDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingPost?: any;
  onSuccess: () => void;
}

export function ExclusivePostDialog({
  open,
  onOpenChange,
  editingPost,
  onSuccess,
}: ExclusivePostDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [previewText, setPreviewText] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [mediaType, setMediaType] = useState("text");
  const [requiredTier, setRequiredTier] = useState("fan");

  useEffect(() => {
    if (editingPost) {
      setTitle(editingPost.title || "");
      setContent(editingPost.content || "");
      setPreviewText(editingPost.preview_text || "");
      setMediaUrl(editingPost.media_url || "");
      setMediaType(editingPost.media_type || "text");
      setRequiredTier(editingPost.required_tier || "fan");
    } else {
      setTitle("");
      setContent("");
      setPreviewText("");
      setMediaUrl("");
      setMediaType("text");
      setRequiredTier("fan");
    }
  }, [editingPost, open]);

  const handleSave = async () => {
    if (!title || !content) {
      toast({
        title: "Missing Information",
        description: "Please provide a title and content",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const postData = {
        title,
        content,
        preview_text: previewText,
        media_url: mediaUrl || null,
        media_type: mediaType,
        required_tier: requiredTier,
        is_published: true,
        published_at: new Date().toISOString(),
      };

      if (editingPost) {
        const { error } = await supabase
          .from("artist_exclusive_posts")
          .update(postData)
          .eq("id", editingPost.id);

        if (error) throw error;

        toast({
          title: "Post Updated",
          description: "Your exclusive content has been updated",
        });
      } else {
        const { error } = await supabase
          .from("artist_exclusive_posts")
          .insert({
            ...postData,
            artist_id: user.id,
          });

        if (error) throw error;

        toast({
          title: "Post Created",
          description: "Your exclusive content is now live",
        });
      }

      onSuccess();
      onOpenChange(false);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save post",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{editingPost ? "Edit Post" : "Create Exclusive Content"}</DialogTitle>
          <DialogDescription>
            Share exclusive content with your subscribers
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              placeholder="Post title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="content">Content</Label>
            <Textarea
              id="content"
              placeholder="Full content visible to subscribers..."
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="preview">Preview Text (Non-subscribers)</Label>
            <Textarea
              id="preview"
              placeholder="Teaser text shown to non-subscribers..."
              value={previewText}
              onChange={(e) => setPreviewText(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="media-type">Media Type</Label>
            <Select value={mediaType} onValueChange={setMediaType}>
              <SelectTrigger id="media-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text Only</SelectItem>
                <SelectItem value="image">Image</SelectItem>
                <SelectItem value="video">Video</SelectItem>
                <SelectItem value="audio">Audio</SelectItem>
                <SelectItem value="download">Downloadable File</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {mediaType !== "text" && (
            <div className="space-y-2">
              <Label htmlFor="media-url">Media URL</Label>
              <Input
                id="media-url"
                placeholder="https://..."
                value={mediaUrl}
                onChange={(e) => setMediaUrl(e.target.value)}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="tier">Required Tier</Label>
            <Select value={requiredTier} onValueChange={setRequiredTier}>
              <SelectTrigger id="tier">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="fan">Fan ($4.99/mo)</SelectItem>
                <SelectItem value="super_fan">Super Fan ($9.99/mo)</SelectItem>
                <SelectItem value="ultra_fan">Ultra Fan ($24.99/mo)</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-gradient-to-r from-primary to-accent">
            {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
            {editingPost ? "Update" : "Create"} Post
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
