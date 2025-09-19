import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Pause, Share2, MoreHorizontal, Clock, Music2, Users, Loader2, Edit, Trash2, Download } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tables } from "@/integrations/supabase/types";
import { useAudio } from "@/contexts/AudioContext";
import { TrackMetadataDialog } from "./BeatMetadataDialog";
import { DeleteTrackDialog } from "./DeleteBeatDialog";
import { useState } from "react";
import { useToast } from "@/hooks/use-toast";

type Beat = Tables<"beats">;

interface BeatCardProps {
  track: Beat & {
    formattedDuration?: string;
    formattedSize?: string;
    lastModified?: string;
    is_beat?: boolean;
  };
  onTrackUpdated?: (updatedTrack: Beat) => void;
  onTrackDeleted?: (trackId: string) => void;
}

export function TrackCard({ track, onTrackUpdated, onTrackDeleted }: BeatCardProps) {
  const { currentTrack, isPlaying, loading, playTrack } = useAudio();
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const { toast } = useToast();
  const formatDuration = (duration: number | null) => {
    if (!duration) return "0:00";
    const minutes = Math.floor(duration / 60);
    const seconds = Math.floor(duration % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "0 MB";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(1)} MB`;
  };

  const getTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInHours = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60));
    
    if (diffInHours < 1) return "Just now";
    if (diffInHours < 24) return `${diffInHours}h ago`;
    if (diffInHours < 168) return `${Math.floor(diffInHours / 24)}d ago`;
    return date.toLocaleDateString();
  };

  const displayBpm = track.manual_bpm || track.detected_bpm;
  const displayKey = track.manual_key || track.detected_key;
  
  // Handle beat-specific data
  const isBeat = track.is_beat;
  const beatMetadata = track.metadata as any;
  const price = beatMetadata?.price_cents || 0;
  const isFree = beatMetadata?.is_free || false;
  const genre = beatMetadata?.genre;

  const handlePlayClick = () => {
    if (!track.file_url) return;
    
    const audioTrack = {
      id: track.id,
      title: track.title,
      artist: track.artist || 'Unknown Artist',
      file_url: track.file_url,
      artwork_url: track.artwork_url || undefined,
      duration: track.duration || undefined,
      detected_key: track.detected_key || undefined,
      detected_bpm: track.detected_bpm || undefined,
      manual_key: track.manual_key || undefined,
      manual_bpm: track.manual_bpm || undefined,
    };
    
    playTrack(audioTrack);
  };

  const isCurrentTrack = currentTrack?.id === track.id;
  const showPlayButton = !isCurrentTrack || !isPlaying;

  const handleDownload = () => {
    if (track.file_url) {
      const link = document.createElement('a');
      link.href = track.file_url;
      link.download = `${track.title}.${track.format || 'mp3'}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast({
        title: "Download started",
        description: `Downloading ${track.title}`,
      });
    }
  };

  const handleShare = () => {
    if (navigator.share) {
      navigator.share({
        title: track.title,
        text: `Check out this track: ${track.title}`,
        url: window.location.href,
      });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast({
        title: "Link copied",
        description: "Track link copied to clipboard",
      });
    }
  };

  const handleTrackUpdated = (updatedTrack: Beat) => {
    onTrackUpdated?.(updatedTrack);
  };

  const handleTrackDeleted = (trackId: string) => {
    onTrackDeleted?.(trackId);
  };

  return (
    <Card className="group hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3 min-w-0 flex-1">
            {/* Album Artwork */}
            <div className="w-12 h-12 rounded-md overflow-hidden bg-muted flex-shrink-0">
              {track.artwork_url ? (
                <img 
                  src={track.artwork_url} 
                  alt={`${track.title} artwork`}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Music2 className="w-5 h-5 text-muted-foreground" />
                </div>
              )}
            </div>
            
            <div className="space-y-1 min-w-0 flex-1">
              <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors truncate">
                {track.title}
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                {isBeat 
                  ? `${genre || 'Beat'} • For Sale`
                  : `${track.stems?.length || 0} stems • 1 collaborator`
                }
              </CardDescription>
            </div>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={() => setEditDialogOpen(true)}>
                <Edit className="w-4 h-4 mr-2" />
                Edit Metadata
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleDownload}>
                <Download className="w-4 h-4 mr-2" />
                Download
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleShare}>
                <Share2 className="w-4 h-4 mr-2" />
                Share
              </DropdownMenuItem>
              <DropdownMenuItem 
                className="text-destructive focus:text-destructive"
                onClick={() => setDeleteDialogOpen(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {displayKey && (
              <Badge variant="outline" className="border-primary/30 text-primary">
                {displayKey}
              </Badge>
            )}
            {displayBpm && (
              <Badge variant="outline" className="border-secondary/30 text-secondary">
                {displayBpm} BPM
              </Badge>
            )}
            {/* Price Badge */}
            {isBeat ? (
              <Badge variant="outline" className={isFree ? "border-green-500/30 text-green-600" : "border-blue-500/30 text-blue-600"}>
                {isFree ? 'FREE' : `$${(price / 100).toFixed(2)}`}
              </Badge>
            ) : (
              <Badge variant="outline" className="border-green-500/30 text-green-600">
                FREE
              </Badge>
            )}
          </div>
          
          <div className="flex items-center gap-1 text-sm text-muted-foreground">
            <Clock className="w-3 h-3" />
            {formatDuration(track.duration)}
          </div>
        </div>
        
        {/* Waveform Placeholder */}
        <div className="h-16 bg-muted/30 rounded-md relative overflow-hidden">
          {track.waveform_data ? (
            <div className="absolute inset-0 flex items-center justify-center">
              {/* TODO: Render actual waveform data */}
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-primary/40 rounded-full"
                    style={{
                      height: `${Math.random() * 40 + 10}px`,
                      opacity: Math.random() * 0.7 + 0.3,
                    }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex items-center gap-0.5">
                {Array.from({ length: 40 }).map((_, i) => (
                  <div
                    key={i}
                    className="w-0.5 bg-primary/40 rounded-full"
                    style={{
                      height: `${Math.random() * 40 + 10}px`,
                      opacity: Math.random() * 0.7 + 0.3,
                    }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
        
        <div className="flex items-center justify-between pt-2">
          <span className="text-sm text-muted-foreground">
            Modified {getTimeAgo(track.updated_at || track.created_at)}
          </span>
          
          <div className="flex items-center gap-2">
            <Button 
              variant="waveform" 
              size="sm" 
              onClick={handlePlayClick}
              disabled={!track.file_url || loading}
              className={isCurrentTrack ? "bg-primary/20 border-primary" : ""}
            >
              {loading && isCurrentTrack ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : showPlayButton ? (
                <Play className="w-3 h-3" />
              ) : (
                <Pause className="w-3 h-3" />
              )}
              {showPlayButton ? "Play" : "Playing"}
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="w-3 h-3" />
              Share
            </Button>
          </div>
        </div>
      </CardContent>

      <TrackMetadataDialog
        track={track}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onTrackUpdated={handleTrackUpdated}
      />

      <DeleteTrackDialog
        track={track}
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        onTrackDeleted={handleTrackDeleted}
      />
    </Card>
  );
}