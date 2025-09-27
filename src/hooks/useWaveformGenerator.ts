import { useState, useEffect, useCallback } from 'react';
import { generateWaveformFromUrl, WaveformData, waveformCache } from '@/lib/waveformGenerator';

interface UseWaveformGeneratorProps {
  audioUrl?: string;
  targetWidth?: number;
}

interface UseWaveformGeneratorResult {
  waveformData: WaveformData | null;
  isLoading: boolean;
  error: string | null;
  regenerate: () => void;
}

export function useWaveformGenerator({ 
  audioUrl, 
  targetWidth = 1000 
}: UseWaveformGeneratorProps): UseWaveformGeneratorResult {
  const [waveformData, setWaveformData] = useState<WaveformData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generateWaveform = useCallback(async () => {
    if (!audioUrl) {
      setWaveformData(null);
      return;
    }

    // Check cache first
    const cached = waveformCache.get(audioUrl);
    if (cached) {
      setWaveformData(cached);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      console.log('Generating waveform for:', audioUrl);
      const data = await generateWaveformFromUrl(audioUrl, targetWidth);
      
      // Cache the result
      waveformCache.set(audioUrl, data);
      setWaveformData(data);
      console.log('Waveform generated successfully:', data);
    } catch (err) {
      console.error('Failed to generate waveform:', err);
      setError(err instanceof Error ? err.message : 'Failed to generate waveform');
      setWaveformData(null);
    } finally {
      setIsLoading(false);
    }
  }, [audioUrl, targetWidth]);

  const regenerate = useCallback(() => {
    if (audioUrl) {
      // Clear from cache to force regeneration
      waveformCache.set(audioUrl, null as any);
      generateWaveform();
    }
  }, [audioUrl, generateWaveform]);

  useEffect(() => {
    generateWaveform();
  }, [generateWaveform]);

  return {
    waveformData,
    isLoading,
    error,
    regenerate
  };
}