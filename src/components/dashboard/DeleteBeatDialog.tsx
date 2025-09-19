import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tables } from "@/integrations/supabase/types";

type Beat = Tables<"beats">;

interface DeleteTrackDialogProps {
  track: Beat;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onTrackDeleted: (trackId: string) => void;
}

export function DeleteTrackDialog({ track, open, onOpenChange, onTrackDeleted }: DeleteTrackDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const handleDelete = async () => {
    setLoading(true);
    try {
      // Delete from beat pack associations first (foreign key constraint)
      await supabase
        .from('beat_pack_tracks')
        .delete()
        .eq('track_id', track.id);

      // Delete the beat record
      const { error } = await supabase
        .from('beats')
        .delete()
        .eq('id', track.id);

      if (error) throw error;

      onTrackDeleted(track.id);
      onOpenChange(false);
      
      toast({
        title: "Beat deleted",
        description: "The beat has been permanently removed from your library."
      });
    } catch (error) {
      console.error('Error deleting beat:', error);
      toast({
        title: "Error",
        description: "Failed to delete the beat. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Beat</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete "{track.title}"? This action cannot be undone.
            The beat will be removed from all beat packs and permanently deleted.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={loading}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={loading}
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
          >
            {loading ? "Deleting..." : "Delete Beat"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}