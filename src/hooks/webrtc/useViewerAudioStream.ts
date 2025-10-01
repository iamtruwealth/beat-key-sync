import { useCallback, useRef } from 'react';

export const useViewerAudioStream = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const contextRef = useRef<AudioContext | null>(null);
  const currentStreamIdRef = useRef<string | null>(null);

  const playRemoteStream = useCallback(async (stream: MediaStream): Promise<HTMLAudioElement> => {
    console.log('👀 Setting up viewer audio playback');

    // Reuse single audio element across renegotiations
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.autoplay = true;
      // @ts-ignore - playsInline is valid for iOS Safari
      audioRef.current.playsInline = true;
    }

    // Deduplicate: if it's the same stream, don't restart
    if (currentStreamIdRef.current === stream.id && audioRef.current.srcObject) {
      console.log('🔁 Remote stream unchanged; reusing existing audio element');
      return audioRef.current;
    }

    // Try direct attachment first
    audioRef.current.srcObject = stream;
    try {
      await audioRef.current.play();
      currentStreamIdRef.current = stream.id;
      console.log('✅ Audio playback started (single element)');
      return audioRef.current;
    } catch (error) {
      console.warn('⚠️ Direct playback failed, trying WebAudio fallback:', error);
      try {
        if (!contextRef.current) {
          contextRef.current = new AudioContext();
        }
        const source = contextRef.current.createMediaStreamSource(stream);
        const destination = contextRef.current.createMediaStreamDestination();
        source.connect(destination);

        audioRef.current.srcObject = destination.stream;
        await audioRef.current.play();
        currentStreamIdRef.current = stream.id;
        console.log('✅ Audio playback started with WebAudio fallback (single element)');
        return audioRef.current;
      } catch (fallbackError) {
        console.error('❌ All audio playback methods failed:', fallbackError);
        throw fallbackError;
      }
    }
  }, []);

  const stopAudioPlayback = useCallback((audioElement?: HTMLAudioElement) => {
    const el = audioElement || audioRef.current;
    if (el) {
      el.pause();
      el.srcObject = null;
    }
    if (contextRef.current) {
      contextRef.current.close().catch(() => {});
      contextRef.current = null;
    }
    currentStreamIdRef.current = null;
    console.log('🛑 Stopped viewer audio playback');
  }, []);

  return {
    playRemoteStream,
    stopAudioPlayback
  };
};
