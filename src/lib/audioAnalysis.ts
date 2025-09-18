import * as Tonal from 'tonal';

// Key compatibility system based on Circle of Fifths and Camelot wheel
export const getCompatibleKeys = (key: string): string[] => {
  if (!key || key === 'Unknown') return [];

  // Parse the key using Tonal
  const parsedKey = Tonal.Key.majorKey(key) || Tonal.Key.minorKey(key);
  if (!parsedKey.tonic) return [];

  const tonic = parsedKey.tonic;
  const isMinor = key.toLowerCase().includes('minor') || key.toLowerCase().includes('m');
  
  // Circle of Fifths compatibility
  const compatibleKeys: string[] = [];
  
  if (isMinor) {
    // For minor keys, compatible keys are:
    // - Relative major (3 semitones up)
    // - Perfect fifth up and down
    // - Relative major of perfect fifth up/down
    const relativeMajor = Tonal.Note.transpose(tonic, '3m'); // Relative major
    const fifthUp = Tonal.Note.transpose(tonic, '5P'); // Perfect fifth up
    const fifthDown = Tonal.Note.transpose(tonic, '-5P'); // Perfect fifth down
    
    compatibleKeys.push(
      `${relativeMajor} Major`,
      `${fifthUp} Minor`,
      `${fifthDown} Minor`,
      `${Tonal.Note.transpose(fifthUp, '3m')} Major`, // Relative major of fifth up
      `${Tonal.Note.transpose(fifthDown, '3m')} Major` // Relative major of fifth down
    );
  } else {
    // For major keys, compatible keys are:
    // - Relative minor (3 semitones down) 
    // - Perfect fifth up and down
    // - Relative minor of perfect fifth up/down
    const relativeMinor = Tonal.Note.transpose(tonic, '-3m'); // Relative minor
    const fifthUp = Tonal.Note.transpose(tonic, '5P'); // Perfect fifth up
    const fifthDown = Tonal.Note.transpose(tonic, '-5P'); // Perfect fifth down
    
    compatibleKeys.push(
      `${relativeMinor} Minor`,
      `${fifthUp} Major`,
      `${fifthDown} Major`,
      `${Tonal.Note.transpose(fifthUp, '-3m')} Minor`, // Relative minor of fifth up
      `${Tonal.Note.transpose(fifthDown, '-3m')} Minor` // Relative minor of fifth down
    );
  }

  // Remove duplicates and filter out invalid keys
  return [...new Set(compatibleKeys)].filter(k => k !== key);
};

// Detect key using Meyda and Tonal
export const detectKey = async (audioBuffer: AudioBuffer): Promise<{ key: string; confidence: number }> => {
  try {
    const audioData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Analyze multiple segments for better accuracy
    const segmentSize = Math.floor(audioData.length / 5); // 5 segments
    const results: { key: string; confidence: number }[] = [];
    
    for (let i = 0; i < 5; i++) {
      const start = i * segmentSize;
      const end = Math.min(start + segmentSize, audioData.length);
      const segment = audioData.slice(start, end);
      
      if (segment.length < 1024) continue; // Skip segments that are too small
      
      // Extract chroma features using basic FFT analysis
      const chroma = extractChromaFromSegment(segment, sampleRate);
      
      if (chroma) {
        const keyResult = analyzeChromaForKey(chroma);
        if (keyResult.key !== 'Unknown') {
          results.push(keyResult);
        }
      }
    }
    
    if (results.length === 0) {
      return { key: 'Unknown', confidence: 0 };
    }
    
    // Find most common key and average confidence
    const keyCount: { [key: string]: number[] } = {};
    results.forEach(result => {
      if (!keyCount[result.key]) keyCount[result.key] = [];
      keyCount[result.key].push(result.confidence);
    });
    
    let bestKey = 'Unknown';
    let bestConfidence = 0;
    let maxCount = 0;
    
    Object.entries(keyCount).forEach(([key, confidences]) => {
      if (confidences.length > maxCount) {
        maxCount = confidences.length;
        bestKey = key;
        bestConfidence = confidences.reduce((a, b) => a + b) / confidences.length;
      }
    });
    
    return { key: bestKey, confidence: bestConfidence };
    
  } catch (error) {
    console.warn('Key detection failed:', error);
    return { key: 'Unknown', confidence: 0 };
  }
};

// Extract chroma features from audio segment
const extractChromaFromSegment = (audioData: Float32Array, sampleRate: number): number[] | null => {
  try {
    const frameSize = 2048;
    const hopSize = 1024;
    const frames = Math.floor((audioData.length - frameSize) / hopSize);
    
    if (frames < 1) return null;
    
    const chroma = new Array(12).fill(0);
    let frameCount = 0;
    
    for (let i = 0; i < frames; i++) {
      const start = i * hopSize;
      const frame = audioData.slice(start, start + frameSize);
      
      // Apply window function (Hann window)
      const windowed = new Float32Array(frameSize);
      for (let j = 0; j < frameSize; j++) {
        windowed[j] = frame[j] * (0.5 - 0.5 * Math.cos(2 * Math.PI * j / (frameSize - 1)));
      }
      
      // Compute magnitude spectrum using FFT approximation
      const spectrum = new Float32Array(frameSize / 2);
      for (let k = 0; k < spectrum.length; k++) {
        let real = 0;
        let imag = 0;
        for (let n = 0; n < frameSize; n++) {
          const angle = -2 * Math.PI * k * n / frameSize;
          real += windowed[n] * Math.cos(angle);
          imag += windowed[n] * Math.sin(angle);
        }
        spectrum[k] = Math.sqrt(real * real + imag * imag);
      }
      
      // Map spectrum bins to chroma
      for (let k = 1; k < spectrum.length; k++) {
        const freq = k * sampleRate / frameSize;
        if (freq < 80 || freq > 2000) continue; // Focus on musical range
        
        // Convert frequency to MIDI note
        const midiNote = 12 * Math.log2(freq / 440) + 69;
        const chromaClass = Math.round(midiNote) % 12;
        
        if (chromaClass >= 0 && chromaClass < 12) {
          chroma[chromaClass] += spectrum[k];
        }
      }
      
      frameCount++;
    }
    
    // Normalize chroma
    if (frameCount > 0) {
      for (let i = 0; i < 12; i++) {
        chroma[i] /= frameCount;
      }
    }
    
    return chroma;
    
  } catch (error) {
    console.warn('Chroma extraction failed:', error);
    return null;
  }
};

// Analyze chroma vector to determine key
const analyzeChromaForKey = (chroma: number[]): { key: string; confidence: number } => {
  const chromaNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
  
  // Major and minor key profiles (Krumhansl-Schmuckler)
  const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
  const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
  
  let bestKey = 'Unknown';
  let bestScore = -Infinity;
  
  // Test all 24 keys (12 major + 12 minor)
  for (let tonic = 0; tonic < 12; tonic++) {
    // Test major
    const majorScore = correlate(chroma, rotateArray(majorProfile, tonic));
    if (majorScore > bestScore) {
      bestScore = majorScore;
      bestKey = `${chromaNames[tonic]} Major`;
    }
    
    // Test minor
    const minorScore = correlate(chroma, rotateArray(minorProfile, tonic));
    if (minorScore > bestScore) {
      bestScore = minorScore;
      bestKey = `${chromaNames[tonic]} Minor`;
    }
  }
  
  // Normalize confidence to 0-1 range
  const confidence = Math.max(0, Math.min(1, (bestScore + 1) / 2));
  
  return { key: bestKey, confidence };
};

// Correlation function for key detection
const correlate = (x: number[], y: number[]): number => {
  let sum = 0;
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;
  
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    sum++;
    sumX += x[i];
    sumY += y[i];
    sumXY += x[i] * y[i];
    sumXX += x[i] * x[i];
    sumYY += y[i] * y[i];
  }
  
  const numerator = sum * sumXY - sumX * sumY;
  const denominator = Math.sqrt((sum * sumXX - sumX * sumX) * (sum * sumYY - sumY * sumY));
  
  return denominator === 0 ? 0 : numerator / denominator;
};

// Rotate array for key transposition
const rotateArray = (arr: number[], steps: number): number[] => {
  const result = [...arr];
  for (let i = 0; i < steps; i++) {
    const first = result.shift();
    if (first !== undefined) result.push(first);
  }
  return result;
};

// BPM detection using multiple methods
export const detectBPM = async (audioBuffer: AudioBuffer): Promise<{ bpm: number; confidence: number }> => {
  try {
    const audioData = audioBuffer.getChannelData(0);
    
    // Analyze multiple segments
    const segmentSize = Math.floor(audioData.length / 3); // 3 segments
    const results: number[] = [];
    
    for (let i = 0; i < 3; i++) {
      const start = i * segmentSize;
      const end = Math.min(start + segmentSize, audioData.length);
      const segment = audioData.slice(start, end);
      
      if (segment.length < audioBuffer.sampleRate * 10) continue; // Skip segments < 10 seconds
      
      const bpm = await detectSegmentBPM(segment, audioBuffer.sampleRate);
      if (bpm > 60 && bpm < 200) {
        results.push(bpm);
      }
    }
    
    if (results.length === 0) {
      return { bpm: 0, confidence: 0 };
    }
    
    // Find most common BPM (within tolerance)
    const bpmCounts: { [key: number]: number } = {};
    const tolerance = 2; // BPM tolerance
    
    results.forEach(bpm => {
      const rounded = Math.round(bpm);
      let found = false;
      
      // Check if this BPM is close to an existing one
      Object.keys(bpmCounts).forEach(existing => {
        const existingBpm = parseInt(existing);
        if (Math.abs(existingBpm - rounded) <= tolerance) {
          bpmCounts[existingBpm]++;
          found = true;
        }
      });
      
      if (!found) {
        bpmCounts[rounded] = 1;
      }
    });
    
    // Find most frequent BPM
    let bestBpm = 0;
    let maxCount = 0;
    
    Object.entries(bpmCounts).forEach(([bpm, count]) => {
      if (count > maxCount) {
        maxCount = count;
        bestBpm = parseInt(bpm);
      }
    });
    
    const confidence = maxCount / results.length;
    
    return { bpm: bestBpm, confidence };
    
  } catch (error) {
    console.warn('BPM detection failed:', error);
    return { bpm: 0, confidence: 0 };
  }
};

// Simple BPM detection for a segment using onset detection
const detectSegmentBPM = async (audioData: Float32Array, sampleRate: number): Promise<number> => {
  // Simple onset detection using spectral flux
  const frameSize = 1024;
  const hopSize = 512;
  const frames = Math.floor((audioData.length - frameSize) / hopSize);
  
  const onsets: number[] = [];
  let prevSpectrum: Float32Array | null = null;
  
  for (let i = 0; i < frames; i++) {
    const start = i * hopSize;
    const frame = audioData.slice(start, start + frameSize);
    
    // Simple FFT approximation using DFT
    const spectrum = new Float32Array(frameSize / 2);
    for (let k = 0; k < spectrum.length; k++) {
      let real = 0;
      let imag = 0;
      for (let n = 0; n < frameSize; n++) {
        const angle = -2 * Math.PI * k * n / frameSize;
        real += frame[n] * Math.cos(angle);
        imag += frame[n] * Math.sin(angle);
      }
      spectrum[k] = Math.sqrt(real * real + imag * imag);
    }
    
    if (prevSpectrum) {
      // Compute spectral flux
      let flux = 0;
      for (let k = 0; k < spectrum.length; k++) {
        const diff = spectrum[k] - prevSpectrum[k];
        flux += diff > 0 ? diff : 0;
      }
      
      // Simple peak picking
      if (flux > 0.1) { // Threshold
        onsets.push(i * hopSize / sampleRate);
      }
    }
    
    prevSpectrum = spectrum;
  }
  
  if (onsets.length < 4) return 0;
  
  // Estimate BPM from onset intervals
  const intervals: number[] = [];
  for (let i = 1; i < onsets.length; i++) {
    intervals.push(onsets[i] - onsets[i - 1]);
  }
  
  // Find most common interval (within tolerance)
  intervals.sort((a, b) => a - b);
  const medianInterval = intervals[Math.floor(intervals.length / 2)];
  
  if (medianInterval > 0) {
    const bpm = 60 / medianInterval;
    return bpm;
  }
  
  return 0;
};

export interface AudioAnalysisResult {
  bpm: number;
  key: string;
  compatibleKeys: string[];
  duration: number;
  confidenceScore: number;
  metadata: {
    format?: string;
    sampleRate?: number;
    bitrate?: number;
  };
}