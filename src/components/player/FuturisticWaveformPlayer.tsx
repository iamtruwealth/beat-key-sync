import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Repeat, Shuffle } from 'lucide-react';
import { useAudio } from '@/contexts/AudioContext';

export function FuturisticWaveformPlayer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>();
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const sourceRef = useRef<MediaElementAudioSourceNode | null>(null);
  const dataArrayRef = useRef<Uint8Array | null>(null);
  
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [waveformData, setWaveformData] = useState<number[]>([]);
  const [glowIntensity, setGlowIntensity] = useState(0);

  const { currentTrack, isPlaying, currentTime, duration, pauseTrack, resumeTrack, setVolume: setAudioVolume, seekTo } = useAudio();

  // Initialize audio context and analyser
  useEffect(() => {
    const setupAudioAnalysis = async () => {
      if (!currentTrack || !isPlaying) return;

      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext();
        }

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        // Find the audio element (created by AudioContext)
        const audioElement = document.querySelector('audio') as HTMLAudioElement;
        if (!audioElement || sourceRef.current) return;

        // Create analyser node
        analyserRef.current = audioContextRef.current.createAnalyser();
        analyserRef.current.fftSize = 128;
        analyserRef.current.smoothingTimeConstant = 0.85;

        // Connect audio source to analyser
        sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
        sourceRef.current.connect(analyserRef.current);
        analyserRef.current.connect(audioContextRef.current.destination);

        // Setup data array
        dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);

        // Start animation
        startVisualization();
      } catch (error) {
        console.error('Error setting up audio analysis:', error);
      }
    };

    setupAudioAnalysis();

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [currentTrack, isPlaying]);

  // Generate compact waveform data
  const generateWaveformData = useCallback(() => {
    const dataPoints = 60;
    const data = [];
    for (let i = 0; i < dataPoints; i++) {
      const baseAmplitude = Math.sin(i / 8) * 0.4 + 0.5;
      const noise = (Math.random() - 0.5) * 0.3;
      const amplitude = Math.max(0.2, Math.min(1, baseAmplitude + noise));
      data.push(amplitude);
    }
    setWaveformData(data);
  }, []);

  // Visualization animation
  const startVisualization = () => {
    const animate = () => {
      if (!analyserRef.current || !dataArrayRef.current) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      
      // Calculate average frequency for glow effect
      const average = dataArrayRef.current.reduce((sum, value) => sum + value, 0) / dataArrayRef.current.length;
      setGlowIntensity(average / 255);

      drawWaveform();
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  // Draw compact futuristic waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    if (waveformData.length === 0) return;

    const barWidth = width / waveformData.length;
    const progress = duration ? currentTime / duration : 0;
    const centerY = height / 2;

    // Draw compact waveform bars
    waveformData.forEach((amplitude, index) => {
      const x = index * barWidth;
      
      // Get real-time frequency data for this bar if available
      let realAmplitude = amplitude;
      if (dataArrayRef.current && index < dataArrayRef.current.length) {
        realAmplitude = Math.max(amplitude * 0.3, (dataArrayRef.current[index] / 255) * 0.8);
      }

      const barHeight = realAmplitude * (height * 0.7);
      
      // Create gradient based on progress and audio intensity
      if (index / waveformData.length <= progress) {
        // Playing portion - bright neon
        ctx.fillStyle = `hsl(${190 + glowIntensity * 40}, 100%, ${60 + glowIntensity * 20}%)`;
      } else {
        // Unplayed portion - subtle
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
      }

      // Draw bar
      ctx.fillRect(x, centerY - barHeight/2, Math.max(1, barWidth - 1), barHeight);
    });

    // Draw playhead
    if (progress > 0) {
      const playheadX = progress * width;
      ctx.strokeStyle = `hsl(190, 100%, 70%)`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, [waveformData, currentTime, duration, glowIntensity, isPlaying]);

  // Handle waveform click for seeking
  const handleWaveformClick = (event: React.MouseEvent) => {
    const canvas = canvasRef.current;
    if (!canvas || !duration) return;

    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const progress = clickX / canvas.width;
    const seekTime = progress * duration;

    seekTo(seekTime);
  };

  // Control handlers
  const togglePlayPause = () => {
    if (isPlaying) {
      pauseTrack();
    } else {
      resumeTrack();
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const newVolume = value[0];
    setVolume(newVolume);
    setAudioVolume(newVolume);
    setIsMuted(newVolume === 0);
  };

  const toggleMute = () => {
    if (isMuted) {
      setAudioVolume(volume);
      setIsMuted(false);
    } else {
      setAudioVolume(0);
      setIsMuted(true);
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

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

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 60;
      drawWaveform();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawWaveform]);

  if (!currentTrack) {
    return null;
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-md border-t border-white/20 shadow-lg">
      <div className="max-w-6xl mx-auto p-4">
        <div className="flex items-center gap-4">
          {/* Track Info */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            {currentTrack.artwork_url && (
              <div className="w-12 h-12 rounded-lg overflow-hidden shadow-md flex-shrink-0">
                <img 
                  src={currentTrack.artwork_url} 
                  alt={currentTrack.title}
                  className="w-full h-full object-cover"
                />
              </div>
            )}
            <div className="min-w-0 flex-1">
              <h3 className="text-white font-semibold truncate text-sm">{currentTrack.title}</h3>
              <p className="text-cyan-400 text-xs truncate">{currentTrack.artist}</p>
            </div>
          </div>

          {/* Play Controls */}
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:text-cyan-400 w-8 h-8 p-0"
            >
              <SkipBack className="w-4 h-4" />
            </Button>

            <Button
              onClick={togglePlayPause}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md"
            >
              {isPlaying ? (
                <Pause className="w-4 h-4" />
              ) : (
                <Play className="w-4 h-4 ml-0.5" />
              )}
            </Button>

            <Button
              size="sm"
              variant="ghost"
              className="text-white hover:text-cyan-400 w-8 h-8 p-0"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          {/* Waveform */}
          <div className="flex-1 max-w-md mx-4">
            <canvas
              ref={canvasRef}
              onClick={handleWaveformClick}
              className="w-full cursor-pointer rounded"
              style={{ height: '60px' }}
            />
          </div>

          {/* Time and Volume */}
          <div className="flex items-center gap-4 text-xs text-white/80 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono">{formatTime(currentTime)}</span>
              <span>/</span>
              <span className="font-mono">{formatTime(duration)}</span>
            </div>
            
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="ghost"
                onClick={toggleMute}
                className="text-white hover:text-cyan-400 w-6 h-6 p-0"
              >
                {isMuted ? <VolumeX className="w-3 h-3" /> : <Volume2 className="w-3 h-3" />}
              </Button>
              <div className="w-16">
                <Slider
                  value={[isMuted ? 0 : volume]}
                  onValueChange={handleVolumeChange}
                  max={1}
                  step={0.1}
                  className="w-full [&_[role=slider]]:w-3 [&_[role=slider]]:h-3 [&_[role=slider]]:bg-cyan-400"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}