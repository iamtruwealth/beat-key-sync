import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseHLSAudioStreamProps {
  sessionId: string;
  isHost: boolean;
  enabled: boolean;
}

export const useHLSAudioStream = ({ sessionId, isHost, enabled }: UseHLSAudioStreamProps) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Get the edge function URL for streaming
  const getStreamUrl = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
    return `${supabaseUrl.replace('https://', 'wss://')}/functions/v1/stream-audio?session=${sessionId}`;
  };

  // Host: Start streaming with MediaRecorder
  const startStreaming = async (masterAudioDestination?: AudioDestinationNode) => {
    if (!isHost || !enabled) return;

    try {
      console.log('[HLS Stream] Starting audio capture...');
      
      if (!masterAudioDestination) {
        throw new Error('Master audio destination not provided');
      }

      // Use the audio context from the master destination
      const audioContext = (masterAudioDestination as any).context as AudioContext;
      if (!audioContext) {
        throw new Error('Audio context not available from master destination');
      }

      console.log('[HLS Stream] Using DAW audio context');
      audioContextRef.current = audioContext;

      // Create a MediaStreamDestination to capture audio
      const destination = audioContext.createMediaStreamDestination();
      
      // Connect Tone's master output to our stream destination
      if ((window as any).Tone?.getDestination) {
        const toneDest = (window as any).Tone.getDestination();
        toneDest.connect(destination);
      } else if (masterAudioDestination && (masterAudioDestination as any).connect) {
        (masterAudioDestination as any).connect(destination);
      }
      console.log('[HLS Stream] Connected master to stream destination');

      // Set up audio level monitoring
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;
      
      const source = audioContext.createMediaStreamSource(destination.stream);
      source.connect(analyser);

      // Start monitoring audio levels
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;
        
        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
        setAudioLevel(average);
        
        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // Connect to streaming WebSocket
      const streamUrl = getStreamUrl();
      console.log('[HLS Stream] Connecting to:', streamUrl);
      
      const ws = new WebSocket(streamUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[HLS Stream] WebSocket connected');
        
        // Create MediaRecorder with optimal settings
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';
        
        const mediaRecorder = new MediaRecorder(destination.stream, {
          mimeType,
          audioBitsPerSecond: 128000 // 128kbps
        });
        
        mediaRecorderRef.current = mediaRecorder;

        // Send audio chunks to server
        mediaRecorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            try {
              const arrayBuffer = await event.data.arrayBuffer();
              ws.send(arrayBuffer);
            } catch (error) {
              console.error('[HLS Stream] Error sending chunk:', error);
            }
          }
        };

        mediaRecorder.onerror = (event) => {
          console.error('[HLS Stream] MediaRecorder error:', event);
        };

        // Start recording with 500ms chunks
        mediaRecorder.start(500);
        setIsStreaming(true);
        console.log('[HLS Stream] Started capturing audio chunks');
      };

      ws.onerror = (error) => {
        console.error('[HLS Stream] WebSocket error:', error);
        throw new Error('Failed to connect to streaming server');
      };

      ws.onclose = () => {
        console.log('[HLS Stream] WebSocket disconnected');
        stopStreaming();
      };

    } catch (error) {
      console.error('[HLS Stream] Error starting stream:', error);
      throw error;
    }
  };

  // Host: Stop streaming
  const stopStreaming = () => {
    console.log('[HLS Stream] Stopping stream...');
    
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current = null;
    }

    audioContextRef.current = null;
    setIsStreaming(false);
    setAudioLevel(0);
  };

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, []);

  return {
    isStreaming,
    audioLevel,
    startStreaming: (masterDest?: AudioDestinationNode) => startStreaming(masterDest),
    stopStreaming,
    streamUrl: `/stream/${sessionId}/out.m3u8` // HLS playlist URL
  };
};
