import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Volume2, VolumeX, Repeat, Shuffle, SkipBack, SkipForward } from 'lucide-react';
import { useAudio } from '@/contexts/AudioContext';

interface WaveformPlayerProps {
  track: {
    id: string;
    title: string;
    artist: string;
    file_url: string;
    artwork_url?: string;
    duration?: number;
  };
  className?: string;
}

export function WaveformPlayer({ track, className = '' }: WaveformPlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Generate mock waveform data (in a real app, you'd analyze the audio file)
  const generateWaveformData = useCallback(() => {
    const dataPoints = 200;
    const data = [];
    for (let i = 0; i < dataPoints; i++) {
      // Create a more realistic waveform pattern
      const baseAmplitude = Math.sin(i / 20) * 0.5 + 0.5;
      const noise = (Math.random() - 0.5) * 0.3;
      const amplitude = Math.max(0.1, Math.min(1, baseAmplitude + noise));
      data.push(amplitude);
    }
    setWaveformData(data);
  }, []);

  // Draw waveform on canvas
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
      const barHeight = amplitude * height * 0.8;
      const x = index * barWidth;
      const y = (height - barHeight) / 2;

      // Create gradient for bars
      const gradient = ctx.createLinearGradient(0, y, 0, y + barHeight);
      
      if (index / waveformData.length <= progress) {
        // Played portion - neon colors
        gradient.addColorStop(0, 'hsl(190, 100%, 50%)'); // neon-cyan
        gradient.addColorStop(0.5, 'hsl(320, 100%, 50%)'); // neon-magenta
        gradient.addColorStop(1, 'hsl(220, 100%, 65%)'); // electric-blue
      } else {
        // Unplayed portion - muted white
        gradient.addColorStop(0, 'rgba(255, 255, 255, 0.8)');
        gradient.addColorStop(1, 'rgba(255, 255, 255, 0.4)');
      }

      ctx.fillStyle = gradient;
      ctx.fillRect(x, y, barWidth - 1, barHeight);
    });

    // Draw playhead
    if (progress > 0) {
      const playheadX = progress * width;
      ctx.strokeStyle = 'hsl(190, 100%, 50%)';
      ctx.lineWidth = 2;
      ctx.shadowColor = 'hsl(190, 100%, 50%)';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      ctx.shadowBlur = 0;
    }
  }, [waveformData, currentTime, duration]);

  // Handle canvas click for seeking
  const handleCanvasClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    const audio = audioRef.current;
    if (!canvas || !audio || !duration) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const progress = clickX / canvas.width;
    const seekTime = progress * duration;

    audio.currentTime = seekTime;
    setCurrentTime(seekTime);
  };

  // Audio event handlers
  const handleLoadedMetadata = () => {
    const audio = audioRef.current;
    if (audio) {
      setDuration(audio.duration);
      setIsLoading(false);
    }
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (audio) {
      setCurrentTime(audio.currentTime);
    }
  };

  const handlePlay = () => setIsPlaying(true);
  const handlePause = () => setIsPlaying(false);

  // Control handlers
  const togglePlayPause = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isPlaying) {
      audio.pause();
    } else {
      audio.play();
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    const audio = audioRef.current;
    if (!audio) return;

    if (isMuted) {
      audio.volume = volume;
      setIsMuted(false);
    } else {
      audio.volume = 0;
      setIsMuted(true);
    }
  };

  const toggleLoop = () => {
    const audio = audioRef.current;
    if (!audio) return;

    const newLooping = !isLooping;
    setIsLooping(newLooping);
    audio.loop = newLooping;
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  // Initialize
  useEffect(() => {
    generateWaveformData();
  }, [generateWaveformData]);

  // Redraw waveform when data changes
  useEffect(() => {
    drawWaveform();
  }, [drawWaveform]);

  // Handle canvas resize
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;

      canvas.width = container.clientWidth;
      canvas.height = 120;
      drawWaveform();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawWaveform]);

  return (
    <div className={`bg-black/90 backdrop-blur-sm rounded-xl p-6 glass-morphism ${className}`}>
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={track.file_url}
        onLoadedMetadata={handleLoadedMetadata}
        onTimeUpdate={handleTimeUpdate}
        onPlay={handlePlay}
        onPause={handlePause}
        onEnded={() => setIsPlaying(false)}
      />

      {/* Track Info */}
      <div className="flex items-center gap-4 mb-6">
        {track.artwork_url && (
          <div className="w-16 h-16 rounded-lg overflow-hidden">
            <img 
              src={track.artwork_url} 
              alt={track.title}
              className="w-full h-full object-cover"
            />
          </div>
        )}
        <div className="flex-1">
          <h3 className="text-lg font-semibold text-white mb-1">{track.title}</h3>
          <p className="text-neon-cyan">{track.artist}</p>
        </div>
      </div>

      {/* Waveform */}
      <div className="relative mb-6">
        <canvas
          ref={canvasRef}
          onClick={handleCanvasClick}
          className="w-full cursor-pointer rounded-lg"
          style={{ height: '120px' }}
        />
        {isLoading && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-lg">
            <div className="text-white">Loading...</div>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="flex items-center gap-3 mb-6 text-sm text-gray-300">
        <span className="text-neon-cyan min-w-[45px]">{formatTime(currentTime)}</span>
        <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-neon-cyan to-neon-magenta transition-all duration-100"
            style={{ width: `${duration ? (currentTime / duration) * 100 : 0}%` }}
          />
        </div>
        <span className="text-gray-400 min-w-[45px]">{formatTime(duration)}</span>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-4">
        {/* Secondary Controls */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setIsShuffling(!isShuffling)}
          className={`text-white hover:text-neon-cyan ${isShuffling ? 'text-neon-cyan' : ''}`}
        >
          <Shuffle className="w-4 h-4" />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="text-white hover:text-neon-cyan"
        >
          <SkipBack className="w-4 h-4" />
        </Button>

        {/* Main Play/Pause Button */}
        <Button
          size="lg"
          onClick={togglePlayPause}
          disabled={isLoading}
          className="w-16 h-16 rounded-full bg-gradient-to-r from-neon-cyan to-electric-blue hover:from-neon-cyan-glow hover:to-electric-blue text-white neon-glow-hover"
        >
          {isPlaying ? (
            <Pause className="w-6 h-6" />
          ) : (
            <Play className="w-6 h-6 ml-0.5" />
          )}
        </Button>

        <Button
          size="sm"
          variant="ghost"
          className="text-white hover:text-neon-cyan"
        >
          <SkipForward className="w-4 h-4" />
        </Button>

        <Button
          size="sm"
          variant="ghost"
          onClick={toggleLoop}
          className={`text-white hover:text-neon-cyan ${isLooping ? 'text-neon-cyan' : ''}`}
        >
          <Repeat className="w-4 h-4" />
        </Button>

        {/* Volume Control */}
        <div className="flex items-center gap-2 ml-4">
          <Button
            size="sm"
            variant="ghost"
            onClick={toggleMute}
            className="text-white hover:text-neon-cyan"
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </Button>
          <div className="w-20">
            <Slider
              value={[isMuted ? 0 : volume]}
              onValueChange={handleVolumeChange}
              max={1}
              step={0.1}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}