import { useEffect, useRef, useState } from 'react';

interface UseMuxAudioStreamProps {
  sessionId: string;
  isHost: boolean;
  enabled: boolean;
  mediaStream: MediaStream | null;
}

export const useMuxAudioStream = ({ 
  sessionId, 
  isHost, 
  enabled,
  mediaStream 
}: UseMuxAudioStreamProps) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const animationFrameRef = useRef<number | null>(null);

  // Get the WebSocket URL for your mux server
  const getMuxServerUrl = () => {
    // Use secure WebSocket for HTTPS, regular WebSocket for HTTP
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return `${protocol}//3.144.154.15:8080/stream/${sessionId}`;
  };

  // Start streaming to mux server
  const startStreaming = async () => {
    if (!isHost || !enabled) {
      console.log('[useMuxAudioStream] Cannot start: not host or not enabled', { isHost, enabled });
      return;
    }

    try {
      console.log('[useMuxAudioStream] Starting audio stream to mux server...');

      // Determine which MediaStream to send
      let streamToUse: MediaStream | null = mediaStream;

      // If no mixed stream is available yet, capture directly from Tone master
      if (!streamToUse) {
        console.log('[useMuxAudioStream] No mixed stream provided. Attempting Tone master capture fallback...');
        const tone = (window as any).Tone;
        const toneDest = tone?.getDestination ? tone.getDestination() : null;

        let captureCtx: AudioContext | null = null;
        if (toneDest?.context) {
          captureCtx = toneDest.context as AudioContext;
        } else {
          captureCtx = new AudioContext();
        }
        const mediaDest = captureCtx.createMediaStreamDestination();
        try {
          if (toneDest?.connect) {
            toneDest.connect(mediaDest);
            console.log('[useMuxAudioStream] Connected Tone destination to MediaStreamDestination');
          } else {
            console.warn('[useMuxAudioStream] Tone destination not available to connect');
          }
        } catch (e) {
          console.error('[useMuxAudioStream] Failed to connect Tone destination:', e);
        }
        streamToUse = mediaDest.stream;
      }

      if (!streamToUse) {
        console.warn('[useMuxAudioStream] No audio stream available to start streaming');
        return;
      }

      // Create audio context for level monitoring (separate from Tone)
      const analyserCtx = new AudioContext();
      audioContextRef.current = analyserCtx;

      // Set up audio level monitoring
      const analyser = analyserCtx.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = analyserCtx.createMediaStreamSource(streamToUse);
      source.connect(analyser);

      // Start monitoring audio levels
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      const updateLevel = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(dataArray);
        const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
        setAudioLevel(average);

        animationFrameRef.current = requestAnimationFrame(updateLevel);
      };
      updateLevel();

      // Connect to mux server WebSocket
      const wsUrl = getMuxServerUrl();
      console.log('[useMuxAudioStream] Connecting to:', wsUrl);

      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[useMuxAudioStream] WebSocket connected to mux server');

        // Create MediaRecorder to capture audio chunks
        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm';

        const recorder = new MediaRecorder(streamToUse as MediaStream, {
          mimeType,
          audioBitsPerSecond: 128000 // 128kbps
        });

        recorderRef.current = recorder;

        // Send audio chunks to mux server
        recorder.ondataavailable = async (event) => {
          if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
            try {
              const arrayBuffer = await event.data.arrayBuffer();
              ws.send(arrayBuffer);
              // console.log('[useMuxAudioStream] Sent chunk:', event.data.size, 'bytes');
            } catch (error) {
              console.error('[useMuxAudioStream] Error sending chunk:', error);
            }
          }
        };

        recorder.onerror = (event) => {
          console.error('[useMuxAudioStream] MediaRecorder error:', event);
        };

        recorder.onstart = () => {
          console.log('[useMuxAudioStream] MediaRecorder started');
        };

        recorder.onstop = () => {
          console.log('[useMuxAudioStream] MediaRecorder stopped');
        };

        // Start recording with 500ms chunks
        recorder.start(500);
        setIsStreaming(true);
        console.log('[useMuxAudioStream] Started capturing audio chunks');
      };

      ws.onerror = (error) => {
        console.error('[useMuxAudioStream] WebSocket error:', error);
        console.warn('[useMuxAudioStream] If this site is HTTPS, your server must support WSS with a valid certificate:', getMuxServerUrl());
        setIsStreaming(false);
      };

      ws.onclose = () => {
        console.log('[useMuxAudioStream] WebSocket disconnected');
        stopStreaming();
      };

      ws.onmessage = (event) => {
        console.log('[useMuxAudioStream] Server message:', event.data);
      };

    } catch (error) {
      console.error('[useMuxAudioStream] Error starting stream:', error);
      throw error;
    }
  };

  // Stop streaming
  const stopStreaming = () => {
    console.log('[useMuxAudioStream] Stopping stream...');

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current);
      animationFrameRef.current = null;
    }

    if (recorderRef.current && recorderRef.current.state !== 'inactive') {
      recorderRef.current.stop();
      recorderRef.current = null;
    }

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      wsRef.current.close();
      wsRef.current = null;
    }

    if (analyserRef.current) {
      analyserRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

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
    startStreaming,
    stopStreaming,
  };
};
