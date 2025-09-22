import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Play, Pause, Volume2, VolumeX, SkipBack, SkipForward, Repeat, Shuffle } from 'lucide-react';
import { useAudio } from '@/contexts/AudioContext';
import WaveSurfer from 'wavesurfer.js';

export function FuturisticWaveformPlayer() {
  const waveformRef = useRef<HTMLDivElement>(null);
  const wavesurferRef = useRef<WaveSurfer | null>(null);
  const animationRef = useRef<number>();
  
  const [volume, setVolume] = useState(1);
  const [isMuted, setIsMuted] = useState(false);
  const [isWaveformReady, setIsWaveformReady] = useState(false);

  const { currentTrack, isPlaying, currentTime, duration, pauseTrack, resumeTrack, setVolume: setAudioVolume, seekTo } = useAudio();

  // Initialize WaveSurfer
  useEffect(() => {
    if (!waveformRef.current) return;

    // Create WaveSurfer instance
    const wavesurfer = WaveSurfer.create({
      container: waveformRef.current,
      waveColor: 'rgba(255, 255, 255, 0.3)',
      progressColor: '#00bcd4',
      cursorColor: '#00bcd4',
      barWidth: 2,
      barGap: 1,
      barRadius: 1,
      height: 60,
      normalize: true,
      interact: true,
      hideScrollbar: true,
    });

    // Store reference
    wavesurferRef.current = wavesurfer;

    // Event listeners
    wavesurfer.on('ready', () => {
      setIsWaveformReady(true);
      startFrequencyVisualization();
    });

    wavesurfer.on('click', (progress: number) => {
      if (duration && typeof progress === 'number') {
        seekTo(progress * duration);
      }
    });

    wavesurfer.on('error', (error) => {
      console.error('WaveSurfer error:', error);
    });

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      wavesurfer.destroy();
    };
  }, []);

  // Load audio when track changes
  useEffect(() => {
    if (!wavesurferRef.current || !currentTrack) return;

    const audioUrl = currentTrack.file_url;
    if (!audioUrl) return;

    setIsWaveformReady(false);
    
    // Load the audio file
    wavesurferRef.current.load(audioUrl);
  }, [currentTrack]);

  // Sync playback state
  useEffect(() => {
    if (!wavesurferRef.current || !isWaveformReady) return;

    if (isPlaying) {
      if (wavesurferRef.current.isPlaying()) return;
      wavesurferRef.current.play();
    } else {
      if (!wavesurferRef.current.isPlaying()) return;
      wavesurferRef.current.pause();
    }
  }, [isPlaying, isWaveformReady]);

  // Sync current time
  useEffect(() => {
    if (!wavesurferRef.current || !isWaveformReady || !duration) return;
    
    const progress = currentTime / duration;
    const waveSurferTime = wavesurferRef.current.getCurrentTime();
    if (Math.abs(waveSurferTime - currentTime) > 1) {
      wavesurferRef.current.seekTo(progress);
    }
  }, [currentTime, duration, isWaveformReady]);

  // Real-time frequency visualization
  const startFrequencyVisualization = () => {
    if (!wavesurferRef.current) return;

    // Get audio context for frequency analysis
    const audioContext = new AudioContext();
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    // Try to connect to the audio source
    try {
      const audioElement = document.querySelector('audio') as HTMLAudioElement;
      if (audioElement) {
        const source = audioContext.createMediaElementSource(audioElement);
        source.connect(analyser);
        analyser.connect(audioContext.destination);
      }
    } catch (error) {
      console.warn('Could not connect audio analyzer:', error);
    }

    const animate = () => {
      if (!wavesurferRef.current) return;

      try {
        analyser.getByteFrequencyData(dataArray);
        
        // Calculate average frequency for dynamic coloring
        const average = dataArray.reduce((sum, value) => sum + value, 0) / dataArray.length;
        const intensity = average / 255;

        // Update waveform colors based on audio intensity
        const hue = 190 + intensity * 40;
        const saturation = 100;
        const lightness = 60 + intensity * 20;
        
        const progressColor = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        const cursorColor = `hsl(${hue}, ${saturation}%, ${lightness + 10}%)`;

        // Apply dynamic colors by updating the waveform options
        wavesurferRef.current?.setOptions({
          progressColor,
          cursorColor,
        });
      } catch (error) {
        // Ignore errors and continue animation
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animate();
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
    
    if (wavesurferRef.current) {
      wavesurferRef.current.setVolume(newVolume);
    }
  };

  const toggleMute = () => {
    if (isMuted) {
      setAudioVolume(volume);
      setIsMuted(false);
      if (wavesurferRef.current) {
        wavesurferRef.current.setVolume(volume);
      }
    } else {
      setAudioVolume(0);
      setIsMuted(true);
      if (wavesurferRef.current) {
        wavesurferRef.current.setVolume(0);
      }
    }
  };

  const formatTime = (seconds: number) => {
    if (!seconds || isNaN(seconds)) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!currentTrack) {
    return null;
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
              disabled={!isWaveformReady}
              className="w-10 h-10 rounded-full bg-gradient-to-r from-cyan-500 to-blue-600 hover:from-cyan-400 hover:to-blue-500 text-white shadow-md transition-all duration-300 disabled:opacity-50"
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

          {/* WaveSurfer Waveform */}
          <div className="flex-1 max-w-md mx-4 relative">
            <div 
              ref={waveformRef}
              className="w-full rounded"
              style={{ height: '60px' }}
            />
            {!isWaveformReady && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded">
                <div className="text-xs text-white/60">Loading waveform...</div>
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