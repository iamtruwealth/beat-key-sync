import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Play, Plus, Pause, Headphones, SkipBack, SkipForward, Volume2 } from "lucide-react";
import { useAudio } from "@/contexts/AudioContext";

export function MusicPlayer() {
  const { 
    currentTrack, 
    isPlaying, 
    currentTime, 
    duration, 
    volume,
    togglePlayPause,
    seekTo,
    setVolume 
  } = useAudio();

  // Don't render if no track is loaded
  if (!currentTrack) {
    return null;
  }

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;
  
  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const newTime = (clickX / rect.width) * duration;
    seekTo(newTime);
  };

  return (
    <Card className="fixed bottom-4 left-4 right-4 md:left-6 md:right-6 bg-card/95 backdrop-blur-lg border-border/20 rounded-2xl p-3 shadow-lg">
      <div className="flex items-center gap-3">
        {/* Album Artwork */}
        <Avatar className="w-12 h-12 rounded-xl">
          <AvatarImage src={currentTrack.artwork_url} alt="Album artwork" className="rounded-xl" />
          <AvatarFallback className="rounded-xl bg-muted">
            <div className="w-6 h-6 bg-primary/20 rounded-lg" />
          </AvatarFallback>
        </Avatar>

        {/* Track Info & Progress */}
        <div className="flex-1 space-y-1">
          <div>
            <p className="text-xs text-muted-foreground">{currentTrack.artist || 'Unknown Artist'}</p>
            <h3 className="text-sm font-semibold text-foreground truncate">{currentTrack.title}</h3>
          </div>
          
          <div className="space-y-1">
            <div className="cursor-pointer" onClick={handleSeek}>
              <Progress value={progressPercent} className="h-1" />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{formatTime(currentTime)}</span>
              <span>{formatTime(duration)}</span>
            </div>
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-lg bg-muted/20 hover:bg-muted/40"
          >
            <SkipBack className="w-4 h-4" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-lg bg-muted/20 hover:bg-muted/40"
            onClick={togglePlayPause}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-lg bg-muted/20 hover:bg-muted/40"
          >
            <SkipForward className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </Card>
  );
}