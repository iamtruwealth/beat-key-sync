import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Play, Plus, Pause, Headphones, SkipBack, SkipForward } from "lucide-react";
import { useState } from "react";

interface MusicPlayerProps {
  track?: {
    title: string;
    artist: string;
    artwork: string;
    currentTime: number;
    duration: number;
    isPlaying: boolean;
  };
}

export function MusicPlayer({ track }: MusicPlayerProps) {
  const [isPlaying, setIsPlaying] = useState(track?.isPlaying || false);
  
  const defaultTrack = {
    title: "Goon Gumpas",
    artist: "Aphex Twin", 
    artwork: "/placeholder.svg",
    currentTime: 48,
    duration: 122,
    isPlaying: false
  };

  const currentTrack = track || defaultTrack;
  const progressPercent = (currentTrack.currentTime / currentTrack.duration) * 100;
  
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const togglePlay = () => {
    setIsPlaying(!isPlaying);
  };

  return (
    <Card className="fixed bottom-4 left-4 right-4 md:left-6 md:right-6 bg-card/95 backdrop-blur-lg border-border/20 rounded-3xl p-4 shadow-2xl">
      <div className="flex items-center gap-4">
        {/* Album Artwork */}
        <Avatar className="w-16 h-16 rounded-2xl">
          <AvatarImage src={currentTrack.artwork} alt="Album artwork" className="rounded-2xl" />
          <AvatarFallback className="rounded-2xl bg-muted">
            <div className="w-8 h-8 bg-primary/20 rounded-lg" />
          </AvatarFallback>
        </Avatar>

        {/* Track Info & Progress */}
        <div className="flex-1 space-y-2">
          <div>
            <p className="text-sm text-muted-foreground">{currentTrack.artist}</p>
            <h3 className="text-lg font-semibold text-foreground">{currentTrack.title}</h3>
          </div>
          
          <div className="space-y-1">
            <Progress value={progressPercent} className="h-1.5" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTrack.currentTime)}</span>
              <span>{formatTime(currentTrack.duration)}</span>
            </div>
          </div>
        </div>

        {/* Control Buttons Grid */}
        <div className="grid grid-cols-3 gap-2">
          {/* Top Row */}
          <Button
            variant="ghost"
            size="icon"
            className="w-12 h-12 rounded-2xl bg-muted/20 hover:bg-muted/40"
            onClick={togglePlay}
          >
            {isPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="w-12 h-12 rounded-2xl bg-muted/20 hover:bg-muted/40"
          >
            <Plus className="w-5 h-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="w-12 h-12 rounded-2xl bg-muted/20 hover:bg-muted/40"
          >
            <Pause className="w-5 h-5" />
          </Button>

          {/* Bottom Row */}
          <Button
            variant="ghost"
            size="icon"
            className="w-12 h-12 rounded-2xl bg-muted/20 hover:bg-muted/40"
          >
            <Headphones className="w-5 h-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="w-12 h-12 rounded-2xl bg-muted/20 hover:bg-muted/40"
          >
            <SkipBack className="w-5 h-5" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="w-12 h-12 rounded-2xl bg-muted/20 hover:bg-muted/40"
          >
            <SkipForward className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </Card>
  );
}