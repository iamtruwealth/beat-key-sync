import { useEffect, useRef, useState, useCallback } from 'react';

interface UseMuxAudioStreamOptions {
  mediaStream: MediaStream | null;
  enabled: boolean;
  onConnect?: () => void;
  onDisconnect?: () => void;
  onError?: (error: any) => void;
}

interface UseMuxAudioStreamReturn {
  isStreaming: boolean;
  audioLevel: number;
  startStreaming: () => void;
  stopStreaming: () => void;
}

const RELAY_WS_URL = 'ws://3.144.154.15:8080';

export function useMuxAudioStream({ 
  mediaStream, 
  enabled,
  onConnect,
  onDisconnect,
  onError 
}: UseMuxAudioStreamOptions): UseMuxAudioStreamReturn {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  
  const [isStreaming, setIsStreaming] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);

  const stopStreaming = useCallback(() => {
    console.log('[MuxAudioStream] Stopping streaming...');
    
    // Stop animation frame
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    // Stop recorder
    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      recorderRef.current = null;
    }

    // Close WebSocket
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
      wsRef.current = null;
    }

    // Clean up audio analysis
    if (analyserRef.current) {
      analyserRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current = null;
    }

    setIsStreaming(false);
    setAudioLevel(0);
    onDisconnect?.();
  }, [onDisconnect]);

  const startStreaming = useCallback(() => {
    if (!mediaStream) {
      console.log('[MuxAudioStream] Cannot start streaming: no mediaStream');
      return;
    }

    if (isStreaming) {
      console.log('[MuxAudioStream] Already streaming');
      return;
    }

    console.log('[MuxAudioStream] Starting streaming to relay...');

    try {
      // Create WebSocket connection
      wsRef.current = new WebSocket(RELAY_WS_URL);
      wsRef.current.binaryType = "arraybuffer";

      wsRef.current.onopen = () => {
        console.log('[MuxAudioStream] WebSocket connected to relay');
        
        if (!mediaStream) {
          console.error('[MuxAudioStream] No media stream available');
          stopStreaming();
          return;
        }

        try {
          // Create MediaRecorder
          recorderRef.current = new MediaRecorder(mediaStream, { 
            mimeType: 'audio/webm;codecs=opus' 
          });
          
          recorderRef.current.ondataavailable = (e) => {
            if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
              wsRef.current.send(e.data);
            }
          };

          recorderRef.current.onerror = (error) => {
            console.error('[MuxAudioStream] MediaRecorder error:', error);
            onError?.(error);
            stopStreaming();
          };

          recorderRef.current.start(250); // 250ms chunks
          setIsStreaming(true);
          onConnect?.();
          
          // Set up audio level monitoring
          audioContextRef.current = new AudioContext();
          analyserRef.current = audioContextRef.current.createAnalyser();
          analyserRef.current.fftSize = 256;
          
          const source = audioContextRef.current.createMediaStreamSource(mediaStream);
          source.connect(analyserRef.current);
          
          const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
          
          const updateLevel = () => {
            if (!analyserRef.current) return;
            
            analyserRef.current.getByteFrequencyData(dataArray);
            const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
            setAudioLevel(average / 255 * 100);
            
            animationFrameRef.current = requestAnimationFrame(updateLevel);
          };
          
          updateLevel();
          
        } catch (error) {
          console.error('[MuxAudioStream] Error starting MediaRecorder:', error);
          onError?.(error);
          stopStreaming();
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('[MuxAudioStream] WebSocket error:', error);
        onError?.(error);
        stopStreaming();
      };

      wsRef.current.onclose = () => {
        console.log('[MuxAudioStream] WebSocket closed');
        stopStreaming();
      };

    } catch (error) {
      console.error('[MuxAudioStream] Error creating WebSocket:', error);
      onError?.(error);
      stopStreaming();
    }
  }, [mediaStream, isStreaming, onConnect, onError, stopStreaming]);

  // Auto-start/stop based on enabled flag and mediaStream availability
  useEffect(() => {
    if (enabled && mediaStream && !isStreaming) {
      startStreaming();
    } else if ((!enabled || !mediaStream) && isStreaming) {
      stopStreaming();
    }
  }, [enabled, mediaStream, isStreaming, startStreaming, stopStreaming]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopStreaming();
    };
  }, [stopStreaming]);

  return {
    isStreaming,
    audioLevel,
    startStreaming,
    stopStreaming,
  };
}
