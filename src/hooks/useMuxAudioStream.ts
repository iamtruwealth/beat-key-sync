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
    if (!isHost || !enabled || !mediaStream) {
      console.log('[useMuxAudioStream] Cannot start:', { isHost, enabled, hasStream: !!mediaStream });
      return;
    }

    try {
      console.log('[useMuxAudioStream] Starting audio stream to mux server...');

      // Create audio context for level monitoring
      const audioContext = new AudioContext();
      audioContextRef.current = audioContext;

      // Set up audio level monitoring
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      analyserRef.current = analyser;

      const source = audioContext.createMediaStreamSource(mediaStream);
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

        const recorder = new MediaRecorder(mediaStream, {
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
              console.log('[useMuxAudioStream] Sent chunk:', event.data.size, 'bytes');
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
