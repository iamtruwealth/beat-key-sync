import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { createChannelName } from '@/lib/realtimeChannels';

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

  // Host: Start streaming master audio output
  const startStreaming = async (masterAudioDestination?: AudioDestinationNode) => {
    if (!isHost || !enabled) return;

    try {
      console.log('[WebRTC Audio] Starting master audio stream...');
      
      if (!masterAudioDestination) {
        throw new Error('Master audio destination not provided');
      }

      // Use the audio context from the master destination
      const audioContext = (masterAudioDestination as any).context as AudioContext;
      if (!audioContext) {
        throw new Error('Audio context not available from master destination');
      }

      console.log('[WebRTC Audio] Using audio context from DAW');
      audioContextRef.current = audioContext;

      // Create a MediaStreamDestination to capture Tone's output
      const destination = audioContext.createMediaStreamDestination();
      
      // Connect Tone's master output directly to our stream destination
      if ((window as any).Tone?.getDestination) {
        const toneDest = (window as any).Tone.getDestination();
        toneDest.connect(destination);
      } else if (masterAudioDestination && (masterAudioDestination as any).connect) {
        (masterAudioDestination as any).connect(destination);
      }
      console.log('[WebRTC Audio] Connected master to stream destination');
      
      // Set up audio processing for broadcasting (AudioWorklet preferred)
      const source = audioContext.createMediaStreamSource(destination.stream);

      let workletSupported = !!(audioContext as any).audioWorklet;
      if (workletSupported) {
        try {
          await (audioContext as any).audioWorklet.addModule('/pcm-audio-worklet.js');
          const node: any = new (window as any).AudioWorkletNode(audioContext, 'pcm-audio-processor', {
            numberOfInputs: 1,
            numberOfOutputs: 0,
            channelCount: 1,
          });
          // Reuse ref to manage lifecycle
          processorRef.current = node as unknown as ScriptProcessorNode;

          node.port.onmessage = (event: MessageEvent) => {
            const inputData = event.data as Float32Array;

            // Calculate audio level for visual feedback
            let sum = 0;
            for (let i = 0; i < inputData.length; i++) sum += Math.abs(inputData[i]);
            const level = (sum / inputData.length) * 100;
            setAudioLevel(level);

            // Convert to base64 and broadcast
            if (channelRef.current) {
              const base64Audio = encodeAudioChunk(inputData);
              channelRef.current.send({
                type: 'broadcast',
                event: 'audio-chunk',
                payload: { audio: base64Audio, timestamp: Date.now(), sampleRate: audioContext.sampleRate }
              });
            }
          };

          source.connect(node);
          console.log('[WebRTC Audio] Master audio stream started via AudioWorklet');
        } catch (e) {
          console.warn('[WebRTC Audio] AudioWorklet init failed, falling back to ScriptProcessor', e);
          workletSupported = false;
        }
      }

      if (!workletSupported) {
        const processor = (audioContext as any).createScriptProcessor?.(4096, 1, 1);
        if (!processor) {
          throw new Error('No supported audio processing node available');
        }
        processorRef.current = processor;

        processor.onaudioprocess = (e: AudioProcessingEvent) => {
          const inputData = e.inputBuffer.getChannelData(0);

          // Calculate audio level for visual feedback
          let sum = 0;
          for (let i = 0; i < inputData.length; i++) sum += Math.abs(inputData[i]);
          const level = (sum / inputData.length) * 100;
          setAudioLevel(level);

          // Convert to base64 and broadcast
          if (channelRef.current) {
            const base64Audio = encodeAudioChunk(inputData);
            channelRef.current.send({
              type: 'broadcast',
              event: 'audio-chunk',
              payload: { audio: base64Audio, timestamp: Date.now(), sampleRate: audioContext.sampleRate }
            });
          }
        };

        source.connect(processor);
        processor.connect(audioContext.destination);
        console.log('[WebRTC Audio] Master audio stream started via ScriptProcessor');
      }

      streamRef.current = destination.stream;
      setIsStreaming(true);
      console.log('[WebRTC Audio] Master audio stream started - capturing DAW output');
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

    // Do not close the DAW's main AudioContext here
    audioContextRef.current = null;

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

    const audioContext = new AudioContext();
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
    const channelName = createChannelName(`audio-stream-${sessionId}`);
    const channel = supabase.channel(channelName, {
      config: { broadcast: { self: false } }
    });

    channel
      .on('broadcast', { event: 'audio-chunk' }, async ({ payload }) => {
        try {
          // Decode and queue audio
          const audioData = decodeAudioChunk(payload.audio);
          const sampleRate = payload?.sampleRate || audioContext.sampleRate;
          const audioBuffer = audioContext.createBuffer(1, audioData.length, sampleRate);
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

    const channelName = createChannelName(`audio-stream-${sessionId}`);
    const channel = supabase.channel(channelName, {
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
    startStreaming: (masterDest?: AudioDestinationNode) => startStreaming(masterDest),
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
