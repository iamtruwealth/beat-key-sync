import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface UseWebRTCAudioStreamProps {
  sessionId: string;
  isHost: boolean;
  enabled: boolean;
}

export const useWebRTCAudioStream = ({ sessionId, isHost, enabled }: UseWebRTCAudioStreamProps) => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [audioLevel, setAudioLevel] = useState(0);
  const channelRef = useRef<any>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const audioElementRef = useRef<HTMLAudioElement | null>(null);

  // Host: Start streaming audio
  const startStreaming = async () => {
    if (!isHost || !enabled) return;

    try {
      console.log('[WebRTC Audio] Starting audio stream...');
      
      // Get user's microphone/system audio
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        }
      });

      streamRef.current = stream;

      // Set up audio processing
      const audioContext = new AudioContext({ sampleRate: 24000 });
      audioContextRef.current = audioContext;

      const source = audioContext.createMediaStreamSource(stream);
      const processor = audioContext.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      processor.onaudioprocess = (e) => {
        const inputData = e.inputBuffer.getChannelData(0);
        
        // Calculate audio level for visual feedback
        const sum = inputData.reduce((a, b) => a + Math.abs(b), 0);
        const level = (sum / inputData.length) * 100;
        setAudioLevel(level);

        // Convert to base64 and broadcast
        if (channelRef.current) {
          const base64Audio = encodeAudioChunk(inputData);
          channelRef.current.send({
            type: 'broadcast',
            event: 'audio-chunk',
            payload: { audio: base64Audio, timestamp: Date.now() }
          });
        }
      };

      source.connect(processor);
      processor.connect(audioContext.destination);

      setIsStreaming(true);
      console.log('[WebRTC Audio] Stream started');
    } catch (error) {
      console.error('[WebRTC Audio] Error starting stream:', error);
      throw error;
    }
  };

  // Host: Stop streaming
  const stopStreaming = () => {
    console.log('[WebRTC Audio] Stopping stream...');
    
    if (processorRef.current) {
      processorRef.current.disconnect();
      processorRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    setIsStreaming(false);
    setAudioLevel(0);
  };

  // Viewer: Set up audio playback
  useEffect(() => {
    if (isHost || !enabled || !sessionId) return;

    console.log('[WebRTC Audio] Setting up viewer audio playback...');

    // Create audio element for playback
    const audioElement = new Audio();
    audioElement.autoplay = true;
    audioElementRef.current = audioElement;

    const audioContext = new AudioContext({ sampleRate: 24000 });
    audioContextRef.current = audioContext;

    // Audio queue for smooth playback
    const audioQueue: AudioBuffer[] = [];
    let isPlaying = false;

    const playNextChunk = async () => {
      if (audioQueue.length === 0 || isPlaying) return;
      
      isPlaying = true;
      const buffer = audioQueue.shift()!;
      
      const source = audioContext.createBufferSource();
      source.buffer = buffer;
      source.connect(audioContext.destination);
      
      source.onended = () => {
        isPlaying = false;
        playNextChunk();
      };
      
      source.start(0);
    };

    // Subscribe to audio channel
    const channel = supabase.channel(`audio-stream-${sessionId}`, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'audio-chunk' }, async ({ payload }) => {
        try {
          // Decode and queue audio
          const audioData = decodeAudioChunk(payload.audio);
          const audioBuffer = audioContext.createBuffer(1, audioData.length, 24000);
          audioBuffer.copyToChannel(audioData, 0);
          
          audioQueue.push(audioBuffer);
          playNextChunk();
        } catch (error) {
          console.error('[WebRTC Audio] Error playing audio chunk:', error);
        }
      })
      .subscribe((status) => {
        console.log('[WebRTC Audio] Viewer channel status:', status);
      });

    channelRef.current = channel;

    return () => {
      console.log('[WebRTC Audio] Cleaning up viewer...');
      channel.unsubscribe();
      audioContext.close();
    };
  }, [sessionId, isHost, enabled]);

  // Host: Set up broadcast channel
  useEffect(() => {
    if (!isHost || !enabled || !sessionId) return;

    console.log('[WebRTC Audio] Setting up host broadcast channel...');

    const channel = supabase.channel(`audio-stream-${sessionId}`, {
      config: { broadcast: { self: false } }
    });

    channel.subscribe((status) => {
      console.log('[WebRTC Audio] Host channel status:', status);
    });

    channelRef.current = channel;

    return () => {
      console.log('[WebRTC Audio] Cleaning up host...');
      stopStreaming();
      channel.unsubscribe();
    };
  }, [sessionId, isHost, enabled]);

  return {
    isStreaming,
    audioLevel,
    startStreaming,
    stopStreaming
  };
};

// Helper: Encode Float32Array to base64
function encodeAudioChunk(float32Array: Float32Array): string {
  const int16Array = new Int16Array(float32Array.length);
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]));
    int16Array[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  
  const uint8Array = new Uint8Array(int16Array.buffer);
  let binary = '';
  const chunkSize = 0x8000;
  
  for (let i = 0; i < uint8Array.length; i += chunkSize) {
    const chunk = uint8Array.subarray(i, Math.min(i + chunkSize, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  
  return btoa(binary);
}

// Helper: Decode base64 to Float32Array
function decodeAudioChunk(base64: string): Float32Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  
  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 0x8000 : 0x7FFF);
  }
  
  return float32Array;
}
