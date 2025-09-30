import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Volume2, VolumeX } from 'lucide-react';
import { sessionLoopEngine } from '@/lib/sessionLoopEngine';
import { toast } from '@/components/ui/use-toast';

interface AudioStreamViewerProps {
  sessionId: string;
  autoStart?: boolean;
}

export const AudioStreamViewer: React.FC<AudioStreamViewerProps> = ({ sessionId, autoStart = false }) => {
  const [isListening, setIsListening] = useState(false);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement>(null);
  const gainNodeRef = useRef<GainNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const startListening = async () => {
    try {
      // Get the session's mixed audio stream
      const mixedStream = sessionLoopEngine.getMixedAudioStream();
      
      if (!mixedStream) {
        toast({
          title: "No Audio Available",
          description: "The session isn't producing audio yet. Ask the host to start playing!",
          variant: "destructive"
        });
        return;
      }

      // Create audio context if needed
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }

      // Resume audio context if suspended
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
      }

      // Create gain node for volume control
      gainNodeRef.current = audioContextRef.current.createGain();
      gainNodeRef.current.gain.value = volume;
      gainNodeRef.current.connect(audioContextRef.current.destination);

      // Connect the mixed stream
      const source = audioContextRef.current.createMediaStreamSource(mixedStream);
      source.connect(gainNodeRef.current);

      // Also set up HTML audio element as fallback
      if (audioRef.current) {
        audioRef.current.srcObject = mixedStream;
        audioRef.current.volume = volume;
        audioRef.current.play();
      }

      setIsListening(true);
      console.log('🔊 Started listening to session audio stream');
      
      toast({
        title: "Listening to Session",
        description: "You can now hear the live session audio!"
      });
    } catch (error) {
      console.error('Error starting audio stream:', error);
      toast({
        title: "Audio Error",
        description: "Failed to connect to session audio stream",
        variant: "destructive"
      });
    }
  };

  const stopListening = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.srcObject = null;
    }

    if (gainNodeRef.current) {
      gainNodeRef.current.disconnect();
      gainNodeRef.current = null;
    }

    setIsListening(false);
    console.log('🔇 Stopped listening to session audio stream');
    
    toast({
      title: "Stopped Listening",
      description: "Disconnected from session audio"
    });
  };

  // Update volume when slider changes
  useEffect(() => {
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = volume;
    }
    if (audioRef.current) {
      audioRef.current.volume = volume;
    }
  }, [volume]);

  // Auto-start for guests
  useEffect(() => {
    if (autoStart && !isListening) {
      startListening();
    }
  }, [autoStart]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopListening();
    };
  }, []);

  // Guest viewer mode - auto-listening with volume control only
  if (autoStart) {
    return (
      <div className="flex items-center gap-3 p-3 bg-card/50 border border-border/50 rounded-lg">
        <audio ref={audioRef} style={{ display: 'none' }} />
        
        <div className="flex items-center gap-1 flex-shrink-0">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-sm font-medium text-foreground">Live Audio</span>
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

  return (
    <div className="flex items-center gap-3 p-3 bg-card/50 border border-border/50 rounded-lg">
      <audio ref={audioRef} style={{ display: 'none' }} />
      
      <Button
        onClick={isListening ? stopListening : startListening}
        variant={isListening ? "secondary" : "default"}
        size="sm"
        className="flex-shrink-0"
      >
        {isListening ? <VolumeX className="w-4 h-4 mr-2" /> : <Volume2 className="w-4 h-4 mr-2" />}
        {isListening ? 'Stop Listening' : 'Listen to Session'}
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
          disabled={!isListening}
        />
        <span className="text-xs text-muted-foreground w-8">
          {Math.round(volume * 100)}%
        </span>
      </div>

      {isListening && (
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-xs text-muted-foreground">Live</span>
        </div>
      )}
    </div>
  );
};