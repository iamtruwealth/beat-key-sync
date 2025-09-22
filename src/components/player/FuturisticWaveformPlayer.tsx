import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward } from 'lucide-react';
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
  const [frequencyData, setFrequencyData] = useState<number[]>([]);

  const { currentTrack, isPlaying, currentTime, duration, pauseTrack, resumeTrack, setVolume: setAudioVolume, seekTo, getAudioElement } = useAudio();

  // Initialize Web Audio API for real-time frequency analysis
  useEffect(() => {
    const setupAudioAnalysis = async () => {
      if (!currentTrack || !isPlaying) return;

      try {
        // Create or resume audio context
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext({ sampleRate: 44100 });
        }

        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }

        // Get the audio element directly from AudioContext
        const audioElement = getAudioElement?.();
        if (!audioElement) {
          console.warn('No audio element available from AudioContext');
          return;
        }

        // Prevent multiple connections to the same audio element
        if (sourceRef.current) {
          sourceRef.current.disconnect();
          sourceRef.current = null;
        }

        // Create analyser node once
        if (!analyserRef.current) {
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 128; // 64 frequency bins
          analyserRef.current.smoothingTimeConstant = 0.8;
          analyserRef.current.minDecibels = -90;
          analyserRef.current.maxDecibels = -10;
        }

        // Create or reuse audio source for analysis
        if (!sourceRef.current) {
          try {
            console.info('Waveform: creating MediaElementSource');
            sourceRef.current = audioContextRef.current.createMediaElementSource(audioElement);
            sourceRef.current.connect(analyserRef.current);
          } catch (err) {
            console.warn('Waveform: MediaElementSource failed, trying captureStream fallback', err);
            try {
              const stream = (audioElement as any).captureStream?.();
              if (stream) {
                const streamSource = audioContextRef.current.createMediaStreamSource(stream);
                streamSource.connect(analyserRef.current);
                // Keep a dummy marker to avoid repeated attempts
                sourceRef.current = null as any;
              } else {
                console.error('Waveform: captureStream not supported on this browser');
              }
            } catch (err2) {
              console.error('Waveform: captureStream fallback failed', err2);
            }
          }
        }

        // Setup data array
        dataArrayRef.current = new Uint8Array(analyserRef.current.frequencyBinCount);

        // Start real-time visualization
        startRealtimeVisualization();

      } catch (error) {
        console.error('Error setting up audio analysis:', error);
      }
    };

    if (currentTrack && isPlaying) {
      // Small delay to ensure audio element is ready
      setTimeout(setupAudioAnalysis, 100);
    }

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [currentTrack, isPlaying]);

  // Real-time visualization loop
  const startRealtimeVisualization = () => {
    const animate = () => {
      if (!analyserRef.current || !dataArrayRef.current || !canvasRef.current) {
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      // Get real-time frequency data
      analyserRef.current.getByteFrequencyData(dataArrayRef.current);
      
      // Update frequency data state for rendering
      setFrequencyData(Array.from(dataArrayRef.current));
      
      // Draw the reactive waveform
      drawReactiveWaveform();
      
      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
  };

  // Draw reactive waveform that responds to audio
  const drawReactiveWaveform = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !dataArrayRef.current) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { width, height } = canvas;
    ctx.clearRect(0, 0, width, height);

    const bufferLength = dataArrayRef.current.length;
    const barWidth = width / bufferLength;
    const progress = duration ? currentTime / duration : 0;

    // Draw each frequency bar
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArrayRef.current[i] / 255) * height * 0.8;
      const x = i * barWidth;
      const y = height - barHeight;

      // Calculate if this bar is in the "played" section
      const barProgress = i / bufferLength;
      const isPlayed = barProgress <= progress;

      // Create dynamic gradient based on frequency intensity
      const intensity = dataArrayRef.current[i] / 255;
      
      if (isPlayed) {
        // Played section - bright reactive colors
        const hue = 180 + intensity * 60; // Cyan to purple range
        const saturation = 90 + intensity * 10;
        const lightness = 50 + intensity * 30;
        
        ctx.fillStyle = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        
        // Add glow effect for high frequencies
        if (intensity > 0.5) {
          ctx.shadowColor = `hsl(${hue}, 100%, 70%)`;
          ctx.shadowBlur = 8;
        }
      } else {
        // Unplayed section - subtle static bars
        ctx.fillStyle = `rgba(255, 255, 255, ${0.2 + intensity * 0.1})`;
        ctx.shadowBlur = 0;
      }

      // Draw bar
      ctx.fillRect(x, y, barWidth - 1, barHeight);
      ctx.shadowBlur = 0;
    }

    // Draw progress line
    if (progress > 0) {
      const playheadX = progress * width;
      ctx.strokeStyle = '#00bcd4';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(playheadX, 0);
      ctx.lineTo(playheadX, height);
      ctx.stroke();
    }
  }, [currentTime, duration, isPlaying]);

  // Handle canvas click for seeking
  const handleCanvasClick = (event: React.MouseEvent) => {
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

  // Canvas setup and resize handling
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const resizeCanvas = () => {
      const container = canvas.parentElement;
      if (!container) return;
      
      const rect = container.getBoundingClientRect();
      canvas.width = rect.width;
      canvas.height = 60;
    };

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, []);

  if (!currentTrack) {
    return (
      <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-md border-t border-white/20 shadow-lg z-50">
        <div className="max-w-6xl mx-auto p-4">
          <div className="flex items-center gap-4">
            <div className="flex-1 text-white/70 text-sm">Select a track to start playing</div>
            <div className="flex-1 max-w-md mx-4 relative">
              <canvas
                ref={canvasRef}
                className="w-full rounded"
                style={{ height: '60px' }}
              />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-md border-t border-white/20 shadow-lg z-50">
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
              className="text-white hover:text-cyan-400 w-8 h-8 p-0 transition-colors"
            >
              <SkipBack className="w-4 h-4" />
            </Button>

            <Button
              onClick={togglePlayPause}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md transition-all duration-300"
              style={{
                boxShadow: isPlaying ? '0 0 20px rgba(0, 188, 212, 0.5)' : '0 2px 8px rgba(0,0,0,0.3)'
              }}
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
              className="text-white hover:text-cyan-400 w-8 h-8 p-0 transition-colors"
            >
              <SkipForward className="w-4 h-4" />
            </Button>
          </div>

          {/* Reactive Waveform Canvas */}
          <div className="flex-1 max-w-md mx-4 relative">
            <canvas
              ref={canvasRef}
              onClick={handleCanvasClick}
              className="w-full cursor-pointer rounded"
              style={{ height: '60px' }}
            />
            {!isPlaying && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
                <div className="text-xs text-white/60">Play music to see visualization</div>
              </div>
            )}
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
                className="text-white hover:text-cyan-400 w-6 h-6 p-0 transition-colors"
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