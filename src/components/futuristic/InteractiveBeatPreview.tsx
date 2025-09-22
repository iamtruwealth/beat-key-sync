import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Play, Pause, Download, Activity } from "lucide-react";
import { useAudio } from "@/contexts/AudioContext";

interface BeatPreviewProps {
  beat: {
    id: string;
    title: string;
    producer: string;
    price: number;
    preview_url?: string;
    artwork_url?: string;
    waveform_data?: number[];
  };
}

export function InteractiveBeatPreview({ beat }: BeatPreviewProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { currentTrack, isPlaying, playTrack } = useAudio();
  
  const isCurrentlyPlaying = currentTrack?.id === beat.id && isPlaying;

  // Generate mock waveform data if not provided
  useEffect(() => {
    if (beat.waveform_data) {
      setWaveformData(beat.waveform_data);
    } else {
      // Generate mock waveform data
      const mockData = Array.from({ length: 100 }, () => Math.random() * 100);
      setWaveformData(mockData);
    }
  }, [beat.waveform_data]);

  // Draw waveform on canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const barWidth = width / waveformData.length;
    
    waveformData.forEach((value, index) => {
      const barHeight = (value / 100) * height;
      const x = index * barWidth;
      const y = height - barHeight;

      // Create gradient for bars
      const gradient = ctx.createLinearGradient(0, y, 0, height);
      if (isCurrentlyPlaying) {
        gradient.addColorStop(0, 'hsl(190, 100%, 50%)'); // neon-cyan
        gradient.addColorStop(1, 'hsl(320, 100%, 50%)'); // neon-magenta
      } else if (isHovered) {
        gradient.addColorStop(0, 'hsl(220, 100%, 65%)'); // electric-blue
        gradient.addColorStop(1, 'hsl(190, 100%, 50%)'); // neon-cyan
      } else {
        gradient.addColorStop(0, 'hsl(215, 20%, 65%)'); // muted-foreground
        gradient.addColorStop(1, 'hsl(220, 13%, 15%)'); // muted
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });
  }, [waveformData, isHovered, isCurrentlyPlaying]);

  const handlePlay = () => {
    if (beat.preview_url) {
        playTrack({
        id: beat.id,
        title: beat.title,
        artist: beat.producer,
        file_url: beat.preview_url || "",
        artwork_url: beat.artwork_url
      });
    }
  };

  return (
    <Card 
      className={`group relative overflow-hidden border-2 transition-all duration-300 cursor-pointer transform hover:scale-105 hover:-translate-y-2 ${
        isHovered || isCurrentlyPlaying
          ? "border-neon-cyan shadow-lg shadow-neon-cyan/30 neon-glow" 
          : "border-border hover:border-electric-blue"
      }`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-card via-card to-muted opacity-90" />
      
      {/* Animated background particles */}
      {isHovered && (
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute w-2 h-2 bg-neon-cyan rounded-full animate-float top-4 left-4 opacity-60" />
          <div className="absolute w-1 h-1 bg-neon-magenta rounded-full animate-float top-8 right-6 opacity-40" style={{ animationDelay: '0.5s' }} />
          <div className="absolute w-1.5 h-1.5 bg-electric-blue rounded-full animate-float bottom-6 left-8 opacity-50" style={{ animationDelay: '1s' }} />
        </div>
      )}

      <CardContent className="relative p-6 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h3 className={`font-semibold text-lg transition-colors ${
              isHovered || isCurrentlyPlaying ? "text-neon-cyan" : "text-foreground"
            }`}>
              {beat.title}
            </h3>
            <p className="text-sm text-muted-foreground">by {beat.producer}</p>
          </div>
          <div className={`text-xl font-bold transition-colors ${
            isHovered || isCurrentlyPlaying ? "text-electric-blue" : "text-foreground"
          }`}>
            ${beat.price}
          </div>
        </div>

        {/* Waveform Visualization */}
        <div className="relative h-24 bg-muted/30 rounded-lg overflow-hidden glass-morphism">
          <canvas
            ref={canvasRef}
            width={300}
            height={96}
            className="w-full h-full"
          />
          
          {/* Play overlay */}
          <div className="absolute inset-0 flex items-center justify-center">
            <Button
              size="sm"
              variant="ghost"
              onClick={handlePlay}
              className={`rounded-full w-12 h-12 transition-all duration-300 ${
                isCurrentlyPlaying 
                  ? "bg-neon-cyan/20 text-neon-cyan neon-glow" 
                  : "bg-background/80 hover:bg-neon-cyan/20 hover:text-neon-cyan hover:scale-110"
              }`}
            >
              {isCurrentlyPlaying ? <Pause className="w-5 h-5" /> : <Play className="w-5 h-5" />}
            </Button>
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center justify-between pt-2">
          <div className="flex items-center space-x-2">
            <Activity className={`w-4 h-4 transition-colors ${
              isHovered || isCurrentlyPlaying ? "text-neon-magenta" : "text-muted-foreground"
            }`} />
            <span className="text-xs text-muted-foreground">
              {beat.preview_url ? "Preview Available" : "No Preview"}
            </span>
          </div>
          
          <div className="flex space-x-2">
            {beat.price === 0 && (
              <Button
                size="sm"
                variant="outline"
                className="border-neon-green text-neon-green hover:bg-neon-green hover:text-background transition-all duration-300"
              >
                <Download className="w-4 h-4 mr-1" />
                Free
              </Button>
            )}
            <Button
              size="sm"
              className={`transition-all duration-300 ${
                isHovered || isCurrentlyPlaying
                  ? "bg-gradient-to-r from-neon-magenta to-neon-purple hover:from-neon-magenta-glow hover:to-neon-purple text-white neon-glow-hover"
                  : "bg-primary hover:bg-primary/90"
              }`}
            >
              {beat.price === 0 ? "Download" : "Purchase"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}