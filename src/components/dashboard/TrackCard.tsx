import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Play, Share2, MoreHorizontal, Clock, Music2 } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tables } from "@/integrations/supabase/types";

type Track = Tables<"tracks">;

interface TrackCardProps {
  track: Track & {
    formattedDuration?: string;
    formattedSize?: string;
    lastModified?: string;
  };
}

export function TrackCard({ track }: TrackCardProps) {
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

  return (
    <Card className="group hover:shadow-lg hover:shadow-primary/10 transition-all duration-300 border-border/50 bg-card/80 backdrop-blur-sm">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1 min-w-0 flex-1">
            <CardTitle className="text-lg font-semibold group-hover:text-primary transition-colors truncate">
              {track.title}
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              {track.format?.toUpperCase() || 'Audio'} • {formatFileSize(track.file_size)}
              {track.sample_rate && ` • ${track.sample_rate}Hz`}
            </CardDescription>
          </div>
          
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0">
                <MoreHorizontal className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem>Open Track</DropdownMenuItem>
              <DropdownMenuItem>Edit Metadata</DropdownMenuItem>
              <DropdownMenuItem>Download</DropdownMenuItem>
              <DropdownMenuItem>Share</DropdownMenuItem>
              <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
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
            {track.tags && track.tags.length > 0 && (
              <Badge variant="outline" className="border-accent/30 text-accent">
                {track.tags[0]}
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
            Uploaded {getTimeAgo(track.created_at)}
          </span>
          
          <div className="flex items-center gap-2">
            <Button variant="waveform" size="sm">
              <Play className="w-3 h-3" />
              Play
            </Button>
            <Button variant="outline" size="sm">
              <Share2 className="w-3 h-3" />
              Share
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}