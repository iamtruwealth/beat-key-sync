import { parseBlob } from 'music-metadata-browser';
import * as Tonal from 'tonal';

/**
 * Converts a File object to AudioBuffer using Web Audio API
 */
async function fileToAudioBuffer(file: File): Promise<AudioBuffer> {
  const arrayBuffer = await file.arrayBuffer();
  const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  return await audioCtx.decodeAudioData(arrayBuffer);
}

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

// Detect key using custom chroma extraction and Tonal
export const detectKey = async (audioBuffer: AudioBuffer): Promise<{ key: string; confidence: number }> => {
  try {
    const audioData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;

    // Use custom chroma extraction over multiple segments and average
    const segments = 3;
    const segmentLength = Math.floor(audioData.length / segments);
    const chromaAccum = new Array(12).fill(0);
    let validSegments = 0;

    for (let s = 0; s < segments; s++) {
      const start = s * segmentLength;
      const end = s === segments - 1 ? audioData.length : start + segmentLength;
      const segment = audioData.subarray(start, end);
      const chroma = extractChromaFromSegment(segment, sampleRate);
      if (chroma) {
        for (let i = 0; i < 12; i++) chromaAccum[i] += chroma[i];
        validSegments++;
      }
    }

    if (validSegments === 0) return { key: 'Unknown', confidence: 0 };

    for (let i = 0; i < 12; i++) chromaAccum[i] /= validSegments;

    const keyResult = analyzeChromaForKey(chromaAccum);
    return keyResult;
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

// API-based audio analysis using Spotify Web API (via Edge Function)
const analyzeAudioWithAPI = async (file: File): Promise<{ bpm: number; key: string; confidence: number }> => {
  try {
    // For now, return basic analysis - we'll implement Spotify API integration next
    console.log('API analysis would go here for:', file.name);
    return { bpm: 0, key: 'Unknown', confidence: 0 };
  } catch (error) {
    console.warn('API analysis failed:', error);
    return { bpm: 0, key: 'Unknown', confidence: 0 };
  }
};

// BPM detection using simple onset detection
export const detectBPM = async (audioBuffer: AudioBuffer): Promise<{ bpm: number; confidence: number }> => {
  try {
    const audioData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Detect onsets using simple energy-based method
    const onsets = detectOnsets(audioData, sampleRate);
    
    if (onsets.length < 4) {
      return { bpm: 120, confidence: 0.3 }; // Default BPM
    }
    
    // Calculate intervals between onsets
    const intervals: number[] = [];
    for (let i = 1; i < onsets.length; i++) {
      intervals.push(onsets[i] - onsets[i - 1]);
    }
    
    // Find most common interval (representing beat duration)
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];
    
    if (medianInterval > 0.25 && medianInterval < 1.5) { // Reasonable beat intervals
      const bpm = Math.round(60 / medianInterval);
      if (bpm >= 60 && bpm <= 200) {
        return { bpm, confidence: 0.7 };
      }
    }
    
    return { bpm: 120, confidence: 0.3 }; // Fallback
  } catch (error) {
    console.warn('BPM detection failed:', error);
    return { bpm: 120, confidence: 0.3 };
  }
};


// Simple onset detection based on energy changes
const detectOnsets = (audioData: Float32Array, sampleRate: number): number[] => {
  const frameSize = 1024;
  const hopSize = 512;
  const frames = Math.floor((audioData.length - frameSize) / hopSize);
  
  const energies: number[] = [];
  const onsets: number[] = [];
  
  // Calculate energy for each frame
  for (let i = 0; i < frames; i++) {
    const start = i * hopSize;
    let energy = 0;
    
    for (let j = start; j < start + frameSize; j++) {
      energy += audioData[j] * audioData[j];
    }
    
    energies.push(energy);
  }
  
  // Find peaks in energy (potential onsets)
  for (let i = 1; i < energies.length - 1; i++) {
    const current = energies[i];
    const prev = energies[i - 1];
    const next = energies[i + 1];
    
    // Simple peak detection with threshold
    if (current > prev && current > next && current > 0.01) {
      const timeInSeconds = (i * hopSize) / sampleRate;
      onsets.push(timeInSeconds);
    }
  }
  
  return onsets;
};


/**
 * Extracts BPM and key information from filename patterns
 */
export function parseFilenameForMetadata(filename: string): { bpm?: number; key?: string; confidence: number } {
  const cleanName = filename.toLowerCase().replace(/\.[^/.]+$/, ""); // Remove extension
  
  let bpm: number | undefined;
  let key: string | undefined;
  let confidence = 0;

  // BPM patterns: 120bpm, 120_bpm, bpm120, 120-bpm, etc.
  const bpmPatterns = [
    /(\d{2,3})bpm/i,
    /(\d{2,3})[_-]?bpm/i,
    /bpm[_-]?(\d{2,3})/i,
    /(\d{2,3})[_-]beats?/i,
    /[_-](\d{2,3})[_-]/,
    /^(\d{2,3})[_-]/,  // Start of filename
    /[_-](\d{2,3})$/,  // End of filename
    /\s(\d{2,3})\s/,   // Surrounded by spaces
  ];

  for (const pattern of bpmPatterns) {
    const match = cleanName.match(pattern);
    if (match) {
      const parsedBpm = parseInt(match[1]);
      if (parsedBpm >= 60 && parsedBpm <= 200) {
        bpm = parsedBpm;
        confidence += 0.5;
        break;
      }
    }
  }

  // Key patterns: Cmaj, C_major, Cmin, C_minor, C#m, Dbm, etc.
  const keyPatterns = [
    // Major keys
    /([a-g][#b]?)maj(or)?/i,
    /([a-g][#b]?)[_-]?maj(or)?/i,
    /([a-g][#b]?)[_-]?major/i,
    // Minor keys  
    /([a-g][#b]?)min(or)?/i,
    /([a-g][#b]?)[_-]?min(or)?/i,
    /([a-g][#b]?)[_-]?minor/i,
    /([a-g][#b]?)m[_-]/i,
    /[_-]([a-g][#b]?)m$/i,
    /^([a-g][#b]?)m[_-]/i,     // Start of filename
    /[_-]([a-g][#b]?)m$/i,     // End of filename
    // Simple patterns like C, Cm, F#, Bbm
    /[_-]([a-g][#b]?)([m]?)[_-]/i,
    /^([a-g][#b]?)([m]?)[_-]/i,  // Start of filename
    /[_-]([a-g][#b]?)([m]?)$/i,  // End of filename
  ];

  for (const pattern of keyPatterns) {
    const match = cleanName.match(pattern);
    if (match) {
      const note = match[1].toUpperCase();
      const modifier = match[2] || '';
      
      // Normalize note name
      let normalizedNote = note.replace('B', '#').replace('S', '#');
      if (normalizedNote.includes('#')) {
        normalizedNote = normalizedNote.charAt(0) + '#';
      }
      
      // Determine if major or minor
      const isMinor = modifier.toLowerCase().includes('m') || 
                     pattern.source.includes('min') ||
                     cleanName.includes('minor');
      
      key = `${normalizedNote}${isMinor ? ' Minor' : ' Major'}`;
      confidence += 0.5;
      break;
    }
  }

  return { bpm, key, confidence: Math.min(confidence, 1.0) };
}

/**
 * Combines filename parsing with audio analysis for more accurate results
 */
function combineAnalysisResults(
  audioResult: { bpm: number; key: string; confidence: number },
  filenameResult: { bpm?: number; key?: string; confidence: number }
): { bpm: number; key: string; confidence: number } {
  
  // BPM combination logic
  let finalBpm = audioResult.bpm;
  let bpmConfidence = audioResult.confidence;
  
  if (filenameResult.bpm && filenameResult.confidence > 0.3) {
    if (audioResult.confidence < 0.5) {
      // Trust filename more when audio analysis is uncertain
      finalBpm = filenameResult.bpm;
      bpmConfidence = filenameResult.confidence;
    } else if (Math.abs(audioResult.bpm - filenameResult.bpm) <= 5) {
      // Values are close, increase confidence
      bpmConfidence = Math.min(1.0, audioResult.confidence + 0.2);
    } else if (Math.abs(audioResult.bpm - filenameResult.bpm) > 20) {
      // Values are very different, reduce confidence and favor filename if it seems more reasonable
      const avgBpm = (audioResult.bpm + filenameResult.bpm) / 2;
      if (filenameResult.bpm >= 60 && filenameResult.bpm <= 200) {
        finalBpm = filenameResult.bpm;
        bpmConfidence = 0.6;
      } else {
        bpmConfidence = Math.max(0.3, audioResult.confidence - 0.2);
      }
    }
  }

  // Key combination logic
  let finalKey = audioResult.key;
  let keyConfidence = audioResult.confidence;
  
  if (filenameResult.key && filenameResult.confidence > 0.3) {
    if (audioResult.key === 'Unknown' || audioResult.confidence < 0.4) {
      // Use filename key when audio analysis failed or is uncertain
      finalKey = filenameResult.key;
      keyConfidence = filenameResult.confidence;
    } else if (audioResult.key === filenameResult.key) {
      // Exact match, boost confidence
      keyConfidence = Math.min(1.0, audioResult.confidence + 0.3);
    } else {
      // Different keys, check if they're compatible
      const compatibleKeys = getCompatibleKeys(audioResult.key);
      if (compatibleKeys.includes(filenameResult.key)) {
        // Keys are compatible, moderate confidence boost
        keyConfidence = Math.min(1.0, audioResult.confidence + 0.1);
      } else {
        // Keys conflict, reduce confidence
        keyConfidence = Math.max(0.2, audioResult.confidence - 0.2);
      }
    }
  }

  return {
    bpm: finalBpm,
    key: finalKey,
    confidence: (bpmConfidence + keyConfidence) / 2
  };
}

/**
 * Extracts metadata, BPM, key, and duration from an uploaded audio file
 */
export async function analyzeAudioFile(file: File): Promise<AudioAnalysisResult> {
  try {
    // 1. Metadata extraction using music-metadata-browser
    const metadata = await parseBlob(file);
    const duration = metadata.format.duration || 0;
    const sampleRate = metadata.format.sampleRate;
    const bitrate = metadata.format.bitrate;
    const tags = metadata.common;
    const albumArt = metadata.common.picture?.[0]?.data;

    // 2. Convert file to audio buffer
    const audioBuffer = await fileToAudioBuffer(file);

    // 3. Parse filename for BPM and key information
    const filenameResult = parseFilenameForMetadata(file.name);

    // 4. BPM detection from audio analysis
    const bpmResult = await detectBPM(audioBuffer);

    // 5. Key detection from audio analysis
    const keyResult = await detectKey(audioBuffer);

    // 6. Combine filename parsing with audio analysis for better accuracy
    const combinedResult = combineAnalysisResults(
      { 
        bpm: bpmResult.bpm, 
        key: keyResult.key, 
        confidence: (bpmResult.confidence + keyResult.confidence) / 2 
      },
      filenameResult
    );

    // 7. Get compatible keys for harmonic mixing
    const compatibleKeys = getCompatibleKeys(combinedResult.key);

    // 8. Calculate overall confidence score
    const confidenceScore = combinedResult.confidence;

    // 9. Build result object with combined analysis
    const audioData: AudioAnalysisResult = {
      bpm: combinedResult.bpm,
      key: combinedResult.key,
      compatibleKeys,
      duration: duration,
      confidenceScore,
      metadata: {
        format: metadata.format.container,
        sampleRate: sampleRate,
        bitrate: bitrate,
        tags: tags,
        albumArt: albumArt,
        filenameAnalysis: filenameResult,
        audioAnalysis: {
          bpm: bpmResult.bpm,
          key: keyResult.key,
          confidence: (bpmResult.confidence + keyResult.confidence) / 2
        }
      }
    };

    return audioData;
  } catch (error) {
    console.error('Audio analysis failed:', error);
    return {
      bpm: 0,
      key: 'Unknown',
      compatibleKeys: [],
      duration: 0,
      confidenceScore: 0,
      metadata: {}
    };
  }
}

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
    tags?: any;
    albumArt?: Uint8Array;
    filenameAnalysis?: {
      bpm?: number;
      key?: string;
      confidence: number;
    };
    audioAnalysis?: {
      bpm: number;
      key: string;
      confidence: number;
    };
  };
}