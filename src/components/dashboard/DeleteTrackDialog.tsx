import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Tables } from "@/integrations/supabase/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, AlertTriangle } from "lucide-react";

type Track = Tables<"tracks">;

interface DeleteTrackDialogProps {
  track: Track | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTrackDeleted: (trackId: string) => void;
}

export function DeleteTrackDialog({ track, open, onOpenChange, onTrackDeleted }: DeleteTrackDialogProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    if (!track) return;

    setIsLoading(true);
    try {
      // Delete from beat pack associations first (foreign key constraint)
      await supabase
        .from('beat_pack_tracks')
        .delete()
        .eq('track_id', track.id);

      // Delete the file from storage if it exists
      if (track.file_url) {
        const fileName = track.file_url.split('/').pop();
        if (fileName) {
          await supabase.storage
            .from('audio-files')
            .remove([fileName]);
        }
      }

      // Delete artwork from storage if it exists
      if (track.artwork_url) {
        const artworkFileName = track.artwork_url.split('/').pop();
        if (artworkFileName) {
          await supabase.storage
            .from('artwork')
            .remove([artworkFileName]);
        }
      }

      // Delete the track record
      const { error } = await supabase
        .from('tracks')
        .delete()
        .eq('id', track.id);

      if (error) throw error;

      onTrackDeleted(track.id);
      onOpenChange(false);
      toast({
        title: "Success",
        description: "Track deleted successfully",
      });
    } catch (error) {
      console.error('Error deleting track:', error);
      toast({
        title: "Error",
        description: "Failed to delete track",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (!track) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            Delete Track
          </DialogTitle>
          <DialogDescription>
            This action cannot be undone. This will permanently delete the track
            "{track.title}" and remove it from all beat packs and storage.
          </DialogDescription>
        </DialogHeader>
        
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            onClick={handleDelete} 
            disabled={isLoading}
          >
            {isLoading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
            Delete Track
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}