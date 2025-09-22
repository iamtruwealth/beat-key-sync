// Simplified Audio Analysis Worker without external dependencies
// This worker handles basic filename parsing and lightweight analysis

class SimpleAudioAnalysisWorker {
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

  async analyzeFile(fileData) {
    try {
      const { filename } = fileData;
      
      // Only do filename analysis for now (lightweight)
      const filenameResult = this.parseFilenameForMetadata(filename);
      
      // Return basic analysis based on filename
      return {
        bpm: filenameResult.bpm || 120,
        key: filenameResult.key || 'C Major',
        compatibleKeys: [],
        duration: 0, // We'll get this from metadata later
        confidenceScore: filenameResult.confidence,
        metadata: {
          filenameAnalysis: filenameResult,
        },
      };
      
    } catch (error) {
      console.error('Worker analysis error:', error);
      
      // Fallback result
      return {
        bpm: 120,
        key: 'C Major',
        compatibleKeys: [],
        duration: 0,
        confidenceScore: 0.1,
        metadata: {
          error: error.message,
        },
      };
    }
  }
}

// Worker message handler
const worker = new SimpleAudioAnalysisWorker();

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