import { useCallback } from 'react';

export const useViewerAudioStream = () => {
  const playRemoteStream = useCallback(async (stream: MediaStream): Promise<HTMLAudioElement> => {
    console.log('👀 Setting up viewer audio playback');
    
    const audioElement = new Audio();
    audioElement.srcObject = stream;
    audioElement.autoplay = true;
    // @ts-ignore - playsInline is valid for iOS Safari
    audioElement.playsInline = true;

    try {
      // Try direct playback first
      await audioElement.play();
      console.log('✅ Audio playback started successfully');
      return audioElement;
    } catch (error) {
      console.warn('⚠️ Direct playback failed, trying WebAudio fallback:', error);
      
      // iOS Safari fallback: Use WebAudio API
      try {
        const audioContext = new AudioContext();
        const source = audioContext.createMediaStreamSource(stream);
        const destination = audioContext.createMediaStreamDestination();
        source.connect(destination);
        
        audioElement.srcObject = destination.stream;
        await audioElement.play();
        
        console.log('✅ Audio playback started with WebAudio fallback');
        return audioElement;
      } catch (fallbackError) {
        console.error('❌ All audio playback methods failed:', fallbackError);
        throw fallbackError;
      }
    }
  }, []);

  const stopAudioPlayback = useCallback((audioElement: HTMLAudioElement) => {
    if (audioElement) {
      audioElement.pause();
      audioElement.srcObject = null;
      console.log('🛑 Stopped viewer audio playback');
    }
  }, []);

  return {
    playRemoteStream,
    stopAudioPlayback
  };
};
