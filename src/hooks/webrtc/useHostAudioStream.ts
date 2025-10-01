import { useState, useRef, useCallback } from 'react';
import { HostMasterAudio } from '@/lib/HostMasterAudio';
import { toast } from 'sonner';

export const useHostAudioStream = () => {
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamEnabled, setStreamEnabled] = useState({ video: true, audio: true });
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const externalAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const externalAudioStreamRef = useRef<MediaStream | null>(null);

  const initializeMasterAudio = useCallback(async () => {
    const hostMaster = HostMasterAudio.getInstance();
    if (!hostMaster.isInitialized) {
      await hostMaster.initialize();
      hostMaster.connectToCookModeEngine();
    }
    return hostMaster;
  }, []);

  const startStreaming = useCallback(async (
    onTrackReady?: (track: MediaStreamTrack, stream: MediaStream) => void
  ) => {
    try {
      console.log('📻 Starting master audio broadcast');
      
      // Initialize HostMasterAudio first
      const hostMaster = await initializeMasterAudio();

      // Get the master audio stream for broadcasting
      const masterAudioStream = hostMaster.getMasterStream();
      if (!masterAudioStream) {
        throw new Error('No master audio stream available');
      }

      // Create main broadcast stream (audio + optional video)
      const stream = streamEnabled.video 
        ? await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        : new MediaStream();

      // Add master audio track to the broadcast stream
      const audioTrack = masterAudioStream.getAudioTracks()[0];
      if (audioTrack) {
        console.log('📻 Adding master audio track to broadcast stream');
        stream.addTrack(audioTrack);
        externalAudioTrackRef.current = audioTrack;
        externalAudioStreamRef.current = masterAudioStream;
        
        // Notify about track being ready
        if (onTrackReady) {
          onTrackReady(audioTrack, masterAudioStream);
        }
      }

      setLocalStream(stream);
      setIsStreaming(true);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      toast.success('📻 Master audio broadcast started');
      return stream;
    } catch (error) {
      console.error('Error starting master audio broadcast:', error);
      toast.error('Failed to start audio broadcast');
      throw error;
    }
  }, [streamEnabled.video, initializeMasterAudio]);

  const stopStreaming = useCallback(() => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }
    setIsStreaming(false);
    externalAudioTrackRef.current = null;
    externalAudioStreamRef.current = null;
    console.log('🛑 Stopped master audio broadcast');
    toast.success('Stopped video streaming');
  }, [localStream]);

  const toggleVideo = useCallback(() => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setStreamEnabled(prev => ({ ...prev, video: videoTrack.enabled }));
      }
    }
  }, [localStream]);

  const toggleAudio = useCallback(() => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setStreamEnabled(prev => ({ ...prev, audio: audioTrack.enabled }));
      }
    }
  }, [localStream]);

  const getMasterAudioTrack = useCallback(() => {
    return externalAudioTrackRef.current;
  }, []);

  const getMasterAudioStream = useCallback(() => {
    return externalAudioStreamRef.current;
  }, []);

  return {
    isStreaming,
    streamEnabled,
    localStream,
    localVideoRef,
    startStreaming,
    stopStreaming,
    toggleVideo,
    toggleAudio,
    getMasterAudioTrack,
    getMasterAudioStream
  };
};
