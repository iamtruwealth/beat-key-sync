// PCM Audio Analysis Worker - runs heavy analysis off the main thread
// Accepts raw PCM (Float32Array) plus sampleRate and duration

// Filename parsing for BPM and Key
function parseFilenameForMetadata(filename) {
  const cleanName = (filename || '').toLowerCase().replace(/\.[^/.]+$/, '');
  let bpm; let key; let confidence = 0;
  const bpmPatterns = [/(\d{2,3})bpm/i, /(\d{2,3})[_-]?bpm/i, /bpm[_-]?(\d{2,3})/i, /(\d{2,3})[_-]beats?/i, /[_-](\d{2,3})[_-]/, /^(\d{2,3})[_-]/, /[_-](\d{2,3})$/, /\s(\d{2,3})\s/];
  for (const pattern of bpmPatterns) { const m = cleanName.match(pattern); if (m) { const p = parseInt(m[1]); if (p>=60 && p<=200) { bpm=p; confidence += 0.5; break; } } }
  const keyPatterns = [
    /([a-g][#b]?)maj(or)?/i, /([a-g][#b]?)[_-]?maj(or)?/i, /([a-g][#b]?)[_-]?major/i,
    /([a-g][#b]?)min(or)?/i, /([a-g][#b]?)[_-]?min(or)?/i, /([a-g][#b]?)[_-]?minor/i,
    /([a-g][#b]?)m[_-]/i, /[_-]([a-g][#b]?)m$/i, /^([a-g][#b]?)m[_-]/i,
    /[_-]([a-g][#b]?)([m]?)[_-]/i, /^([a-g][#b]?)([m]?)[_-]/i, /[_-]([a-g][#b]?)([m]?)$/i
  ];
  for (const pattern of keyPatterns) {
    const m = cleanName.match(pattern);
    if (m) {
      const note = m[1].toUpperCase();
      const modifier = m[2] || '';
      let normalized = note.replace('B', '#').replace('S', '#');
      if (normalized.includes('#')) normalized = normalized.charAt(0) + '#';
      const isMinor = modifier.toLowerCase().includes('m') || pattern.source.includes('min') || cleanName.includes('minor');
      key = `${normalized}${isMinor ? ' Minor' : ' Major'}`;
      confidence += 0.5; break;
    }
  }
  return { bpm, key, confidence: Math.min(confidence, 1.0) };
}

function getCompatibleKeys(key) {
  if (!key || key === 'Unknown') return [];
  const noteMap = { 'C':0,'C#':1,'Db':1,'D':2,'D#':3,'Eb':3,'E':4,'F':5,'F#':6,'Gb':6,'G':7,'G#':8,'Ab':8,'A':9,'A#':10,'Bb':10,'B':11 };
  const noteNames = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const [note, mode] = key.split(' ');
  const tonic = noteMap[note];
  if (tonic === undefined) return [];
  const out = [];
  if (mode === 'Major') {
    out.push(`${noteNames[(tonic + 9) % 12]} Minor`, `${noteNames[(tonic + 7) % 12]} Major`, `${noteNames[(tonic + 5) % 12]} Major`);
  } else if (mode === 'Minor') {
    out.push(`${noteNames[(tonic + 3) % 12]} Major`, `${noteNames[(tonic + 7) % 12]} Minor`, `${noteNames[(tonic + 5) % 12]} Minor`);
  }
  return out.filter(k => k !== key);
}

// Simple BPM detection using frame energies and onset intervals
function detectBPMFromPCM(pcm, sampleRate) {
  const frameSize = 1024; const hopSize = 512;
  const frames = Math.max(0, Math.floor((pcm.length - frameSize) / hopSize));
  if (frames < 8) return { bpm: 120, confidence: 0.3 };
  const energies = new Float32Array(frames);
  for (let i=0;i<frames;i++){ let e=0; const start=i*hopSize; for(let j=start;j<start+frameSize;j++){ const v=pcm[j]||0; e += v*v; } energies[i]=e; }
  const onsets = [];
  for (let i=1;i<energies.length-1;i++){ const v=energies[i]; if (v>energies[i-1] && v>energies[i+1] && v>0.01) onsets.push((i*hopSize)/sampleRate); }
  if (onsets.length < 4) return { bpm: 120, confidence: 0.3 };
  const intervals = [];
  for (let i=1;i<onsets.length;i++) intervals.push(onsets[i]-onsets[i-1]);
  intervals.sort((a,b)=>a-b);
  const median = intervals[Math.floor(intervals.length/2)] || 0.5;
  const bpm = Math.round(60 / Math.min(Math.max(median, 0.25), 1.5));
  if (bpm>=60 && bpm<=200) return { bpm, confidence: 0.7 };
  return { bpm: 120, confidence: 0.3 };
}

// Simple key detection using chroma features from a basic DFT
function detectKeyFromPCM(pcm, sampleRate) {
  const frameSize = 2048; const hopSize = 1024;
  const frames = Math.max(0, Math.floor((pcm.length - frameSize) / hopSize));
  if (frames < 2) return { key: 'C Major', confidence: 0.1 };
  const chroma = new Float32Array(12);
  let used=0;
  const window = new Float32Array(frameSize);
  for (let j=0;j<frameSize;j++) window[j] = 0.5 - 0.5*Math.cos(2*Math.PI*j/(frameSize-1));
  for (let i=0;i<frames;i++){
    const start=i*hopSize;
    // Build spectrum
    for (let k=1;k<frameSize/2;k++){
      let real=0, imag=0;
      for (let n=0;n<frameSize;n++){
        const s = pcm[start+n]||0;
        const w = window[n];
        const ang = -2*Math.PI*k*n/frameSize;
        real += s*w*Math.cos(ang); imag += s*w*Math.sin(ang);
      }
      const mag = Math.hypot(real, imag);
      const freq = k*sampleRate/frameSize;
      if (freq>=80 && freq<=2000){
        const midi = 12*Math.log2(freq/440)+69; const cls = Math.round(midi)%12; if (cls>=0 && cls<12) chroma[cls]+=mag;
      }
    }
    used++;
  }
  if (used>0) for (let i=0;i<12;i++) chroma[i]/=used;
  const major=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
  const minor=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
  const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const rotate=(arr,steps)=>{ const a=arr.slice(); for(let s=0;s<steps;s++){ a.push(a.shift()); } return a; };
  const corr=(x,y)=>{ let sum=0,sumX=0,sumY=0,sumXY=0,sumXX=0,sumYY=0; for(let i=0;i<12;i++){ const xi=x[i], yi=y[i]; sum++; sumX+=xi; sumY+=yi; sumXY+=xi*yi; sumXX+=xi*xi; sumYY+=yi*yi; } const num=sum*sumXY-sumX*sumY; const den=Math.sqrt((sum*sumXX-sumX*sumX)*(sum*sumYY-sumY*sumY)); return den===0?0:num/den; };
  let best='C Major', bestScore=-Infinity;
  for(let t=0;t<12;t++){
    const maj=corr(chroma, rotate(major.slice(), t)); if(maj>bestScore){ bestScore=maj; best=`${names[t]} Major`; }
    const min=corr(chroma, rotate(minor.slice(), t)); if(min>bestScore){ bestScore=min; best=`${names[t]} Minor`; }
  }
  const confidence = Math.max(0, Math.min(1, (bestScore+1)/2));
  return { key: best, confidence };
}

self.onmessage = function(e){
  const { id, type, data } = e.data || {};
  if (type !== 'ANALYZE_PCM') return;
  try {
    const { pcmBuffer, sampleRate, duration, filename } = data || {};
    const pcm = new Float32Array(pcmBuffer);
    const bpmRes = detectBPMFromPCM(pcm, sampleRate);
    const keyRes = detectKeyFromPCM(pcm, sampleRate);
    const fileRes = parseFilenameForMetadata(filename || '');

    // Combine results with simple heuristics
    let finalBpm = bpmRes.bpm; let bpmConf = bpmRes.confidence;
    if (fileRes.bpm && bpmConf < 0.6) { finalBpm = fileRes.bpm; bpmConf = Math.max(bpmConf, fileRes.confidence); }
    else if (fileRes.bpm && Math.abs(fileRes.bpm - bpmRes.bpm) <= 5) { bpmConf = Math.min(1, bpmConf + 0.2); }

    let finalKey = keyRes.key; let keyConf = keyRes.confidence;
    if (fileRes.key && keyConf < 0.4) { finalKey = fileRes.key; keyConf = Math.max(keyConf, fileRes.confidence); }

    const result = {
      bpm: finalBpm,
      key: finalKey,
      compatibleKeys: getCompatibleKeys(finalKey),
      duration: duration || 0,
      confidenceScore: (bpmConf + keyConf) / 2,
      metadata: {
        filenameAnalysis: fileRes,
        audioAnalysis: { bpm: bpmRes.bpm, bpmConfidence: bpmConf, key: keyRes.key, keyConfidence: keyConf },
        analysisMethod: 'pcm_worker'
      }
    };

    self.postMessage({ id, type: 'ANALYSIS_COMPLETE', result });
  } catch (err) {
    self.postMessage({ id, type: 'ANALYSIS_ERROR', error: err && err.message ? err.message : 'Worker error' });
  }
};