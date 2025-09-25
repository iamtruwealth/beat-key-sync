import { parseBlob } from 'music-metadata-browser';
import * as Tonal from 'tonal';

// -------------------------
// Helper functions
// -------------------------

export const getCompatibleKeys = (key: string): string[] => {
  if (!key || key === 'Unknown') return [];
  const parsedKey = Tonal.Key.majorKey(key) || Tonal.Key.minorKey(key);
  if (!parsedKey.tonic) return [];
  const tonic = parsedKey.tonic;
  const isMinor = key.toLowerCase().includes('minor') || key.toLowerCase().includes('m');
  const compatibleKeys: string[] = [];

  if (isMinor) {
    const relativeMajor = Tonal.Note.transpose(tonic, '3m');
    const fifthUp = Tonal.Note.transpose(tonic, '5P');
    const fifthDown = Tonal.Note.transpose(tonic, '-5P');
    compatibleKeys.push(
      `${relativeMajor} Major`,
      `${fifthUp} Minor`,
      `${fifthDown} Minor`,
      `${Tonal.Note.transpose(fifthUp, '3m')} Major`,
      `${Tonal.Note.transpose(fifthDown, '3m')} Major`
    );
  } else {
    const relativeMinor = Tonal.Note.transpose(tonic, '-3m');
    const fifthUp = Tonal.Note.transpose(tonic, '5P');
    const fifthDown = Tonal.Note.transpose(tonic, '-5P');
    compatibleKeys.push(
      `${relativeMinor} Minor`,
      `${fifthUp} Major`,
      `${fifthDown} Major`,
      `${Tonal.Note.transpose(fifthUp, '-3m')} Minor`,
      `${Tonal.Note.transpose(fifthDown, '-3m')} Minor`
    );
  }

  return [...new Set(compatibleKeys)].filter(k => k !== key);
};

// Rotate array helper
const rotateArray = (arr: number[], steps: number) => {
  const result = [...arr];
  for (let i = 0; i < steps; i++) {
    const first = result.shift();
    if (first !== undefined) result.push(first);
  }
  return result;
};

// Correlation for key detection
const correlate = (x: number[], y: number[]) => {
  let sum = 0, sumX = 0, sumY = 0, sumXY = 0, sumXX = 0, sumYY = 0;
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    sum++; sumX += x[i]; sumY += y[i]; sumXY += x[i]*y[i]; sumXX += x[i]*x[i]; sumYY += y[i]*y[i];
  }
  const numerator = sum*sumXY - sumX*sumY;
  const denominator = Math.sqrt((sum*sumXX - sumX*sumX)*(sum*sumYY - sumY*sumY));
  return denominator === 0 ? 0 : numerator/denominator;
};

// Chroma extraction
const extractChromaFromSegment = (audioData: Float32Array, sampleRate: number): number[] | null => {
  try {
    const frameSize = 2048;
    const hopSize = 1024;
    const frames = Math.floor((audioData.length - frameSize)/hopSize);
    if (frames < 1) return null;

    const chroma = new Array(12).fill(0);
    let frameCount = 0;

    for (let i = 0; i < frames; i++) {
      const start = i*hopSize;
      const frame = audioData.slice(start, start+frameSize);
      const windowed = new Float32Array(frameSize);
      for (let j = 0; j < frameSize; j++) windowed[j] = frame[j]*(0.5-0.5*Math.cos(2*Math.PI*j/(frameSize-1)));
      const spectrum = new Float32Array(frameSize/2);
      for (let k = 0; k < spectrum.length; k++) {
        let real=0, imag=0;
        for (let n=0;n<frameSize;n++){
          const angle=-2*Math.PI*k*n/frameSize;
          real+=windowed[n]*Math.cos(angle);
          imag+=windowed[n]*Math.sin(angle);
        }
        spectrum[k]=Math.sqrt(real*real + imag*imag);
      }
      for (let k=1;k<spectrum.length;k++){
        const freq = k*sampleRate/frameSize;
        if(freq<80||freq>2000) continue;
        const midiNote = 12*Math.log2(freq/440)+69;
        const chromaClass = Math.round(midiNote)%12;
        if(chromaClass>=0&&chromaClass<12) chroma[chromaClass]+=spectrum[k];
      }
      frameCount++;
    }

    if(frameCount>0) for(let i=0;i<12;i++) chroma[i]/=frameCount;
    return chroma;
  } catch { return null; }
};

// Analyze chroma for key
const analyzeChromaForKey = (chroma: number[]): {key:string,confidence:number} => {
  const names=['C','C#','D','D#','E','F','F#','G','G#','A','A#','B'];
  const majorProfile=[6.35,2.23,3.48,2.33,4.38,4.09,2.52,5.19,2.39,3.66,2.29,2.88];
  const minorProfile=[6.33,2.68,3.52,5.38,2.60,3.53,2.54,4.75,3.98,2.69,3.34,3.17];
  let bestKey='Unknown', bestScore=-Infinity;

  for(let tonic=0;tonic<12;tonic++){
    const majorScore=correlate(chroma,rotateArray(majorProfile,tonic));
    if(majorScore>bestScore){bestScore=majorScore; bestKey=`${names[tonic]} Major`;}
    const minorScore=correlate(chroma,rotateArray(minorProfile,tonic));
    if(minorScore>bestScore){bestScore=minorScore; bestKey=`${names[tonic]} Minor`;}
  }

  return { key: bestKey, confidence: Math.max(0,Math.min(1,(bestScore+1)/2))};
};

// Detect key
export const detectKey = async (audioBuffer: AudioBuffer): Promise<{key:string,confidence:number}> => {
  try{
    const audioData = audioBuffer.getChannelData(0);
    const sampleRate = audioBuffer.sampleRate;
    const segments = 3;
    const segmentLength = Math.floor(audioData.length/segments);
    const chromaAccum = new Array(12).fill(0);
    let validSegments=0;

    for(let s=0;s<segments;s++){
      const start=s*segmentLength;
      const end=s===segments-1?audioData.length:start+segmentLength;
      const segment=audioData.subarray(start,end);
      const chroma=extractChromaFromSegment(segment,sampleRate);
      if(chroma){for(let i=0;i<12;i++) chromaAccum[i]+=chroma[i]; validSegments++;}
    }

    if(validSegments===0) return {key:'Unknown',confidence:0};
    for(let i=0;i<12;i++) chromaAccum[i]/=validSegments;
    return analyzeChromaForKey(chromaAccum);
  }catch{ return {key:'Unknown',confidence:0}; }
};

// Detect BPM
export const detectBPM = async (audioBuffer: AudioBuffer): Promise<{bpm:number,confidence:number}> => {
  const audioData = audioBuffer.getChannelData(0);
  const sampleRate = audioBuffer.sampleRate;
  const frameSize = 1024, hopSize=512;
  const frames = Math.floor((audioData.length-frameSize)/hopSize);
  const energies:number[]=[];
  const onsets:number[]=[];

  for(let i=0;i<frames;i++){
    const start=i*hopSize;
    let energy=0;
    for(let j=start;j<start+frameSize;j++) energy+=audioData[j]*audioData[j];
    energies.push(energy);
  }

  for(let i=1;i<energies.length-1;i++){
    if(energies[i]>energies[i-1]&&energies[i]>energies[i+1]&&energies[i]>0.01){
      onsets.push((i*hopSize)/sampleRate);
    }
  }

  if(onsets.length<4) return {bpm:120,confidence:0.3};
  const intervals:number[]=[];
  for(let i=1;i<onsets.length;i++) intervals.push(onsets[i]-onsets[i-1]);
  intervals.sort((a,b)=>a-b);
  const medianInterval=intervals[Math.floor(intervals.length/2)];
  if(medianInterval>0.25&&medianInterval<1.5){
    const bpm=Math.round(60/medianInterval);
    if(bpm>=60&&bpm<=200) return {bpm,confidence:0.7};
  }
  return {bpm:120,confidence:0.3};
};

// Filename parsing
export function parseFilenameForMetadata(filename:string){
  const cleanName=filename.toLowerCase().replace(/\.[^/.]+$/,"");
  let bpm:number|undefined, key:string|undefined, confidence=0;

  const bpmPatterns=[/(\d{2,3})bpm/i,/(\d{2,3})[_-]?bpm/i,/bpm[_-]?(\d{2,3})/i,/(\d{2,3})[_-]beats?/i,/[_-](\d{2,3})[_-]/,/^(\d{2,3})[_-]/,/[_-](\d{2,3})$/i,/\s(\d{2,3})\s/];
  for(const pattern of bpmPatterns){
    const match=cleanName.match(pattern);
    if(match){const parsed=parseInt(match[1]); if(parsed>=60&&parsed<=200){bpm=parsed;confidence+=0.5; break;}}
  }

  const keyPatterns=[/([a-g][#b]?)maj(or)?/i,/([a-g][#b]?)[_-]?maj(or)?/i,/([a-g][#b]?)[_-]?major/i,/([a-g][#b]?)min(or)?/i,/([a-g][#b]?)[_-]?min(or)?/i,/([a-g][#b]?)[_-]?minor/i,/([a-g][#b]?)m[_-]/i,/[_-]([a-g][#b]?)m$/i,/^([a-g][#b]?)m[_-]/i,/[_-]([a-g][#b]?)m$/i,/[_-]([a-g][#b]?)([m]?)[_-]/i,/^([a-g][#b]?)([m]?)[_-]/i,/[_-]([a-g][#b]?)([m]?)$/i];
  for(const pattern of keyPatterns){
    const match=cleanName.match(pattern);
    if(match){
      const note=match[1].toUpperCase();
      const modifier=match[2]||'';
      let normalized=note.replace('B','#').replace('S','#');
      if(normalized.includes('#')) normalized=normalized.charAt(0)+'#';
      const isMinor=modifier.toLowerCase().includes('m')||pattern.source.includes('min')||cleanName.includes('minor');
      key=`${normalized}${isMinor?' Minor':' Major'}`;
      confidence+=0.5; break;
    }
  }
  return {bpm,key,confidence:Math.min(confidence,1.0)};
}

// Combine analysis
function combineAnalysisResults(audioResult:{bpm:number,key:string,confidence:number},filenameResult:{bpm?:number,key?:string,confidence:number}){
  let finalBpm=audioResult.bpm; let bpmConfidence=audioResult.confidence;
  if(filenameResult.bpm&&filenameResult.confidence>0.3){
    if(audioResult.confidence<0.5){finalBpm=filenameResult.bpm;bpmConfidence=filenameResult.confidence;}
    else if(Math.abs(audioResult.bpm-filenameResult.bpm)<=5) bpmConfidence=Math.min(1.0,audioResult.confidence+0.2);
    else if(Math.abs(audioResult.bpm-filenameResult.bpm)>20){
      if(filenameResult.bpm>=60&&filenameResult.bpm<=200){finalBpm=filenameResult.bpm;bpmConfidence=0.6;}
      else bpmConfidence=Math.max(0.3,audioResult.confidence-0.2);
    }
  }

  let finalKey=audioResult.key; let keyConfidence=audioResult.confidence;
  if(filenameResult.key&&filenameResult.confidence>0.3){
    if(audioResult.key==='Unknown'||audioResult.confidence<0.4){finalKey=filenameResult.key; keyConfidence=filenameResult.confidence;}
    else if(audioResult.key===filenameResult.key) keyConfidence=Math.min(1.0,audioResult.confidence+0.3);
    else if(getCompatibleKeys(audioResult.key).includes(filenameResult.key)) keyConfidence=Math.min(1.0,audioResult.confidence+0.1);
    else keyConfidence=Math.max(0.2,audioResult.confidence-0.2);
  }

  return {bpm:finalBpm,key:finalKey,confidence:(bpmConfidence+keyConfidence)/2};
}

// -------------------------
// Worker main
// -------------------------
self.onmessage=async (e)=>{
  const file=e.data as File;
  try{
    const metadata = await parseBlob(file);
    const duration = metadata.format.duration || 0;

    const arrayBuffer = await file.arrayBuffer();
    const audioCtx = new (self as any).AudioContext();
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);

    const filenameResult=parseFilenameForMetadata(file.name);
    const bpmResult=await detectBPM(audioBuffer);
    const keyResult=await detectKey(audioBuffer);

    const combined=combineAnalysisResults(
      {bpm:bpmResult.bpm,key:keyResult.key,confidence:(bpmResult.confidence+keyResult.confidence)/2},
      filenameResult
    );

    self.postMessage({
      bpm:combined.bpm,
      key:combined.key,
      compatibleKeys:getCompatibleKeys(combined.key),
      duration,
      confidenceScore:combined.confidence,
      metadata:{
        format:metadata.format.container,
        sampleRate:metadata.format.sampleRate,
        bitrate:metadata.format.bitrate,
        tags:metadata.common,
        filenameAnalysis:filenameResult,
        audioAnalysis:{bpm:bpmResult.bpm,key:keyResult.key,confidence:(bpmResult.confidence+keyResult.confidence)/2}
      }
    });
  }catch(err:any){self.postMessage({error:err.message});}
};
