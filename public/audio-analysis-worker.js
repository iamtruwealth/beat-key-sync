// Audio Analysis Web Worker
// This worker handles heavy audio analysis off the main thread

// Import required libraries (using ES modules from CDN)
importScripts('https://cdn.skypack.dev/music-metadata-browser');
importScripts('https://cdn.skypack.dev/tonal');

class AudioAnalysisWorker {
  constructor() {
    this.audioContext = null;
  }

  async initializeAudioContext() {
    if (!this.audioContext) {
      this.audioContext = new (AudioContext || webkitAudioContext)();
    }
    return this.audioContext;
  }

  async fileToAudioBuffer(arrayBuffer) {
    const audioCtx = await this.initializeAudioContext();
    return await audioCtx.decodeAudioData(arrayBuffer);
  }

  parseFilenameForMetadata(filename) {
    const cleanName = filename.toLowerCase().replace(/\.[^/.]+$/, "");
    
    let bpm;
    let key;
    let confidence = 0;

    // BPM patterns
    const bpmPatterns = [
      /(\d{2,3})bpm/i,
      /(\d{2,3})[_-]?bpm/i,
      /bpm[_-]?(\d{2,3})/i,
      /(\d{2,3})[_-]beats?/i,
      /[_-](\d{2,3})[_-]/,
      /^(\d{2,3})[_-]/,
      /[_-](\d{2,3})$/,
      /\s(\d{2,3})\s/,
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

    // Key patterns
    const keyPatterns = [
      /([a-g][#b]?)maj(or)?/i,
      /([a-g][#b]?)[_-]?maj(or)?/i,
      /([a-g][#b]?)[_-]?major/i,
      /([a-g][#b]?)min(or)?/i,
      /([a-g][#b]?)[_-]?min(or)?/i,
      /([a-g][#b]?)[_-]?minor/i,
      /([a-g][#b]?)m[_-]/i,
      /[_-]([a-g][#b]?)m$/i,
      /^([a-g][#b]?)m[_-]/i,
      /[_-]([a-g][#b]?)m$/i,
      /[_-]([a-g][#b]?)([m]?)[_-]/i,
      /^([a-g][#b]?)([m]?)[_-]/i,
      /[_-]([a-g][#b]?)([m]?)$/i,
    ];

    for (const pattern of keyPatterns) {
      const match = cleanName.match(pattern);
      if (match) {
        const note = match[1].toUpperCase();
        const modifier = match[2] || '';
        
        let normalizedNote = note.replace('B', '#').replace('S', '#');
        if (normalizedNote.includes('#')) {
          normalizedNote = normalizedNote.charAt(0) + '#';
        }
        
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

  detectBPM(audioBuffer) {
    try {
      const audioData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      const onsets = this.detectOnsets(audioData, sampleRate);
      
      if (onsets.length < 4) {
        return { bpm: 120, confidence: 0.3 };
      }
      
      const intervals = [];
      for (let i = 1; i < onsets.length; i++) {
        intervals.push(onsets[i] - onsets[i - 1]);
      }
      
      intervals.sort((a, b) => a - b);
      const medianInterval = intervals[Math.floor(intervals.length / 2)];
      
      if (medianInterval > 0.25 && medianInterval < 1.5) {
        const bpm = Math.round(60 / medianInterval);
        if (bpm >= 60 && bpm <= 200) {
          return { bpm, confidence: 0.7 };
        }
      }
      
      return { bpm: 120, confidence: 0.3 };
    } catch (error) {
      console.warn('BPM detection failed:', error);
      return { bpm: 120, confidence: 0.3 };
    }
  }

  detectOnsets(audioData, sampleRate) {
    const frameSize = 1024;
    const hopSize = 512;
    const frames = Math.floor((audioData.length - frameSize) / hopSize);
    
    const energies = [];
    const onsets = [];
    
    for (let i = 0; i < frames; i++) {
      const start = i * hopSize;
      let energy = 0;
      
      for (let j = start; j < start + frameSize; j++) {
        energy += audioData[j] * audioData[j];
      }
      
      energies.push(energy);
    }
    
    for (let i = 1; i < energies.length - 1; i++) {
      const current = energies[i];
      const prev = energies[i - 1];
      const next = energies[i + 1];
      
      if (current > prev && current > next && current > 0.01) {
        const timeInSeconds = (i * hopSize) / sampleRate;
        onsets.push(timeInSeconds);
      }
    }
    
    return onsets;
  }

  detectKey(audioBuffer) {
    try {
      const audioData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;

      const segments = 3;
      const segmentLength = Math.floor(audioData.length / segments);
      const chromaAccum = new Array(12).fill(0);
      let validSegments = 0;

      for (let s = 0; s < segments; s++) {
        const start = s * segmentLength;
        const end = s === segments - 1 ? audioData.length : start + segmentLength;
        const segment = audioData.subarray(start, end);
        const chroma = this.extractChromaFromSegment(segment, sampleRate);
        if (chroma) {
          for (let i = 0; i < 12; i++) chromaAccum[i] += chroma[i];
          validSegments++;
        }
      }

      if (validSegments === 0) return { key: 'Unknown', confidence: 0 };

      for (let i = 0; i < 12; i++) chromaAccum[i] /= validSegments;

      const keyResult = this.analyzeChromaForKey(chromaAccum);
      return keyResult;
    } catch (error) {
      console.warn('Key detection failed:', error);
      return { key: 'Unknown', confidence: 0 };
    }
  }

  extractChromaFromSegment(audioData, sampleRate) {
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
        
        const windowed = new Float32Array(frameSize);
        for (let j = 0; j < frameSize; j++) {
          windowed[j] = frame[j] * (0.5 - 0.5 * Math.cos(2 * Math.PI * j / (frameSize - 1)));
        }
        
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
        
        for (let k = 1; k < spectrum.length; k++) {
          const freq = k * sampleRate / frameSize;
          if (freq < 80 || freq > 2000) continue;
          
          const midiNote = 12 * Math.log2(freq / 440) + 69;
          const chromaClass = Math.round(midiNote) % 12;
          
          if (chromaClass >= 0 && chromaClass < 12) {
            chroma[chromaClass] += spectrum[k];
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
      
    } catch (error) {
      console.warn('Chroma extraction failed:', error);
      return null;
    }
  }

  analyzeChromaForKey(chroma) {
    const chromaNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
    
    let bestKey = 'Unknown';
    let bestScore = -Infinity;
    
    for (let tonic = 0; tonic < 12; tonic++) {
      const majorScore = this.correlate(chroma, this.rotateArray(majorProfile, tonic));
      if (majorScore > bestScore) {
        bestScore = majorScore;
        bestKey = `${chromaNames[tonic]} Major`;
      }
      
      const minorScore = this.correlate(chroma, this.rotateArray(minorProfile, tonic));
      if (minorScore > bestScore) {
        bestScore = minorScore;
        bestKey = `${chromaNames[tonic]} Minor`;
      }
    }
    
    const confidence = Math.max(0, Math.min(1, (bestScore + 1) / 2));
    
    return { key: bestKey, confidence };
  }

  correlate(x, y) {
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
  }

  rotateArray(arr, steps) {
    const result = [...arr];
    for (let i = 0; i < steps; i++) {
      const first = result.shift();
      if (first !== undefined) result.push(first);
    }
    return result;
  }

  combineAnalysisResults(audioResult, filenameResult) {
    let finalBpm = audioResult.bpm;
    let bpmConfidence = audioResult.confidence;
    
    if (filenameResult.bpm && filenameResult.confidence > 0.3) {
      if (audioResult.confidence < 0.5) {
        finalBpm = filenameResult.bpm;
        bpmConfidence = filenameResult.confidence;
      } else if (Math.abs(audioResult.bpm - filenameResult.bpm) <= 5) {
        bpmConfidence = Math.min(1.0, audioResult.confidence + 0.2);
      } else if (Math.abs(audioResult.bpm - filenameResult.bpm) > 20) {
        if (filenameResult.bpm >= 60 && filenameResult.bpm <= 200) {
          finalBpm = filenameResult.bpm;
          bpmConfidence = 0.6;
        } else {
          bpmConfidence = Math.max(0.3, audioResult.confidence - 0.2);
        }
      }
    }

    let finalKey = audioResult.key;
    let keyConfidence = audioResult.confidence;
    
    if (filenameResult.key && filenameResult.confidence > 0.3) {
      if (audioResult.key === 'Unknown' || audioResult.confidence < 0.4) {
        finalKey = filenameResult.key;
        keyConfidence = filenameResult.confidence;
      } else if (audioResult.key === filenameResult.key) {
        keyConfidence = Math.min(1.0, audioResult.confidence + 0.3);
      } else {
        keyConfidence = Math.max(0.2, audioResult.confidence - 0.2);
      }
    }

    return {
      bpm: finalBpm,
      key: finalKey,
      confidence: (bpmConfidence + keyConfidence) / 2
    };
  }

  async analyzeFile(fileData) {
    try {
      const { arrayBuffer, filename } = fileData;
      
      // Quick filename analysis first
      const filenameResult = this.parseFilenameForMetadata(filename);
      
      // If filename analysis has high confidence, consider using it
      if (filenameResult.confidence > 0.8 && filenameResult.bpm && filenameResult.key) {
        const quickResult = {
          bpm: filenameResult.bpm,
          key: filenameResult.key,
          compatibleKeys: [],
          duration: 0,
          confidenceScore: filenameResult.confidence,
          metadata: {
            filenameAnalysis: filenameResult,
          },
        };
        
        return quickResult;
      }

      // Convert to audio buffer
      const audioBuffer = await this.fileToAudioBuffer(arrayBuffer);
      
      // Audio analysis
      const bpmResult = this.detectBPM(audioBuffer);
      const keyResult = this.detectKey(audioBuffer);
      
      // Combine results
      const combinedResult = this.combineAnalysisResults(
        { 
          bpm: bpmResult.bpm, 
          key: keyResult.key, 
          confidence: (bpmResult.confidence + keyResult.confidence) / 2 
        },
        filenameResult
      );

      return {
        bpm: combinedResult.bpm,
        key: combinedResult.key,
        compatibleKeys: [],
        duration: audioBuffer.duration,
        confidenceScore: combinedResult.confidence,
        metadata: {
          filenameAnalysis: filenameResult,
          audioAnalysis: {
            bpmResult,
            keyResult
          }
        }
      };
      
    } catch (error) {
      console.error('Worker analysis error:', error);
      
      // Fallback to filename analysis only
      const filenameResult = this.parseFilenameForMetadata(fileData.filename);
      return {
        bpm: filenameResult.bpm || 120,
        key: filenameResult.key || 'C Major',
        compatibleKeys: [],
        duration: 0,
        confidenceScore: filenameResult.bpm && filenameResult.key ? filenameResult.confidence : 0.1,
        metadata: {
          filenameAnalysis: filenameResult,
        },
      };
    }
  }
}

// Worker message handler
const worker = new AudioAnalysisWorker();

self.onmessage = async function(e) {
  const { id, type, data } = e.data;
  
  try {
    if (type === 'ANALYZE_FILE') {
      const result = await worker.analyzeFile(data);
      self.postMessage({ id, type: 'ANALYSIS_COMPLETE', result });
    }
  } catch (error) {
    self.postMessage({ 
      id, 
      type: 'ANALYSIS_ERROR', 
      error: error.message 
    });
  }
};