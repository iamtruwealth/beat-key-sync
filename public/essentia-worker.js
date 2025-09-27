// Essentia.js Audio Analysis Worker
// Using Essentia.js for professional audio analysis

let Essentia;

// Load Essentia.js
importScripts('https://unpkg.com/essentia.js@0.1.3/dist/essentia-wasm.web.js');

class EssentiaAudioAnalyzer {
  constructor() {
    this.essentia = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    
    try {
      // Initialize Essentia
      this.essentia = new Essentia(EssentiaWASM);
      this.initialized = true;
      console.log('Essentia.js initialized successfully');
    } catch (error) {
      console.error('Failed to initialize Essentia.js:', error);
      throw error;
    }
  }

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
      // Relative minor
      compatibleKeys.push(`${noteNames[(tonic + 9) % 12]} Minor`);
      // Perfect 5th
      compatibleKeys.push(`${noteNames[(tonic + 7) % 12]} Major`);
      // Perfect 4th
      compatibleKeys.push(`${noteNames[(tonic + 5) % 12]} Major`);
    } else if (mode === 'Minor') {
      // Relative major
      compatibleKeys.push(`${noteNames[(tonic + 3) % 12]} Major`);
      // Perfect 5th
      compatibleKeys.push(`${noteNames[(tonic + 7) % 12]} Minor`);
      // Perfect 4th
      compatibleKeys.push(`${noteNames[(tonic + 5) % 12]} Minor`);
    }
    
    return compatibleKeys.filter(k => k !== key);
  }

  async analyzeAudio(audioBuffer) {
    if (!this.initialized) {
      await this.initialize();
    }

    const results = {
      bpm: 120,
      key: 'C Major',
      confidence: 0.1,
      energy: 0,
      danceability: 0,
      spectralCentroid: 0
    };

    try {
      // Convert AudioBuffer to mono float array
      const audioData = audioBuffer.getChannelData(0);
      const sampleRate = audioBuffer.sampleRate;
      
      // Ensure we have enough data
      if (audioData.length < sampleRate * 10) { // At least 10 seconds
        console.warn('Audio too short for reliable analysis');
        return results;
      }

      // BPM Detection using Essentia
      try {
        const beatTracker = this.essentia.BeatTrackerMultiFeature(audioData, sampleRate);
        if (beatTracker.bpm && beatTracker.bpm > 60 && beatTracker.bpm < 200) {
          results.bpm = Math.round(beatTracker.bpm);
          results.confidence = Math.max(results.confidence, 0.7);
        } else {
          // Fallback BPM detection
          const percivalBpm = this.essentia.PercivalBpmEstimator(audioData, sampleRate);
          if (percivalBpm.bpm && percivalBpm.bpm > 60 && percivalBpm.bpm < 200) {
            results.bpm = Math.round(percivalBpm.bpm);
            results.confidence = Math.max(results.confidence, 0.6);
          }
        }
      } catch (error) {
        console.warn('BPM detection failed:', error);
      }

      // Key Detection using Essentia
      try {
        const keyExtractor = this.essentia.KeyExtractor(audioData, sampleRate);
        if (keyExtractor.key && keyExtractor.scale) {
          const keyName = keyExtractor.key.charAt(0).toUpperCase() + keyExtractor.key.slice(1);
          const scaleName = keyExtractor.scale === 'major' ? 'Major' : 'Minor';
          results.key = `${keyName} ${scaleName}`;
          results.confidence = Math.max(results.confidence, keyExtractor.strength || 0.5);
        }
      } catch (error) {
        console.warn('Key detection failed:', error);
      }

      // Additional features for better analysis
      try {
        const spectralFeatures = this.essentia.SpectralCentroid(audioData);
        results.spectralCentroid = spectralFeatures.spectralCentroid || 0;
        
        const energyFeatures = this.essentia.Energy(audioData);
        results.energy = energyFeatures.energy || 0;
      } catch (error) {
        console.warn('Spectral analysis failed:', error);
      }

    } catch (error) {
      console.error('Essentia analysis failed:', error);
    }

    return results;
  }

  async analyzeFile(fileData) {
    try {
      const { arrayBuffer, filename } = fileData;
      
      // Parse filename first
      const filenameResult = this.parseFilenameForMetadata(filename);
      
      // Decode audio
      const audioContext = new (globalThis.AudioContext || globalThis.webkitAudioContext)();
      const audioBuffer = await audioContext.decodeAudioData(arrayBuffer.slice(0));
      
      // Analyze with Essentia
      const essentiaResult = await this.analyzeAudio(audioBuffer);
      
      // Combine results - prioritize Essentia if confidence is high
      let finalBpm = essentiaResult.bpm;
      let finalKey = essentiaResult.key;
      let combinedConfidence = essentiaResult.confidence;
      
      // If filename has good info and Essentia confidence is low, use filename
      if (filenameResult.bpm && filenameResult.confidence > 0.5 && essentiaResult.confidence < 0.6) {
        finalBpm = filenameResult.bpm;
        combinedConfidence = Math.max(combinedConfidence, filenameResult.confidence);
      }
      
      if (filenameResult.key && filenameResult.confidence > 0.5 && essentiaResult.confidence < 0.6) {
        finalKey = filenameResult.key;
        combinedConfidence = Math.max(combinedConfidence, filenameResult.confidence);
      }
      
      // If both agree, boost confidence
      if (filenameResult.bpm && Math.abs(finalBpm - filenameResult.bpm) <= 3) {
        combinedConfidence = Math.min(1.0, combinedConfidence + 0.2);
      }
      
      return {
        bpm: finalBpm,
        key: finalKey,
        compatibleKeys: this.getCompatibleKeys(finalKey),
        duration: audioBuffer.duration,
        confidenceScore: combinedConfidence,
        metadata: {
          sampleRate: audioBuffer.sampleRate,
          channels: audioBuffer.numberOfChannels,
          filenameAnalysis: filenameResult,
          essentiaAnalysis: {
            bpm: essentiaResult.bpm,
            key: essentiaResult.key,
            confidence: essentiaResult.confidence,
            energy: essentiaResult.energy,
            spectralCentroid: essentiaResult.spectralCentroid
          }
        }
      };
      
    } catch (error) {
      console.error('Worker analysis error:', error);
      
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
          filenameAnalysis: filenameResult
        }
      };
    }
  }
}

// Worker message handler
const analyzer = new EssentiaAudioAnalyzer();

self.onmessage = async function(e) {
  const { id, type, data } = e.data;
  
  try {
    if (type === 'ANALYZE_FILE') {
      const result = await analyzer.analyzeFile(data);
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