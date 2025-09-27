// Advanced Audio Analysis Worker - Professional BPM and Key Detection
// Based on proven algorithms from web-audio-beat-detector and music analysis research

class AdvancedAudioAnalyzer {
  constructor() {
    this.sampleRate = 44100;
    this.windowSize = 1024;
    this.hopSize = 512;
  }

  // Comprehensive filename parsing with music theory awareness
  parseFilename(filename) {
    const clean = filename.toLowerCase().replace(/\.[^/.]+$/, '');
    let bpm, key, confidence = 0;

    // Enhanced BPM patterns with context awareness
    const bpmPatterns = [
      /(?:^|[^a-z])(\d{2,3})bpm(?![a-z])/i,
      /(?:^|[^a-z])(\d{2,3})[_\s-]*bpm(?![a-z])/i,
      /bpm[_\s-]*(\d{2,3})(?![a-z])/i,
      /(?:^|[^a-z])(\d{2,3})[_\s-]*(?:beats?|tempo)(?![a-z])/i,
      /(?:^|[_\s-])(\d{2,3})(?=[_\s-])/,
      /^(\d{2,3})[_\s-]/,
      /[_\s-](\d{2,3})$/,
      /\s(\d{2,3})\s/
    ];

    for (const pattern of bpmPatterns) {
      const match = clean.match(pattern);
      if (match) {
        const parsed = parseInt(match[1]);
        if (parsed >= 60 && parsed <= 200) {
          bpm = parsed;
          confidence += 0.6;
          break;
        }
      }
    }

    // Enhanced key patterns with better music theory support
    const keyPatterns = [
      // Explicit major/minor patterns
      /(?:^|[^a-z])([a-g][#b♭♯]?)(?:\s*[-_]?\s*)?maj(?:or)?(?![a-z])/i,
      /(?:^|[^a-z])([a-g][#b♭♯]?)(?:\s*[-_]?\s*)?min(?:or)?(?![a-z])/i,
      /(?:^|[^a-z])([a-g][#b♭♯]?)(?:\s*[-_]?\s*)?major(?![a-z])/i,
      /(?:^|[^a-z])([a-g][#b♭♯]?)(?:\s*[-_]?\s*)?minor(?![a-z])/i,
      // m suffix patterns
      /(?:^|[^a-z])([a-g][#b♭♯]?)m(?![a-z])/i,
      // Key signature patterns
      /(?:^|[_\s-])([a-g][#b♭♯]?)(?=[_\s-])/i,
      /^([a-g][#b♭♯]?)[_\s-]/i,
      /[_\s-]([a-g][#b♭♯]?)$/i
    ];

    for (const pattern of keyPatterns) {
      const match = clean.match(pattern);
      if (match) {
        let note = match[1].toUpperCase();
        
        // Normalize accidentals
        note = note.replace(/[B♭]/gi, 'b').replace(/[♯#]/g, '#');
        if (note.includes('B') && !note.includes('b')) {
          note = note.replace('B', 'b');
        }
        
        const isMinor = pattern.source.includes('min') || 
                       pattern.source.includes('m(?![a-z])') ||
                       clean.includes('minor') ||
                       (clean.includes(match[1].toLowerCase() + 'm') && !clean.includes('major'));
        
        key = `${note}${isMinor ? ' Minor' : ' Major'}`;
        confidence += 0.6;
        break;
      }
    }

    return { bpm, key, confidence: Math.min(confidence, 1.0) };
  }

  // Professional BPM detection using multiple methods
  async detectBPM(audioBuffer) {
    const audioData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Method 1: Spectral onset detection with autocorrelation
    const onsetBPM = await this.detectBPMFromOnsets(audioData, sampleRate);
    
    // Method 2: Beat tracking using energy-based analysis
    const energyBPM = await this.detectBPMFromEnergy(audioData, sampleRate);
    
    // Method 3: Harmonic analysis for complex rhythms
    const harmonicBPM = await this.detectBPMFromHarmonics(audioData, sampleRate);
    
    // Combine results with weighted confidence
    const results = [onsetBPM, energyBPM, harmonicBPM].filter(r => r.confidence > 0.3);
    
    if (results.length === 0) {
      return { bpm: 120, confidence: 0.2 };
    }
    
    // Weighted average based on confidence
    let totalWeight = 0;
    let weightedBPM = 0;
    
    results.forEach(result => {
      const weight = result.confidence;
      weightedBPM += result.bpm * weight;
      totalWeight += weight;
    });
    
    const finalBPM = Math.round(weightedBPM / totalWeight);
    const finalConfidence = Math.min(0.95, totalWeight / results.length);
    
    return { bpm: finalBPM, confidence: finalConfidence };
  }

  // Onset-based BPM detection
  async detectBPMFromOnsets(audioData, sampleRate) {
    const frameSize = 1024;
    const hopSize = 512;
    const frames = Math.floor((audioData.length - frameSize) / hopSize);
    
    // Calculate spectral flux for onset detection
    const spectralFlux = [];
    let prevMagnitudes = new Float32Array(frameSize / 2);
    
    for (let i = 0; i < frames; i++) {
      const start = i * hopSize;
      const frame = audioData.subarray(start, start + frameSize);
      
      // Apply Hann window
      const windowed = new Float32Array(frameSize);
      for (let j = 0; j < frameSize; j++) {
        windowed[j] = frame[j] * (0.5 - 0.5 * Math.cos(2 * Math.PI * j / (frameSize - 1)));
      }
      
      // Compute magnitude spectrum
      const magnitudes = new Float32Array(frameSize / 2);
      for (let k = 0; k < frameSize / 2; k++) {
        let real = 0, imag = 0;
        for (let n = 0; n < frameSize; n++) {
          const angle = -2 * Math.PI * k * n / frameSize;
          real += windowed[n] * Math.cos(angle);
          imag += windowed[n] * Math.sin(angle);
        }
        magnitudes[k] = Math.sqrt(real * real + imag * imag);
      }
      
      // Calculate spectral flux
      if (i > 0) {
        let flux = 0;
        for (let k = 0; k < frameSize / 2; k++) {
          const diff = magnitudes[k] - prevMagnitudes[k];
          if (diff > 0) flux += diff;
        }
        spectralFlux.push(flux);
      }
      
      prevMagnitudes = magnitudes;
    }
    
    // Peak picking for onsets
    const onsets = [];
    const threshold = spectralFlux.reduce((a, b) => a + b, 0) / spectralFlux.length * 1.5;
    
    for (let i = 1; i < spectralFlux.length - 1; i++) {
      if (spectralFlux[i] > spectralFlux[i-1] && 
          spectralFlux[i] > spectralFlux[i+1] && 
          spectralFlux[i] > threshold) {
        onsets.push((i + 1) * hopSize / sampleRate);
      }
    }
    
    if (onsets.length < 4) {
      return { bpm: 120, confidence: 0.1 };
    }
    
    // Analyze inter-onset intervals
    const intervals = [];
    for (let i = 1; i < onsets.length; i++) {
      intervals.push(onsets[i] - onsets[i-1]);
    }
    
    // Find dominant interval using histogram
    const histogram = new Map();
    intervals.forEach(interval => {
      const rounded = Math.round(interval * 100) / 100;
      histogram.set(rounded, (histogram.get(rounded) || 0) + 1);
    });
    
    let maxCount = 0;
    let dominantInterval = 0.5;
    histogram.forEach((count, interval) => {
      if (count > maxCount) {
        maxCount = count;
        dominantInterval = interval;
      }
    });
    
    const bpm = Math.round(60 / dominantInterval);
    const confidence = Math.min(0.9, maxCount / intervals.length);
    
    if (bpm >= 60 && bpm <= 200) {
      return { bpm, confidence };
    }
    
    return { bpm: 120, confidence: 0.2 };
  }

  // Energy-based BPM detection
  async detectBPMFromEnergy(audioData, sampleRate) {
    const frameSize = 1024;
    const hopSize = 256;
    const frames = Math.floor((audioData.length - frameSize) / hopSize);
    
    // Calculate RMS energy per frame
    const energies = [];
    for (let i = 0; i < frames; i++) {
      const start = i * hopSize;
      let energy = 0;
      for (let j = start; j < start + frameSize && j < audioData.length; j++) {
        energy += audioData[j] * audioData[j];
      }
      energies.push(Math.sqrt(energy / frameSize));
    }
    
    // Apply low-pass filter to smooth energy
    const smoothed = [];
    const alpha = 0.3;
    smoothed[0] = energies[0];
    for (let i = 1; i < energies.length; i++) {
      smoothed[i] = alpha * energies[i] + (1 - alpha) * smoothed[i-1];
    }
    
    // Autocorrelation of energy signal
    const maxLag = Math.floor(sampleRate * 2 / hopSize); // 2 seconds max
    const minLag = Math.floor(sampleRate * 0.3 / hopSize); // 0.3 seconds min
    
    let bestLag = 0;
    let bestCorr = -1;
    
    for (let lag = minLag; lag < maxLag && lag < smoothed.length / 2; lag++) {
      let correlation = 0;
      let count = 0;
      
      for (let i = 0; i < smoothed.length - lag; i++) {
        correlation += smoothed[i] * smoothed[i + lag];
        count++;
      }
      
      correlation /= count;
      
      if (correlation > bestCorr) {
        bestCorr = correlation;
        bestLag = lag;
      }
    }
    
    const periodInSeconds = bestLag * hopSize / sampleRate;
    const bpm = Math.round(60 / periodInSeconds);
    const confidence = Math.min(0.8, bestCorr);
    
    if (bpm >= 60 && bpm <= 200 && confidence > 0.3) {
      return { bpm, confidence };
    }
    
    return { bpm: 120, confidence: 0.2 };
  }

  // Harmonic-based BPM detection for complex rhythms
  async detectBPMFromHarmonics(audioData, sampleRate) {
    // Focus on low-frequency content where kick drums typically reside
    const lowPassCutoff = 200; // Hz
    const filtered = this.lowPassFilter(audioData, sampleRate, lowPassCutoff);
    
    // Envelope following
    const envelope = this.getEnvelope(filtered, sampleRate);
    
    // Autocorrelation of envelope
    const period = this.findPeriod(envelope, sampleRate);
    
    if (period > 0.3 && period < 2.0) {
      const bpm = Math.round(60 / period);
      const confidence = 0.6;
      
      if (bpm >= 60 && bpm <= 200) {
        return { bpm, confidence };
      }
    }
    
    return { bpm: 120, confidence: 0.1 };
  }

  // Low-pass filter implementation
  lowPassFilter(audioData, sampleRate, cutoffFreq) {
    const rc = 1.0 / (cutoffFreq * 2 * Math.PI);
    const dt = 1.0 / sampleRate;
    const alpha = dt / (rc + dt);
    
    const filtered = new Float32Array(audioData.length);
    filtered[0] = audioData[0];
    
    for (let i = 1; i < audioData.length; i++) {
      filtered[i] = alpha * audioData[i] + (1 - alpha) * filtered[i-1];
    }
    
    return filtered;
  }

  // Envelope extraction
  getEnvelope(audioData, sampleRate) {
    const windowSize = Math.floor(sampleRate * 0.01); // 10ms windows
    const envelope = [];
    
    for (let i = 0; i < audioData.length; i += windowSize) {
      let max = 0;
      for (let j = i; j < Math.min(i + windowSize, audioData.length); j++) {
        max = Math.max(max, Math.abs(audioData[j]));
      }
      envelope.push(max);
    }
    
    return envelope;
  }

  // Find dominant period in signal
  findPeriod(signal, sampleRate) {
    const maxLag = signal.length / 2;
    const minLag = 10;
    
    let bestLag = 0;
    let bestCorr = -1;
    
    for (let lag = minLag; lag < maxLag; lag++) {
      let correlation = 0;
      for (let i = 0; i < signal.length - lag; i++) {
        correlation += signal[i] * signal[i + lag];
      }
      
      if (correlation > bestCorr) {
        bestCorr = correlation;
        bestLag = lag;
      }
    }
    
    return bestLag * 0.01; // Convert to seconds (10ms windows)
  }

  // Advanced key detection using chroma features and music theory
  async detectKey(audioBuffer) {
    const audioData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Extract chroma features from multiple segments
    const numSegments = 5;
    const segmentLength = Math.floor(audioData.length / numSegments);
    const chromaVectors = [];
    
    for (let seg = 0; seg < numSegments; seg++) {
      const start = seg * segmentLength;
      const end = Math.min(start + segmentLength, audioData.length);
      const segment = audioData.subarray(start, end);
      
      const chroma = await this.extractChroma(segment, sampleRate);
      if (chroma && chroma.some(v => v > 0)) {
        chromaVectors.push(chroma);
      }
    }
    
    if (chromaVectors.length === 0) {
      return { key: 'C Major', confidence: 0.1 };
    }
    
    // Average chroma across segments
    const avgChroma = new Float32Array(12);
    chromaVectors.forEach(chroma => {
      for (let i = 0; i < 12; i++) {
        avgChroma[i] += chroma[i];
      }
    });
    
    for (let i = 0; i < 12; i++) {
      avgChroma[i] /= chromaVectors.length;
    }
    
    // Normalize chroma
    const chromaSum = avgChroma.reduce((sum, val) => sum + val, 0);
    if (chromaSum > 0) {
      for (let i = 0; i < 12; i++) {
        avgChroma[i] /= chromaSum;
      }
    }
    
    // Key detection using Krumhansl-Schmuckler profiles
    const keyProfiles = this.getKeyProfiles();
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    let bestKey = 'C Major';
    let bestScore = -Infinity;
    
    for (let tonic = 0; tonic < 12; tonic++) {
      // Major key correlation
      const majorScore = this.correlateWithProfile(avgChroma, keyProfiles.major, tonic);
      if (majorScore > bestScore) {
        bestScore = majorScore;
        bestKey = `${noteNames[tonic]} Major`;
      }
      
      // Minor key correlation
      const minorScore = this.correlateWithProfile(avgChroma, keyProfiles.minor, tonic);
      if (minorScore > bestScore) {
        bestScore = minorScore;
        bestKey = `${noteNames[tonic]} Minor`;
      }
    }
    
    const confidence = Math.max(0, Math.min(1, (bestScore + 1) / 2));
    
    return { key: bestKey, confidence };
  }

  // Extract chroma features from audio segment
  async extractChroma(audioData, sampleRate) {
    const frameSize = 4096;
    const hopSize = 2048;
    const frames = Math.floor((audioData.length - frameSize) / hopSize);
    
    if (frames < 1) return null;
    
    const chroma = new Float32Array(12);
    let frameCount = 0;
    
    for (let i = 0; i < frames; i++) {
      const start = i * hopSize;
      const frame = audioData.subarray(start, start + frameSize);
      
      // Apply window
      const windowed = new Float32Array(frameSize);
      for (let j = 0; j < frameSize; j++) {
        windowed[j] = frame[j] * (0.5 - 0.5 * Math.cos(2 * Math.PI * j / (frameSize - 1)));
      }
      
      // Compute magnitude spectrum
      const spectrum = new Float32Array(frameSize / 2);
      for (let k = 0; k < frameSize / 2; k++) {
        let real = 0, imag = 0;
        for (let n = 0; n < frameSize; n++) {
          const angle = -2 * Math.PI * k * n / frameSize;
          real += windowed[n] * Math.cos(angle);
          imag += windowed[n] * Math.sin(angle);
        }
        spectrum[k] = Math.sqrt(real * real + imag * imag);
      }
      
      // Map frequencies to chroma classes
      for (let k = 1; k < frameSize / 2; k++) {
        const freq = k * sampleRate / frameSize;
        if (freq >= 80 && freq <= 5000) {
          const midi = 12 * Math.log2(freq / 440) + 69;
          const chromaClass = Math.round(midi) % 12;
          if (chromaClass >= 0 && chromaClass < 12) {
            chroma[chromaClass] += spectrum[k];
          }
        }
      }
      
      frameCount++;
    }
    
    if (frameCount > 0) {
      for (let i = 0; i < 12; i++) {
        chroma[i] /= frameCount;
      }
    }
    
    return chroma;
  }

  // Key profiles based on music theory research
  getKeyProfiles() {
    return {
      major: [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88],
      minor: [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17]
    };
  }

  // Correlate chroma with key profile
  correlateWithProfile(chroma, profile, tonic) {
    let correlation = 0;
    let chromaSum = 0, profileSum = 0;
    let chromaSumSq = 0, profileSumSq = 0;
    
    for (let i = 0; i < 12; i++) {
      const chromaVal = chroma[i];
      const profileVal = profile[(i - tonic + 12) % 12];
      
      correlation += chromaVal * profileVal;
      chromaSum += chromaVal;
      profileSum += profileVal;
      chromaSumSq += chromaVal * chromaVal;
      profileSumSq += profileVal * profileVal;
    }
    
    const numerator = correlation - (chromaSum * profileSum) / 12;
    const denominator = Math.sqrt((chromaSumSq - chromaSum * chromaSum / 12) * 
                                 (profileSumSq - profileSum * profileSum / 12));
    
    return denominator > 0 ? numerator / denominator : 0;
  }

  // Get compatible keys using music theory
  getCompatibleKeys(key) {
    if (!key || key === 'Unknown') return [];
    
    const noteMap = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 
      'F': 5, 'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 
      'A#': 10, 'Bb': 10, 'B': 11
    };
    
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const [note, mode] = key.split(' ');
    const tonic = noteMap[note];
    
    if (tonic === undefined) return [];
    
    const compatible = [];
    
    if (mode === 'Major') {
      // Relative minor, circle of fifths
      compatible.push(
        `${noteNames[(tonic + 9) % 12]} Minor`, // Relative minor
        `${noteNames[(tonic + 7) % 12]} Major`, // Perfect fifth
        `${noteNames[(tonic + 5) % 12]} Major`, // Perfect fourth
        `${noteNames[(tonic + 2) % 12]} Minor`, // ii chord
        `${noteNames[(tonic + 4) % 12]} Minor`  // iii chord
      );
    } else if (mode === 'Minor') {
      // Relative major, circle of fifths
      compatible.push(
        `${noteNames[(tonic + 3) % 12]} Major`, // Relative major
        `${noteNames[(tonic + 7) % 12]} Minor`, // Perfect fifth
        `${noteNames[(tonic + 5) % 12]} Minor`, // Perfect fourth
        `${noteNames[(tonic + 10) % 12]} Major`, // bVII chord
        `${noteNames[(tonic + 8) % 12]} Major`  // bVI chord
      );
    }
    
    return [...new Set(compatible)].filter(k => k !== key);
  }

  // Main analysis function
  async analyzeAudio(data) {
    try {
      const { pcmBuffer, sampleRate, duration, filename } = data;
      const pcm = new Float32Array(pcmBuffer);
      
      // Create audio buffer for analysis
      const audioBuffer = {
        getChannelData: (channel) => pcm,
        sampleRate: sampleRate,
        duration: duration,
        numberOfChannels: 1
      };
      
      // Filename analysis
      const filenameResult = this.parseFilename(filename || '');
      
      // Audio analysis
      const [bpmResult, keyResult] = await Promise.all([
        this.detectBPM(audioBuffer),
        this.detectKey(audioBuffer)
      ]);
      
      // Intelligent result combination
      let finalBpm = bpmResult.bpm;
      let finalBpmConf = bpmResult.confidence;
      
      if (filenameResult.bpm) {
        if (bpmResult.confidence < 0.7) {
          // Trust filename if audio confidence is low
          finalBpm = filenameResult.bpm;
          finalBpmConf = Math.max(0.8, filenameResult.confidence);
        } else if (Math.abs(bpmResult.bpm - filenameResult.bpm) <= 3) {
          // They agree - boost confidence
          finalBpmConf = Math.min(0.95, bpmResult.confidence + 0.2);
        } else if (Math.abs(bpmResult.bpm - filenameResult.bpm) <= 10) {
          // Close but not exact - moderate confidence
          finalBpmConf = Math.max(0.5, bpmResult.confidence);
        }
      }
      
      let finalKey = keyResult.key;
      let finalKeyConf = keyResult.confidence;
      
      if (filenameResult.key) {
        if (keyResult.confidence < 0.5) {
          finalKey = filenameResult.key;
          finalKeyConf = Math.max(0.7, filenameResult.confidence);
        } else if (keyResult.key === filenameResult.key) {
          finalKeyConf = Math.min(0.95, keyResult.confidence + 0.3);
        }
      }
      
      const result = {
        bpm: finalBpm,
        key: finalKey,
        compatibleKeys: this.getCompatibleKeys(finalKey),
        duration: duration || 0,
        confidenceScore: (finalBpmConf + finalKeyConf) / 2,
        metadata: {
          filenameAnalysis: filenameResult,
          audioAnalysis: {
            bpm: bpmResult.bpm,
            bpmConfidence: bpmResult.confidence,
            key: keyResult.key,
            keyConfidence: keyResult.confidence
          },
          analysisMethod: 'advanced_multi_algorithm'
        }
      };
      
      return result;
      
    } catch (error) {
      console.error('Advanced analysis failed:', error);
      
      // Fallback to filename only
      const filenameResult = this.parseFilename(data.filename || '');
      return {
        bpm: filenameResult.bpm || 120,
        key: filenameResult.key || 'C Major',
        compatibleKeys: this.getCompatibleKeys(filenameResult.key || 'C Major'),
        duration: data.duration || 0,
        confidenceScore: filenameResult.confidence || 0.1,
        metadata: {
          error: error.message,
          filenameAnalysis: filenameResult,
          analysisMethod: 'filename_fallback'
        }
      };
    }
  }
}

// Worker message handler
const analyzer = new AdvancedAudioAnalyzer();

self.onmessage = async function(e) {
  const { id, type, data } = e.data || {};
  
  if (type !== 'ANALYZE_ADVANCED') return;
  
  try {
    const result = await analyzer.analyzeAudio(data);
    self.postMessage({ id, type: 'ANALYSIS_COMPLETE', result });
  } catch (error) {
    self.postMessage({ 
      id, 
      type: 'ANALYSIS_ERROR', 
      error: error.message || 'Advanced analysis failed'
    });
  }
};