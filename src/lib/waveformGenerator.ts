/**
 * Waveform generation utilities for audio visualization
 */

export interface WaveformData {
  peaks: number[];
  duration: number;
  sampleRate: number;
  channels: number;
}

/**
 * Generate waveform data from an audio file URL
 */
export async function generateWaveformFromUrl(audioUrl: string, targetWidth: number = 1000): Promise<WaveformData> {
  try {
    // Fetch the audio file
    const response = await fetch(audioUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch audio: ${response.status}`);
    }
    
    const arrayBuffer = await response.arrayBuffer();
    return generateWaveformFromBuffer(arrayBuffer, targetWidth);
  } catch (error) {
    console.error('Error generating waveform from URL:', error);
    throw error;
  }
}

/**
 * Generate waveform data from an audio buffer
 */
export async function generateWaveformFromBuffer(arrayBuffer: ArrayBuffer, targetWidth: number = 1000): Promise<WaveformData> {
  const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  try {
    // Decode the audio data
    const audioBuffer = await audioContext.decodeAudioData(arrayBuffer);
    
    const channelData = audioBuffer.getChannelData(0); // Use first channel
    const duration = audioBuffer.duration;
    const sampleRate = audioBuffer.sampleRate;
    const channels = audioBuffer.numberOfChannels;
    
    // Calculate how many samples per pixel
    const samplesPerPixel = Math.floor(channelData.length / targetWidth);
    const peaks: number[] = [];
    
    // Generate peaks for visualization
    for (let i = 0; i < targetWidth; i++) {
      const start = i * samplesPerPixel;
      const end = Math.min(start + samplesPerPixel, channelData.length);
      
      let max = 0;
      let min = 0;
      
      // Find the peak values in this sample range
      for (let j = start; j < end; j++) {
        const sample = channelData[j];
        if (sample > max) max = sample;
        if (sample < min) min = sample;
      }
      
      // Store the absolute maximum for this pixel
      peaks.push(Math.max(Math.abs(max), Math.abs(min)));
    }
    
    return {
      peaks,
      duration,
      sampleRate,
      channels
    };
  } finally {
    // Clean up audio context
    await audioContext.close();
  }
}

/**
 * Generate waveform SVG path from peaks data
 */
export function generateWaveformPath(peaks: number[], width: number, height: number): string {
  if (peaks.length === 0) return '';
  
  const pixelWidth = width / peaks.length;
  const centerY = height / 2;
  const maxHeight = height * 0.8; // Leave some padding
  
  let path = `M 0 ${centerY}`;
  
  peaks.forEach((peak, index) => {
    const x = index * pixelWidth;
    const peakHeight = (peak * maxHeight) / 2;
    
    // Draw line to peak and back to center
    path += ` L ${x} ${centerY - peakHeight}`;
    path += ` L ${x} ${centerY + peakHeight}`;
    path += ` L ${x} ${centerY}`;
  });
  
  return path;
}

/**
 * Generate simplified waveform bars for canvas rendering
 */
export function generateWaveformBars(peaks: number[], targetBars: number = 100): number[] {
  if (peaks.length <= targetBars) return peaks;
  
  const barsPerPeak = peaks.length / targetBars;
  const bars: number[] = [];
  
  for (let i = 0; i < targetBars; i++) {
    const start = Math.floor(i * barsPerPeak);
    const end = Math.floor((i + 1) * barsPerPeak);
    
    let maxPeak = 0;
    for (let j = start; j < end && j < peaks.length; j++) {
      maxPeak = Math.max(maxPeak, peaks[j]);
    }
    
    bars.push(maxPeak);
  }
  
  return bars;
}

/**
 * Cache for storing generated waveform data
 */
class WaveformCache {
  private cache = new Map<string, WaveformData>();
  private maxSize = 50; // Maximum number of cached waveforms
  
  get(url: string): WaveformData | undefined {
    return this.cache.get(url);
  }
  
  set(url: string, data: WaveformData): void {
    // Simple LRU: if cache is full, remove oldest entry
    if (this.cache.size >= this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      this.cache.delete(firstKey);
    }
    
    this.cache.set(url, data);
  }
  
  clear(): void {
    this.cache.clear();
  }
}

export const waveformCache = new WaveformCache();