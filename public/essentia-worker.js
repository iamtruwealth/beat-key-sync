// Enhanced Audio Analysis Worker with Essentia.js
console.log('Audio analysis worker starting...');

// Simple audio analysis that works reliably
class SimpleAudioAnalyzer {
  parseFilenameForMetadata(filename) {
    const cleanName = filename.toLowerCase().replace(/\.[^/.]+$/, "");
    let bpm, key, confidence = 0;

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

  getCompatibleKeys(key) {
    if (!key || key === 'Unknown') return [];
    
    const noteMap = {
      'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
      'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
    };
    
    const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    
    const [note, mode] = key.split(' ');
    const tonic = noteMap[note];
    
    if (tonic === undefined) return [];
    
    const compatibleKeys = [];
    
    if (mode === 'Major') {
      compatibleKeys.push(`${noteNames[(tonic + 9) % 12]} Minor`);
      compatibleKeys.push(`${noteNames[(tonic + 7) % 12]} Major`);
      compatibleKeys.push(`${noteNames[(tonic + 5) % 12]} Major`);
    } else if (mode === 'Minor') {
      compatibleKeys.push(`${noteNames[(tonic + 3) % 12]} Major`);
      compatibleKeys.push(`${noteNames[(tonic + 7) % 12]} Minor`);
      compatibleKeys.push(`${noteNames[(tonic + 5) % 12]} Minor`);
    }
    
    return compatibleKeys.filter(k => k !== key);
  }

  // Simple BPM detection using autocorrelation
  detectBPM(audioBuffer) {
    console.log('Detecting BPM from audio buffer...');
    
    const audioData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Simple onset detection
    const frameSize = 1024;
    const hopSize = 512;
    const frames = Math.floor((audioData.length - frameSize) / hopSize);
    
    const energies = [];
    
    for (let i = 0; i < frames; i++) {
      const start = i * hopSize;
      let energy = 0;
      
      for (let j = start; j < start + frameSize; j++) {
        energy += audioData[j] * audioData[j];
      }
      
      energies.push(energy);
    }
    
    // Find peaks (simple onset detection)
    const onsets = [];
    for (let i = 1; i < energies.length - 1; i++) {
      if (energies[i] > energies[i - 1] && energies[i] > energies[i + 1] && energies[i] > 0.01) {
        onsets.push((i * hopSize) / sampleRate);
      }
    }
    
    if (onsets.length < 4) {
      return { bpm: 120, confidence: 0.3 };
    }
    
    // Calculate intervals between onsets
    const intervals = [];
    for (let i = 1; i < onsets.length; i++) {
      intervals.push(onsets[i] - onsets[i - 1]);
    }
    
    // Sort and find median interval
    intervals.sort((a, b) => a - b);
    const medianInterval = intervals[Math.floor(intervals.length / 2)];
    
    if (medianInterval > 0.25 && medianInterval < 1.5) {
      const bpm = Math.round(60 / medianInterval);
      if (bpm >= 60 && bpm <= 200) {
        console.log(`Detected BPM: ${bpm} from audio analysis`);
        return { bpm, confidence: 0.7 };
      }
    }
    
    return { bpm: 120, confidence: 0.3 };
  }

  // Simple key detection using chroma features
  detectKey(audioBuffer) {
    console.log('Detecting key from audio buffer...');
    
    const audioData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    
    // Simple chroma extraction (simplified version)
    const frameSize = 2048;
    const hopSize = 1024;
    const frames = Math.floor((audioData.length - frameSize) / hopSize);
    
    const chromaProfile = new Array(12).fill(0);
    let validFrames = 0;
    
    for (let i = 0; i < frames; i++) {
      const start = i * hopSize;
      const frame = audioData.slice(start, start + frameSize);
      
      // Apply window
      const windowed = new Float32Array(frameSize);
      for (let j = 0; j < frameSize; j++) {
        windowed[j] = frame[j] * (0.5 - 0.5 * Math.cos(2 * Math.PI * j / (frameSize - 1)));
      }
      
      // Simple DFT for pitch analysis
      for (let k = 1; k < frameSize / 2; k++) {
        let real = 0, imag = 0;
        
        for (let n = 0; n < frameSize; n++) {
          const angle = -2 * Math.PI * k * n / frameSize;
          real += windowed[n] * Math.cos(angle);
          imag += windowed[n] * Math.sin(angle);
        }
        
        const magnitude = Math.sqrt(real * real + imag * imag);
        const freq = k * sampleRate / frameSize;
        
        if (freq >= 80 && freq <= 2000) {
          const midiNote = 12 * Math.log2(freq / 440) + 69;
          const chromaClass = Math.round(midiNote) % 12;
          
          if (chromaClass >= 0 && chromaClass < 12) {
            chromaProfile[chromaClass] += magnitude;
          }
        }
      }
      
      validFrames++;
    }
    
    if (validFrames === 0) {
      return { key: 'C Major', confidence: 0.1 };
    }
    
    // Normalize chroma profile
    for (let i = 0; i < 12; i++) {
      chromaProfile[i] /= validFrames;
    }
    
    // Simple key detection using chroma profiles
    const keyNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
    const majorProfile = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
    const minorProfile = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];
    
    let bestKey = 'C Major';
    let bestScore = -Infinity;
    
    for (let tonic = 0; tonic < 12; tonic++) {
      // Major key correlation
      let majorScore = 0;
      for (let i = 0; i < 12; i++) {
        majorScore += chromaProfile[i] * majorProfile[(i - tonic + 12) % 12];
      }
      
      if (majorScore > bestScore) {
        bestScore = majorScore;
        bestKey = `${keyNames[tonic]} Major`;
      }
      
      // Minor key correlation
      let minorScore = 0;
      for (let i = 0; i < 12; i++) {
        minorScore += chromaProfile[i] * minorProfile[(i - tonic + 12) % 12];
      }
      
      if (minorScore > bestScore) {
        bestScore = minorScore;
        bestKey = `${keyNames[tonic]} Minor`;
      }
    }
    
    const confidence = Math.max(0, Math.min(1, bestScore / 100));
    console.log(`Detected key: ${bestKey} from audio analysis (confidence: ${confidence})`);
    
    return { key: bestKey, confidence };
  }

  async analyzeFile(fileData) {
    console.log('Starting comprehensive audio analysis...');
    
    try {
      const { arrayBuffer, filename } = fileData;
      
      // Parse filename first
      const filenameResult = this.parseFilenameForMetadata(filename);
      console.log('Filename analysis:', filenameResult);
      
      // Decode audio for actual analysis
      const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      
      console.log(`Audio decoded: ${audioBuffer.duration}s, ${audioBuffer.sampleRate}Hz`);
      
      // Always perform audio analysis regardless of filename confidence
      const bpmResult = this.detectBPM(audioBuffer);
      const keyResult = this.detectKey(audioBuffer);
      
      console.log('Audio BPM analysis:', bpmResult);
      console.log('Audio key analysis:', keyResult);
      
      // Combine results intelligently
      let finalBpm = bpmResult.bpm;
      let finalKey = keyResult.key;
      let combinedConfidence = (bpmResult.confidence + keyResult.confidence) / 2;
      
      // Use filename data if audio analysis has low confidence
      if (filenameResult.bpm && bpmResult.confidence < 0.6) {
        finalBpm = filenameResult.bpm;
        console.log(`Using filename BPM: ${finalBpm}`);
      } else if (filenameResult.bpm && Math.abs(bpmResult.bpm - filenameResult.bpm) <= 5) {
        // If they agree, boost confidence
        combinedConfidence = Math.min(1.0, combinedConfidence + 0.2);
        console.log('Audio and filename BPM agree, boosting confidence');
      }
      
      if (filenameResult.key && keyResult.confidence < 0.4) {
        finalKey = filenameResult.key;
        console.log(`Using filename key: ${finalKey}`);
      }
      
      const result = {
        bpm: finalBpm,
        key: finalKey,
        compatibleKeys: this.getCompatibleKeys(finalKey),
        duration: audioBuffer.duration,
        confidenceScore: combinedConfidence,
        metadata: {
          sampleRate: audioBuffer.sampleRate,
          channels: audioBuffer.numberOfChannels,
          filenameAnalysis: filenameResult,
          audioAnalysis: {
            bpm: bpmResult.bpm,
            bpmConfidence: bpmResult.confidence,
            key: keyResult.key,
            keyConfidence: keyResult.confidence
          },
          analysisMethod: 'audio_plus_filename'
        }
      };
      
      console.log('Final analysis result:', result);
      return result;
      
    } catch (error) {
      console.error('Audio analysis failed:', error);
      
      // Fallback to filename analysis
      const filenameResult = this.parseFilenameForMetadata(fileData.filename || '');
      return {
        bpm: filenameResult.bpm || 120,
        key: filenameResult.key || 'C Major',
        compatibleKeys: this.getCompatibleKeys(filenameResult.key || 'C Major'),
        duration: 0,
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
const analyzer = new SimpleAudioAnalyzer();

self.onmessage = async function(e) {
  const { id, type, data } = e.data;
  
  console.log('Worker received message:', type);
  
  try {
    if (type === 'ANALYZE_FILE') {
      const result = await analyzer.analyzeFile(data);
      self.postMessage({ id, type: 'ANALYSIS_COMPLETE', result });
    }
  } catch (error) {
    console.error('Worker error:', error);
    self.postMessage({ 
      id, 
      type: 'ANALYSIS_ERROR', 
      error: error.message 
    });
  }
};