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
  const [isLooping, setIsLooping] = useState(false);
  const [isShuffling, setIsShuffling] = useState(false);
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
        analyserRef.current.fftSize = 256;
        analyserRef.current.smoothingTimeConstant = 0.8;

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

  // Generate mock waveform data for display
  const generateWaveformData = useCallback(() => {
    const dataPoints = 120;
    const data = [];
    for (let i = 0; i < dataPoints; i++) {
      const baseAmplitude = Math.sin(i / 10) * 0.6 + 0.4;
      const noise = (Math.random() - 0.5) * 0.3;
      const amplitude = Math.max(0.1, Math.min(1, baseAmplitude + noise));
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

  // Draw futuristic waveform
  const drawWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    // Background gradient
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, 'rgba(0, 20, 40, 0.9)');
    bgGradient.addColorStop(0.5, 'rgba(0, 10, 30, 0.8)');
    bgGradient.addColorStop(1, 'rgba(0, 5, 15, 0.9)');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    if (waveformData.length === 0) return;

    const barWidth = width / waveformData.length;
    const progress = duration ? currentTime / duration : 0;
    const centerY = height / 2;

    // Draw waveform bars
    waveformData.forEach((amplitude, index) => {
      const x = index * barWidth;
      const barHeight = amplitude * (height * 0.4);
      
      // Get real-time frequency data for this bar if available
      let realAmplitude = amplitude;
      if (dataArrayRef.current && index < dataArrayRef.current.length) {
        realAmplitude = Math.max(amplitude, (dataArrayRef.current[index] / 255) * 0.8);
      }

      const dynamicBarHeight = realAmplitude * (height * 0.4);
      
      // Create dynamic gradient based on progress and audio intensity
      const gradient = ctx.createLinearGradient(x, centerY - dynamicBarHeight/2, x, centerY + dynamicBarHeight/2);
      
      if (index / waveformData.length <= progress) {
        // Playing portion - dynamic neon colors
        const intensity = glowIntensity * 2;
        gradient.addColorStop(0, `hsl(${190 + intensity * 30}, 100%, ${50 + intensity * 20}%)`);
        gradient.addColorStop(0.3, `hsl(${280 + intensity * 40}, 100%, ${60 + intensity * 20}%)`);
        gradient.addColorStop(0.7, `hsl(${320 + intensity * 20}, 100%, ${50 + intensity * 25}%)`);
        gradient.addColorStop(1, `hsl(${220 - intensity * 20}, 100%, ${65 + intensity * 15}%)`);
      } else {
        // Unplayed portion - subtle glow
        gradient.addColorStop(0, 'rgba(100, 200, 255, 0.3)');
        gradient.addColorStop(0.5, 'rgba(150, 100, 255, 0.2)');
        gradient.addColorStop(1, 'rgba(200, 100, 200, 0.3)');
      }

      ctx.fillStyle = gradient;
      
      // Main bar
      ctx.fillRect(x, centerY - dynamicBarHeight/2, Math.max(2, barWidth - 1), dynamicBarHeight);
      
      // Add glow effect for playing bars
      if (index / waveformData.length <= progress && glowIntensity > 0.1) {
        ctx.shadowColor = `hsl(${190 + glowIntensity * 50}, 100%, 70%)`;
        ctx.shadowBlur = 10 + glowIntensity * 20;
        ctx.fillRect(x, centerY - dynamicBarHeight/2, Math.max(2, barWidth - 1), dynamicBarHeight);
        ctx.shadowBlur = 0;
      }
    });

    // Draw AI-style playhead with dynamic effects
    if (progress > 0) {
      const playheadX = progress * width;
      
      // Animated playhead line
      ctx.strokeStyle = `hsl(190, 100%, ${70 + glowIntensity * 30}%)`;
      ctx.lineWidth = 2 + glowIntensity * 2;
      ctx.shadowColor = `hsl(190, 100%, 70%)`;
      ctx.shadowBlur = 15 + glowIntensity * 20;
      
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
      
      // Playhead circle with pulsing effect
      const radius = 6 + glowIntensity * 4;
      ctx.beginPath();
      ctx.arc(playheadX, centerY, radius, 0, Math.PI * 2);
      ctx.fillStyle = `hsl(190, 100%, ${80 + glowIntensity * 20}%)`;
      ctx.fill();
      
      ctx.shadowBlur = 0;
    }

    // Add scanning line effect
    const scanLineX = (Date.now() % 3000) / 3000 * width;
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(scanLineX, 0);
    ctx.lineTo(scanLineX, height);
    ctx.stroke();
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
      canvas.height = 150;
      drawWaveform();
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [drawWaveform]);

  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-lg border-t border-white/10 p-6">
        <div className="max-w-6xl mx-auto text-center">
          <p className="text-white/60 text-lg">Select a track to start playing</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-lg border-t border-white/10 shadow-2xl">
      <div className="max-w-6xl mx-auto p-6">
        {/* Track Info */}
        <div className="flex items-center gap-6 mb-6">
          {currentTrack.artwork_url && (
            <div className="w-16 h-16 rounded-lg overflow-hidden shadow-lg">
              <img 
                src={currentTrack.artwork_url} 
                alt={currentTrack.title}
                className="w-full h-full object-cover"
              />
            </div>
          )}
          <div className="flex-1">
            <h3 className="text-xl font-bold text-white mb-1">{currentTrack.title}</h3>
            <p className="text-cyan-400 text-lg">{currentTrack.artist}</p>
          </div>
        </div>

        {/* Futuristic Waveform */}
        <div className="relative mb-6 rounded-xl overflow-hidden shadow-inner">
          <canvas
            ref={canvasRef}
            onClick={handleWaveformClick}
            className="w-full cursor-pointer"
            style={{ height: '150px' }}
          />
        </div>

        {/* Progress and Time */}
        <div className="flex items-center gap-4 mb-6 text-sm">
          <span className="text-cyan-400 font-mono min-w-[50px]">{formatTime(currentTime)}</span>
          <div className="flex-1 h-1 bg-white/20 rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 transition-all duration-100"
              style={{ 
                width: `${duration ? (currentTime / duration) * 100 : 0}%`,
                boxShadow: `0 0 10px hsl(${190 + glowIntensity * 50}, 100%, 70%)`
              }}
            />
          </div>
          <span className="text-white/60 font-mono min-w-[50px]">{formatTime(duration)}</span>
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-6">
          {/* Secondary Controls */}
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsShuffling(!isShuffling)}
            className={`text-white hover:text-cyan-400 transition-colors ${isShuffling ? 'text-cyan-400' : ''}`}
          >
            <Shuffle className="w-5 h-5" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:text-cyan-400 transition-colors"
          >
            <SkipBack className="w-5 h-5" />
          </Button>

          {/* Main Play/Pause Button */}
          <Button
            size="lg"
            onClick={togglePlayPause}
            className="w-20 h-20 rounded-full bg-gradient-to-br from-cyan-400 via-blue-500 to-purple-600 hover:from-cyan-300 hover:via-blue-400 hover:to-purple-500 text-white shadow-lg hover:shadow-cyan-400/50 transition-all duration-300"
            style={{
              boxShadow: isPlaying ? `0 0 30px hsl(190, 100%, ${50 + glowIntensity * 30}%)` : '0 4px 20px rgba(0,0,0,0.3)'
            }}
          >
            {isPlaying ? (
              <Pause className="w-8 h-8" />
            ) : (
              <Play className="w-8 h-8 ml-1" />
            )}
          </Button>

          <Button
            size="sm"
            variant="ghost"
            className="text-white hover:text-cyan-400 transition-colors"
          >
            <SkipForward className="w-5 h-5" />
          </Button>

          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsLooping(!isLooping)}
            className={`text-white hover:text-cyan-400 transition-colors ${isLooping ? 'text-cyan-400' : ''}`}
          >
            <Repeat className="w-5 h-5" />
          </Button>

          {/* Volume Control */}
          <div className="flex items-center gap-3 ml-8">
            <Button
              size="sm"
              variant="ghost"
              onClick={toggleMute}
              className="text-white hover:text-cyan-400 transition-colors"
            >
              {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
            </Button>
            <div className="w-24">
              <Slider
                value={[isMuted ? 0 : volume]}
                onValueChange={handleVolumeChange}
                max={1}
                step={0.1}
                className="w-full [&_[role=slider]]:bg-cyan-400 [&_[role=slider]]:border-cyan-400"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}