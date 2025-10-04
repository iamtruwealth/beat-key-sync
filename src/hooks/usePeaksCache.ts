import { useRef, useCallback } from 'react';

interface AudioPeaks {
  peaks: Float32Array[];
  duration: number;
  sampleRate: number;
}

class PeaksCache {
  private cache = new Map<string, AudioPeaks>();
  private pending = new Map<string, Promise<AudioPeaks>>();

  async getPeaks(url: string, samplesPerPixel: number = 100): Promise<AudioPeaks> {
    // Return cached if available
    if (this.cache.has(url)) {
      return this.cache.get(url)!;
    }

    // Return pending promise if already loading
    if (this.pending.has(url)) {
      return this.pending.get(url)!;
    }

    // Start new decode
    const promise = this.decodePeaks(url, samplesPerPixel);
    this.pending.set(url, promise);

    try {
      const peaks = await promise;
      this.cache.set(url, peaks);
      return peaks;
    } finally {
      this.pending.delete(url);
    }
  }

  private async decodePeaks(url: string, samplesPerPixel: number): Promise<AudioPeaks> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    
    const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const peaks = this.extractPeaks(audioBuffer, samplesPerPixel);
    
    return {
      peaks,
      duration: audioBuffer.duration,
      sampleRate: audioBuffer.sampleRate
    };
  }

  private extractPeaks(audioBuffer: AudioBuffer, samplesPerPixel: number): Float32Array[] {
    const numberOfChannels = audioBuffer.numberOfChannels;
    const peaks: Float32Array[] = [];
    
    for (let channel = 0; channel < numberOfChannels; channel++) {
      const channelData = audioBuffer.getChannelData(channel);
      const peaksArray = [];
      
      for (let i = 0; i < channelData.length; i += samplesPerPixel) {
        const end = Math.min(i + samplesPerPixel, channelData.length);
        let max = -1;
        
        for (let j = i; j < end; j++) {
          const value = Math.abs(channelData[j]);
          if (value > max) {
            max = value;
          }
        }
        
        peaksArray.push(max);
      }
      
      peaks.push(new Float32Array(peaksArray));
    }
    
    return peaks;
  }

  clear(url?: string) {
    if (url) {
      this.cache.delete(url);
      this.pending.delete(url);
    } else {
      this.cache.clear();
      this.pending.clear();
    }
  }
}

// Singleton instance
const peaksCache = new PeaksCache();

export function usePeaksCache() {
  const cacheRef = useRef(peaksCache);

  const getPeaks = useCallback((url: string, samplesPerPixel?: number) => {
    return cacheRef.current.getPeaks(url, samplesPerPixel);
  }, []);

  const clearCache = useCallback((url?: string) => {
    cacheRef.current.clear(url);
  }, []);

  return { getPeaks, clearCache };
}
