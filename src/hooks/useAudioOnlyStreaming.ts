import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sessionLoopEngine } from '@/lib/sessionLoopEngine';

interface UseAudioOnlyStreamingProps {
  sessionId: string;
  isHost: boolean;
  currentUserId?: string;
}

export const useAudioOnlyStreaming = ({ sessionId, isHost, currentUserId }: UseAudioOnlyStreamingProps) => {
  const [isStreamingAudio, setIsStreamingAudio] = useState(false);
  const [remoteAudioStream, setRemoteAudioStream] = useState<MediaStream | null>(null);
  
  // Start streaming session audio (host only)
  const startAudioStreaming = useCallback(async () => {
    if (!isHost) return;
    
    try {
      console.log('🎵 Starting audio-only stream for session');
      
      // Get the mixed session audio from the loop engine
      const sessionAudio = sessionLoopEngine.getMixedAudioStream();
      
      if (!sessionAudio) {
        toast.error('No session audio available. Play some tracks first.');
        return;
      }

      // Broadcast that audio streaming has started
      const channel = supabase.channel(`audio-stream-${sessionId}`);
      await channel.subscribe();
      
      await channel.send({
        type: 'broadcast',
        event: 'audio-stream-started',
        payload: {
          user_id: currentUserId,
          streaming: true
        }
      });

      setIsStreamingAudio(true);
      toast.success('Audio streaming started - viewers can now hear the session');
      
    } catch (error) {
      console.error('Error starting audio stream:', error);
      toast.error('Failed to start audio streaming');
    }
  }, [isHost, sessionId, currentUserId]);

  // Stop streaming session audio
  const stopAudioStreaming = useCallback(async () => {
    try {
      const channel = supabase.channel(`audio-stream-${sessionId}`);
      await channel.subscribe();
      
      await channel.send({
        type: 'broadcast',
        event: 'audio-stream-stopped',
        payload: {
          user_id: currentUserId,
          streaming: false
        }
      });

      setIsStreamingAudio(false);
      toast.success('Audio streaming stopped');
      
    } catch (error) {
      console.error('Error stopping audio stream:', error);
    }
  }, [sessionId, currentUserId]);

  // Listen for audio stream (viewers)
  useEffect(() => {
    if (isHost) return; // Hosts don't listen, they broadcast

    const channel = supabase.channel(`audio-stream-${sessionId}`);
    
    channel
      .on('broadcast', { event: 'audio-stream-started' }, ({ payload }) => {
        console.log('🎵 Audio stream available from host');
        // Get the session's mixed audio
        const sessionAudio = sessionLoopEngine.getMixedAudioStream();
        if (sessionAudio) {
          setRemoteAudioStream(sessionAudio);
          toast.success('Connected to audio stream');
        }
      })
      .on('broadcast', { event: 'audio-stream-stopped' }, () => {
        console.log('🎵 Audio stream ended');
        setRemoteAudioStream(null);
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [sessionId, isHost]);

  // Play remote audio for viewers
  useEffect(() => {
    if (!remoteAudioStream || isHost) return;

    const audioEl = document.createElement('audio');
    audioEl.srcObject = remoteAudioStream;
    audioEl.autoplay = true;
    audioEl.style.display = 'none';
    document.body.appendChild(audioEl);

    audioEl.play().catch((err) => {
      console.warn('Autoplay blocked - user needs to enable audio:', err);
    });

    return () => {
      audioEl.pause();
      audioEl.srcObject = null;
      audioEl.remove();
    };
  }, [remoteAudioStream, isHost]);

  return {
    isStreamingAudio,
    hasRemoteAudio: !!remoteAudioStream,
    startAudioStreaming,
    stopAudioStreaming
  };
};
