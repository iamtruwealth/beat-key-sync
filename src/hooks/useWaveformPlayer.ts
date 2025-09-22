import { useState, useRef, useCallback } from 'react';

interface Track {
  id: string;
  title: string;
  artist: string;
  file_url?: string;
  audio_file_url?: string;
  artwork_url?: string;
  duration?: number;
}

export function useWaveformPlayer() {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playTrack = useCallback((track: Track) => {
    if (currentTrack?.id === track.id) {
      // Same track, just toggle play/pause
      if (isPlaying) {
        pauseTrack();
      } else {
        resumeTrack();
      }
      return;
    }

    // New track
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    const audioUrl = track.file_url || track.audio_file_url;
    if (!audioUrl) return;

    const audio = new Audio(audioUrl);
    audio.volume = volume;
    
    audio.addEventListener('loadedmetadata', () => {
      setDuration(audio.duration);
    });

    audio.addEventListener('timeupdate', () => {
      setCurrentTime(audio.currentTime);
    });

    audio.addEventListener('ended', () => {
      setIsPlaying(false);
      setCurrentTime(0);
    });

    audio.addEventListener('play', () => {
      setIsPlaying(true);
    });

    audio.addEventListener('pause', () => {
      setIsPlaying(false);
    });

    audioRef.current = audio;
    setCurrentTrack(track);
    
    audio.play().catch(console.error);
  }, [currentTrack, isPlaying, volume]);

  const pauseTrack = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
  }, []);

  const resumeTrack = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.play().catch(console.error);
    }
  }, []);

  const seekTo = useCallback((time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  }, []);

  const setVolumeLevel = useCallback((newVolume: number) => {
    setVolume(newVolume);
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
    }
  }, []);

  const stopTrack = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    setCurrentTrack(null);
    setIsPlaying(false);
    setCurrentTime(0);
    setDuration(0);
  }, []);

  return {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playTrack,
    pauseTrack,
    resumeTrack,
    seekTo,
    setVolume: setVolumeLevel,
    stopTrack,
  };
}