import React, { createContext, useContext, useState, useRef, useEffect, ReactNode } from 'react';

export interface Track {
  id: string;
  title: string;
  artist?: string;
  file_url: string;
  artwork_url?: string;
  duration?: number;
  detected_key?: string;
  detected_bpm?: number;
  manual_key?: string;
  manual_bpm?: number;
}

interface AudioContextType {
  currentTrack: Track | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  playTrack: (track: Track) => void;
  pauseTrack: () => void;
  resumeTrack: () => void;
  togglePlayPause: () => void;
  setVolume: (volume: number) => void;
  seekTo: (time: number) => void;
  loading: boolean;
  getAudioElement: () => HTMLAudioElement | null;
}

const AudioContext = createContext<AudioContextType | undefined>(undefined);

export const useAudio = () => {
  const context = useContext(AudioContext);
  if (context === undefined) {
    throw new Error('useAudio must be used within an AudioProvider');
  }
  return context;
};

interface AudioProviderProps {
  children: ReactNode;
}

export const AudioProvider: React.FC<AudioProviderProps> = ({ children }) => {
  const [currentTrack, setCurrentTrack] = useState<Track | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(1);
  const [loading, setLoading] = useState(false);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Initialize audio element
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'metadata';
      // Ensure cross-origin audio can be analyzed by Web Audio API
      audioRef.current.crossOrigin = 'anonymous';
      // Ensure audible defaults
      audioRef.current.muted = false;
      audioRef.current.volume = 1;
    }

    const audio = audioRef.current;

    const handleTimeUpdate = () => setCurrentTime(audio.currentTime);
    const handleDurationChange = () => setDuration(audio.duration || 0);
    const handleEnded = () => setIsPlaying(false);
    const handleCanPlay = () => setLoading(false);
    const handleLoadStart = () => setLoading(true);
    const handleError = () => {
      setLoading(false);
      setIsPlaying(false);
      console.error('Audio playback error');
    };

    audio.addEventListener('timeupdate', handleTimeUpdate);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('canplay', handleCanPlay);
    audio.addEventListener('loadstart', handleLoadStart);
    audio.addEventListener('error', handleError);

    return () => {
      audio.removeEventListener('timeupdate', handleTimeUpdate);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('canplay', handleCanPlay);
      audio.removeEventListener('loadstart', handleLoadStart);
      audio.removeEventListener('error', handleError);
    };
  }, []);

  const playTrack = async (track: Track) => {
    if (!audioRef.current) return;

    const audio = audioRef.current;
    console.log('AudioContext: Attempting to play track:', track.title, track.file_url);

    // If it's the same track, just toggle play/pause
    if (currentTrack?.id === track.id) {
      togglePlayPause();
      return;
    }

    // Stop current audio first to prevent conflicts
    audio.pause();
    setIsPlaying(false);
    
    // Load new track
    setLoading(true);
    setCurrentTrack(track);
    audio.src = track.file_url;
    
    // Small delay to ensure previous audio is properly stopped
    await new Promise(resolve => setTimeout(resolve, 50));
    
    try {
      console.log('AudioContext: Loading audio from:', track.file_url);
      // Ensure audio is audible
      audio.muted = false;
      if (audio.volume === 0) {
        audio.volume = 0.8;
        setVolumeState(0.8);
      }
      await audio.play();
      console.log('AudioContext: Successfully started playing');
      setIsPlaying(true);
    } catch (error) {
      // Only log non-abort errors
      // @ts-ignore - error may not have name
      if (error?.name !== 'AbortError') {
        console.error('AudioContext: Failed to play audio:', error);
      }
      setIsPlaying(false);
      setLoading(false);
    }
  };

  const pauseTrack = () => {
    if (audioRef.current) {
      audioRef.current.pause();
      setIsPlaying(false);
    }
  };

  const resumeTrack = async () => {
    if (audioRef.current && currentTrack) {
      try {
        await audioRef.current.play();
        setIsPlaying(true);
      } catch (error) {
        console.error('Failed to resume audio:', error);
      }
    }
  };

  const togglePlayPause = () => {
    if (isPlaying) {
      pauseTrack();
    } else {
      resumeTrack();
    }
  };

  const setVolume = (newVolume: number) => {
    if (audioRef.current) {
      audioRef.current.volume = newVolume;
      setVolumeState(newVolume);
    }
  };

  const seekTo = (time: number) => {
    if (audioRef.current) {
      audioRef.current.currentTime = time;
      setCurrentTime(time);
    }
  };

  const getAudioElement = () => audioRef.current;

  const value: AudioContextType = {
    currentTrack,
    isPlaying,
    currentTime,
    duration,
    volume,
    playTrack,
    pauseTrack,
    resumeTrack,
    togglePlayPause,
    setVolume,
    seekTo,
    loading,
    getAudioElement,
  };

  return (
    <AudioContext.Provider value={value}>
      {children}
    </AudioContext.Provider>
  );
};