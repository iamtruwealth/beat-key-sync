import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Play, Pause } from 'lucide-react';

interface CompactWaveformPlayerProps {
  track: {
    id: string;
    title: string;
    file_url?: string;
    audio_file_url?: string;
  };
  isPlaying: boolean;
  onPlay: () => void;
  onPause: () => void;
  className?: string;
}

export function CompactWaveformPlayer({ 
  track, 
  isPlaying, 
  onPlay, 
  onPause,
  className = '' 
}: CompactWaveformPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  const audioUrl = track.file_url || track.audio_file_url;

  // Generate compact waveform data
  const generateWaveformData = useCallback(() => {
    const dataPoints = 60; // Fewer points for compact view
    const data = [];
    for (let i = 0; i < dataPoints; i++) {
      const baseAmplitude = Math.sin(i / 8) * 0.6 + 0.4;
      const noise = (Math.random() - 0.5) * 0.4;
      const amplitude = Math.max(0.2, Math.min(1, baseAmplitude + noise));
      data.push(amplitude);
    }
    setWaveformData(data);
  }, []);

  // Draw compact waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || waveformData.length === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const barWidth = width / waveformData.length;
    const progress = duration ? currentTime / duration : 0;

    waveformData.forEach((amplitude, index) => {
      const barHeight = amplitude * height * 0.7;
      const x = index * barWidth;
      const y = (height - barHeight) / 2;

      // Create gradient for bars
      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      
      if (index / waveformData.length <= progress && isPlaying) {
        // Playing portion - neon colors
        gradient.addColorStop(0, 'hsl(190, 100%, 50%)');
        gradient.addColorStop(1, 'hsl(320, 100%, 50%)');
      } else if (isHovered) {
        // Hovered state
        gradient.addColorStop(0, 'hsl(220, 100%, 65%)');
        gradient.addColorStop(1, 'hsl(190, 100%, 50%)');
      } else {
        // Default state
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.6)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.3)');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, Math.max(1, barWidth - 0.5), barHeight);
    });

    // Draw playhead for playing tracks
    if (isPlaying && progress > 0) {
      const playheadX = progress * width;
      ctx.strokeStyle = 'hsl(190, 100%, 50%)';
      ctx.lineWidth = 1;
      ctx.shadowColor = 'hsl(190, 100%, 50%)';
      ctx.shadowBlur = 4;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [waveformData, currentTime, duration, isPlaying, isHovered]);

  // Handle waveform click for seeking
  const handleWaveformClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    const canvas = canvasRef.current;
    if (!canvas || !audioUrl) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const progress = clickX / canvas.width;

    if (!isPlaying) {
      onPlay();
    }

    // If we have duration, seek to that position
    if (duration > 0 && audioRef.current) {
      const seekTime = progress * duration;
      audioRef.current.currentTime = seekTime;
    }
  };

  // Handle play/pause button
  const handlePlayPause = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (isPlaying) {
      onPause();
    } else {
      onPlay();
    }
  };

  // Audio event handlers
  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio) {
      setDuration(audio.duration);
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
    }
  };

  // Sync with external audio player
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !audioUrl) return;

    if (isPlaying) {
      audio.play().catch(console.error);
    } else {
      audio.pause();
    }
  }, [isPlaying, audioUrl]);

  // Initialize waveform
  useEffect(() => {
    generateWaveformData();
  }, [generateWaveformData]);

  // Redraw waveform
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Canvas setup
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.width = 200;
    canvas.height = 60;
    drawWaveform();
  }, [drawWaveform]);

  if (!audioUrl) {
    return (
      <div className={`relative w-50 h-15 bg-muted rounded-lg flex items-center justify-center ${className}`}>
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePlayPause}
          className="text-muted-foreground"
        >
          <Play className="w-4 h-4" />
        </Button>
      </div>
    );
  }

  return (
    <div 
      className={`relative w-50 h-15 bg-black/20 rounded-lg overflow-hidden cursor-pointer group ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        preload="metadata"
      />

      {/* Waveform Canvas */}
      <canvas
        ref={canvasRef}
        onClick={handleWaveformClick}
        className="absolute inset-0 w-full h-full"
        style={{ width: '200px', height: '60px' }}
      />

      {/* Play/Pause Overlay */}
      <div className="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
        <Button
          variant="ghost"
          size="sm"
          onClick={handlePlayPause}
          className="text-white hover:text-neon-cyan transition-colors"
        >
          {isPlaying ? (
            <Pause className="w-5 h-5" />
          ) : (
            <Play className="w-5 h-5 ml-0.5" />
          )}
        </Button>
      </div>

      {/* Progress indicator */}
      {isPlaying && (
        <div className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-neon-cyan to-neon-magenta transition-all duration-100"
             style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }} />
      )}
    </div>
  );
}