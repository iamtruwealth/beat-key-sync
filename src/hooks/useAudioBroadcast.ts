import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { createChannelName } from '@/lib/realtimeChannels';

interface UseAudioBroadcastProps {
  sessionId: string;
  isHost: boolean;
  audioStream: MediaStream | null;
  enabled: boolean;
}

/**
 * Broadcasts audio from the host to viewers via Supabase Realtime
 * Captures audio chunks from a MediaStream and sends them to viewers
 */
export const useAudioBroadcast = ({ sessionId, isHost, audioStream, enabled }: UseAudioBroadcastProps) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const sourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  useEffect(() => {
    if (!isHost || !enabled || !sessionId || !audioStream) return;

    console.log('[AudioBroadcast] Starting audio broadcast for session:', sessionId);

    const channelName = createChannelName(`audio-broadcast-${sessionId}`);
    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[AudioBroadcast] Broadcast channel subscribed');
      }
    });

    channelRef.current = channel;

    // Set up audio capture
    const setupAudioCapture = async () => {
      try {
        // Create audio context for processing
        const audioContext = new AudioContext({ sampleRate: 24000 });
        audioContextRef.current = audioContext;

        // Create source from MediaStream
        const source = audioContext.createMediaStreamSource(audioStream);
        sourceRef.current = source;

        // Create script processor for capturing audio chunks
        const processor = audioContext.createScriptProcessor(8192, 1, 1);
        processorRef.current = processor;

        processor.onaudioprocess = (e) => {
          if (!channelRef.current) return;

          const inputData = e.inputBuffer.getChannelData(0);
          
          // Convert Float32Array to Int16Array (PCM16)
          const int16Data = new Int16Array(inputData.length);
          for (let i = 0; i < inputData.length; i++) {
            const s = Math.max(-1, Math.min(1, inputData[i]));
            int16Data[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
          }

          // Convert to base64
          const uint8Data = new Uint8Array(int16Data.buffer);
          let binary = '';
          const chunkSize = 0x8000;
          for (let i = 0; i < uint8Data.length; i += chunkSize) {
            const chunk = uint8Data.subarray(i, Math.min(i + chunkSize, uint8Data.length));
            binary += String.fromCharCode(...Array.from(chunk));
          }
          const base64Audio = btoa(binary);

          // Broadcast audio chunk
          channelRef.current.send({
            type: 'broadcast',
            event: 'audio-chunk',
            payload: {
              audio: base64Audio,
              sampleRate: audioContext.sampleRate,
              timestamp: Date.now(),
            },
          });
        };

        // Connect nodes
        source.connect(processor);
        processor.connect(audioContext.destination);

        console.log('[AudioBroadcast] Audio capture setup complete');
      } catch (error) {
        console.error('[AudioBroadcast] Error setting up audio capture:', error);
      }
    };

    setupAudioCapture();

    return () => {
      console.log('[AudioBroadcast] Cleaning up audio broadcast');
      
      if (processorRef.current) {
        processorRef.current.disconnect();
        processorRef.current = null;
      }
      
      if (sourceRef.current) {
        sourceRef.current.disconnect();
        sourceRef.current = null;
      }
      
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
      
      if (channelRef.current) {
        channelRef.current.unsubscribe();
        channelRef.current = null;
      }
    };
  }, [sessionId, isHost, audioStream, enabled]);

  return {
    isActive: !!channelRef.current,
  };
};
