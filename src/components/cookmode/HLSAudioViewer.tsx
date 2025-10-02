import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX, Loader2 } from 'lucide-react';
import { toast } from '@/components/ui/use-toast';
import Hls from 'hls.js';

interface HLSAudioViewerProps {
  sessionId: string;
  autoStart?: boolean;
}

export const HLSAudioViewer: React.FC<HLSAudioViewerProps> = ({ 
  sessionId, 
  autoStart = false 
}) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [volume, setVolume] = useState(1);
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  const hlsRef = useRef<Hls | null>(null);

  // Get HLS stream URL
  const getStreamUrl = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    // Option 1: From Supabase Storage (if FFmpeg uploads there)
    return `${supabaseUrl}/storage/v1/object/public/hls-streams/${sessionId}/out.m3u8`;
    // Option 2: From custom streaming server
    // return `https://your-streaming-server.com/stream/${sessionId}/out.m3u8`;
  };

  const startPlayback = async () => {
    if (!audioRef.current) return;

    try {
      setIsLoading(true);
      setError(null);
      console.log('[HLS Viewer] Starting playback...');

      const streamUrl = getStreamUrl();
      console.log('[HLS Viewer] Loading stream from:', streamUrl);

      // Check if HLS is supported
      if (Hls.isSupported()) {
        console.log('[HLS Viewer] Using HLS.js');
        
        // Clean up existing HLS instance
        if (hlsRef.current) {
          hlsRef.current.destroy();
        }

        // Create new HLS instance
        const hls = new Hls({
          enableWorker: true,
          lowLatencyMode: true,
          backBufferLength: 90,
          maxBufferLength: 30,
          maxMaxBufferLength: 60,
          maxBufferSize: 60 * 1000 * 1000, // 60 MB
          maxBufferHole: 0.5,
          highBufferWatchdogPeriod: 2,
          nudgeOffset: 0.1,
          nudgeMaxRetry: 3,
          maxFragLookUpTolerance: 0.25,
          liveSyncDurationCount: 3,
          liveMaxLatencyDurationCount: 10,
          liveDurationInfinity: false,
          liveBackBufferLength: 0,
        });

        hlsRef.current = hls;

        // Load stream
        hls.loadSource(streamUrl);
        hls.attachMedia(audioRef.current);

        // Handle HLS events
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          console.log('[HLS Viewer] Manifest parsed, starting playback');
          audioRef.current?.play();
          setIsPlaying(true);
          setIsLoading(false);
          
          toast({
            title: "Connected to Stream",
            description: "Now playing live session audio"
          });
        });

        hls.on(Hls.Events.ERROR, (event, data) => {
          console.error('[HLS Viewer] HLS error:', data);
          
          if (data.fatal) {
            switch (data.type) {
              case Hls.ErrorTypes.NETWORK_ERROR:
                console.log('[HLS Viewer] Network error, attempting recovery...');
                hls.startLoad();
                break;
              case Hls.ErrorTypes.MEDIA_ERROR:
                console.log('[HLS Viewer] Media error, attempting recovery...');
                hls.recoverMediaError();
                break;
              default:
                setError('Fatal streaming error occurred');
                setIsLoading(false);
                setIsPlaying(false);
                toast({
                  title: "Streaming Error",
                  description: "Failed to play audio stream. The host may not be broadcasting.",
                  variant: "destructive"
                });
                break;
            }
          }
        });

      } else if (audioRef.current.canPlayType('application/vnd.apple.mpegurl')) {
        // Native HLS support (Safari)
        console.log('[HLS Viewer] Using native HLS');
        audioRef.current.src = streamUrl;
        
        audioRef.current.onloadedmetadata = () => {
          audioRef.current?.play();
          setIsPlaying(true);
          setIsLoading(false);
          
          toast({
            title: "Connected to Stream",
            description: "Now playing live session audio"
          });
        };

        audioRef.current.onerror = () => {
          setError('Failed to load stream');
          setIsLoading(false);
          toast({
            title: "Streaming Error",
            description: "Failed to play audio stream. The host may not be broadcasting.",
            variant: "destructive"
          });
        };
      } else {
        throw new Error('HLS not supported in this browser');
      }

    } catch (error) {
      console.error('[HLS Viewer] Error starting playback:', error);
      setError(error instanceof Error ? error.message : 'Unknown error');
      setIsLoading(false);
      
      toast({
        title: "Playback Error",
        description: "Could not connect to audio stream",
        variant: "destructive"
      });
    }
  };

  const stopPlayback = () => {
    console.log('[HLS Viewer] Stopping playback...');
    
    if (audioRef.current) {
      audioRef.current.pause();
    }

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    setIsPlaying(false);
    setIsLoading(false);
    
    toast({
      title: "Stopped Listening",
      description: "Disconnected from session audio"
    });
  };

  // Update volume
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Auto-start for guests
  useEffect(() => {
    if (autoStart && !isPlaying && !isLoading) {
      startPlayback();
    }
  }, [autoStart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopPlayback();
    };
  }, []);

  // Guest auto-listening mode
  if (autoStart) {
    return (
      <div className="flex items-center gap-3 p-3 bg-card/50 border border-border/50 rounded-lg">
        <audio ref={audioRef} />
        
        <div className="flex items-center gap-1 flex-shrink-0">
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm font-medium text-foreground">Connecting...</span>
            </>
          ) : isPlaying ? (
            <>
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-sm font-medium text-foreground">Live Audio</span>
            </>
          ) : error ? (
            <>
              <div className="w-2 h-2 bg-red-500 rounded-full" />
              <span className="text-sm font-medium text-destructive">Not Broadcasting</span>
            </>
          ) : null}
        </div>

        <div className="flex items-center gap-2 flex-1">
          <Volume2 className="w-4 h-4 text-muted-foreground" />
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={volume}
            onChange={(e) => setVolume(parseFloat(e.target.value))}
            className="flex-1 h-2 bg-border rounded-lg appearance-none cursor-pointer"
          />
          <span className="text-xs text-muted-foreground w-8">
            {Math.round(volume * 100)}%
          </span>
        </div>
      </div>
    );
  }

  // Host/manual control mode
  return (
    <div className="flex items-center gap-3 p-3 bg-card/50 border border-border/50 rounded-lg">
      <audio ref={audioRef} />
      
      <Button
        onClick={isPlaying ? stopPlayback : startPlayback}
        variant={isPlaying ? "secondary" : "default"}
        size="sm"
        className="flex-shrink-0"
        disabled={isLoading}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            Connecting...
          </>
        ) : isPlaying ? (
          <>
            <VolumeX className="w-4 h-4 mr-2" />
            Stop Listening
          </>
        ) : (
          <>
            <Volume2 className="w-4 h-4 mr-2" />
            Listen to Session
          </>
        )}
      </Button>

      <div className="flex items-center gap-2 flex-1">
        <Volume2 className="w-4 h-4 text-muted-foreground" />
        <input
          type="range"
          min="0"
          max="1"
          step="0.1"
          value={volume}
          onChange={(e) => setVolume(parseFloat(e.target.value))}
          className="flex-1 h-2 bg-border rounded-lg appearance-none cursor-pointer"
          disabled={!isPlaying}
        />
        <span className="text-xs text-muted-foreground w-8">
          {Math.round(volume * 100)}%
        </span>
      </div>

      {isPlaying && (
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      )}

      {error && (
        <span className="text-xs text-destructive">
          {error}
        </span>
      )}
    </div>
  );
};
