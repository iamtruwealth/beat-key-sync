import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { createChannelName } from '@/lib/realtimeChannels';

interface UseAudioReceiverProps {
  sessionId: string;
  isViewer: boolean;
  enabled: boolean;
}

/**
 * Receives and plays audio broadcast from the host
 * Buffers audio chunks and plays them sequentially
 */
export const useAudioReceiver = ({ sessionId, isViewer, enabled }: UseAudioReceiverProps) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);
  const channelRef = useRef<RealtimeChannel | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<AudioBuffer[]>([]);
  const isPlayingRef = useRef(false);

  useEffect(() => {
    if (!isViewer || !enabled || !sessionId) return;

    console.log('[AudioReceiver] Initializing audio receiver for session:', sessionId);

    // Create audio context
    const audioContext = new AudioContext({ sampleRate: 24000 });
    audioContextRef.current = audioContext;

    // Check if audio is unlocked
    if (audioContext.state === 'running') {
      setAudioUnlocked(true);
    } else {
      setAudioUnlocked(false);
    }
    const playNextChunk = () => {
      if (isPlayingRef.current || audioQueueRef.current.length === 0) return;
      
      isPlayingRef.current = true;
      setIsPlaying(true);
      
      const buffer = audioQueueRef.current.shift()!;
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      
      source.onended = () => {
        isPlayingRef.current = false;
        setIsPlaying(false);
        playNextChunk(); // Play next chunk
      };
      
      source.start(0);
    };

    const channelName = createChannelName(`audio-broadcast-${sessionId}`);
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    channel
      .on('broadcast', { event: 'audio-chunk' }, async ({ payload }) => {
        try {
          // Decode base64 audio
          const binaryString = atob(payload.audio);
          const bytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Convert to Int16Array
          const int16Data = new Int16Array(bytes.buffer);
          
          // Convert to Float32Array
          const float32Data = new Float32Array(int16Data.length);
          for (let i = 0; i < int16Data.length; i++) {
            float32Data[i] = int16Data[i] / (int16Data[i] < 0 ? 0x8000 : 0x7FFF);
          }

          // Create audio buffer
          const sampleRate = payload.sampleRate || audioContext.sampleRate;
          const audioBuffer = audioContext.createBuffer(1, float32Data.length, sampleRate);
          audioBuffer.copyToChannel(float32Data, 0);

          // Add to queue
          audioQueueRef.current.push(audioBuffer);
          
          // Start playback if not already playing
          playNextChunk();
        } catch (error) {
          console.error('[AudioReceiver] Error processing audio chunk:', error);
        }
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[AudioReceiver] Receiver channel subscribed');
          setIsConnected(true);
        } else if (status === 'CLOSED') {
          console.log('[AudioReceiver] Receiver channel closed');
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[AudioReceiver] Cleaning up audio receiver');
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
      
      audioQueueRef.current = [];
      isPlayingRef.current = false;
      setIsConnected(false);
      setIsPlaying(false);
      setAudioUnlocked(false);
    };
  }, [sessionId, isViewer, enabled]);

  const unlockAudio = async () => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      }
      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('[AudioReceiver] Audio unlocked by user interaction');
      }
      setAudioUnlocked(true);
    } catch (error) {
      console.error('[AudioReceiver] Failed to unlock audio:', error);
    }
  };

  return {
    isConnected,
    isPlaying,
    audioUnlocked,
    unlockAudio,
  };
};
