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
    <Card className="fixed bottom-4 left-4 right-4 max-w-md mx-auto bg-card/95 backdrop-blur-lg border-border/20 rounded-xl p-2 shadow-lg z-50">
      <div className="flex items-center gap-2">
        {/* Album Artwork */}
        <Avatar className="w-10 h-10 rounded-lg flex-shrink-0">
          <AvatarImage src={currentTrack.artwork_url} alt="Album artwork" className="rounded-lg" />
          <AvatarFallback className="rounded-lg bg-primary/20">
            <div className="w-4 h-4 bg-primary/40 rounded" />
          </AvatarFallback>
        </Avatar>

        {/* Track Info & Progress */}
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center justify-between">
            <div className="min-w-0 flex-1">
              <h3 className="text-xs font-medium text-foreground truncate">{currentTrack.title}</h3>
              <p className="text-xs text-muted-foreground truncate">{currentTrack.artist || 'Unknown Artist'}</p>
            </div>
            <div className="text-xs text-muted-foreground ml-2 flex-shrink-0">
              {formatTime(currentTime)} / {formatTime(duration)}
            </div>
          </div>
          
          <div className="cursor-pointer" onClick={handleSeek}>
            <Progress value={progressPercent} className="h-1" />
          </div>
        </div>

        {/* Control Buttons */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 rounded-md"
          >
            <SkipBack className="w-3 h-3" />
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="w-8 h-8 rounded-md bg-primary/10 hover:bg-primary/20"
            onClick={togglePlayPause}
          >
            {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
          </Button>
          
          <Button
            variant="ghost"
            size="icon"
            className="w-7 h-7 rounded-md"
          >
            <SkipForward className="w-3 h-3" />
          </Button>
        </div>
      </div>
    </Card>
  );
}