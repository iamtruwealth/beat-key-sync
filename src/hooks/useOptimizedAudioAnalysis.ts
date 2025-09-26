import { useState, useCallback, useRef, useEffect } from 'react';
import { AudioAnalysisResult, parseFilenameForMetadata } from '@/lib/audioAnalysis';
import { useToast } from '@/hooks/use-toast';

export type { AudioAnalysisResult };

interface AnalysisState {
  isAnalyzing: boolean;
  progress: number;
  error: string | null;
}

interface CachedResult {
  result: AudioAnalysisResult;
  timestamp: number;
}

interface WorkerMessage {
  id: string;
  type: 'ANALYZE_FILE' | 'ANALYSIS_COMPLETE' | 'ANALYSIS_ERROR';
  data?: any;
  result?: AudioAnalysisResult;
  error?: string;
}

// Cache analysis results for 24 hours
const CACHE_DURATION = 24 * 60 * 60 * 1000;

export function useOptimizedAudioAnalysis() {
  const [analysisState, setAnalysisState] = useState<AnalysisState>({
    isAnalyzing: false,
    progress: 0,
    error: null,
  });
  const { toast } = useToast();
  const workerRef = useRef<Worker | null>(null);
  const pendingRequests = useRef<Map<string, { resolve: (result: AudioAnalysisResult) => void; reject: (error: Error) => void }>>(new Map());

  // Initialize Web Worker
  useEffect(() => {
    workerRef.current = new Worker('/audio-analysis-worker.js');
    
    workerRef.current.onmessage = (e: MessageEvent<WorkerMessage>) => {
      const { id, type, result, error } = e.data;
      const request = pendingRequests.current.get(id);
      
      if (!request) return;
      
      pendingRequests.current.delete(id);
      
      if (type === 'ANALYSIS_COMPLETE' && result) {
        request.resolve(result);
      } else if (type === 'ANALYSIS_ERROR' && error) {
        request.reject(new Error(error));
      }
    };

    workerRef.current.onerror = (error) => {
      console.error('Worker error:', error);
      // Clear all pending requests
      pendingRequests.current.forEach(({ reject }) => {
        reject(new Error('Worker error'));
      });
      pendingRequests.current.clear();
    };

    return () => {
      workerRef.current?.terminate();
    };
  }, []);

  const getCacheKey = (file: File): string => {
    return `audio_analysis_${file.name}_${file.size}_${file.lastModified}`;
  };

  const getCachedResult = (file: File): AudioAnalysisResult | null => {
    try {
      const cacheKey = getCacheKey(file);
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const { result, timestamp }: CachedResult = JSON.parse(cached);
        if (Date.now() - timestamp < CACHE_DURATION) {
          return result;
        } else {
          localStorage.removeItem(cacheKey);
        }
      }
    } catch (error) {
      console.warn('Cache read error:', error);
    }
    return null;
  };

  const setCachedResult = (file: File, result: AudioAnalysisResult): void => {
    try {
      const cacheKey = getCacheKey(file);
      const cached: CachedResult = {
        result,
        timestamp: Date.now(),
      };
      localStorage.setItem(cacheKey, JSON.stringify(cached));
    } catch (error) {
      console.warn('Cache write error:', error);
    }
  };

  const analyzeFile = useCallback(async (file: File): Promise<AudioAnalysisResult> => {
    // Check cache first
    const cachedResult = getCachedResult(file);
    if (cachedResult) {
      toast({
        title: "Using cached analysis",
        description: `Analysis loaded from cache for ${file.name}`,
      });
      return cachedResult;
    }

    if (!workerRef.current) {
      throw new Error('Worker not initialized');
    }

    setAnalysisState({
      isAnalyzing: true,
      progress: 0,
      error: null,
    });

    try {
      // Quick filename analysis first
      setAnalysisState(prev => ({ ...prev, progress: 10 }));
      const filenameResult = parseFilenameForMetadata(file.name);
      
      // If filename analysis has high confidence, consider skipping audio analysis
      if (filenameResult.confidence > 0.8 && filenameResult.bpm && filenameResult.key) {
        const quickResult: AudioAnalysisResult = {
          bpm: filenameResult.bpm,
          key: filenameResult.key,
          compatibleKeys: [],
          duration: 0,
          confidenceScore: filenameResult.confidence,
          metadata: {
            filenameAnalysis: filenameResult,
          },
        };

        setAnalysisState(prev => ({ ...prev, progress: 100 }));
        setCachedResult(file, quickResult);
        
        toast({
          title: "Quick analysis complete",
          description: `High-confidence filename analysis for ${file.name}`,
        });

        return quickResult;
      }

      // Proceed with Web Worker analysis
      setAnalysisState(prev => ({ ...prev, progress: 25 }));
      
      const arrayBuffer = await file.arrayBuffer();
      const requestId = Math.random().toString(36).substr(2, 9);
      
      // Create promise for worker response
      const workerPromise = new Promise<AudioAnalysisResult>((resolve, reject) => {
        pendingRequests.current.set(requestId, { resolve, reject });
      });

      // Send work to worker
      workerRef.current.postMessage({
        id: requestId,
        type: 'ANALYZE_FILE',
        data: {
          arrayBuffer,
          filename: file.name
        }
      });

      setAnalysisState(prev => ({ ...prev, progress: 50 }));
      
      const result = await workerPromise;
      
      setAnalysisState(prev => ({ ...prev, progress: 100 }));
      setCachedResult(file, result);

      toast({
        title: "Analysis complete",
        description: `Successfully analyzed ${file.name}`,
      });

      return result;

    } catch (error) {
      console.error('Analysis error:', error);
      
      // Fallback to filename analysis only
      const filenameResult = parseFilenameForMetadata(file.name);
      const fallbackResult: AudioAnalysisResult = {
        bpm: filenameResult.bpm || 120,
        key: filenameResult.key || 'C Major',
        compatibleKeys: [],
        duration: 0,
        confidenceScore: filenameResult.bpm && filenameResult.key ? filenameResult.confidence : 0.1,
        metadata: {
          filenameAnalysis: filenameResult,
        },
      };

      setAnalysisState({
        isAnalyzing: false,
        progress: 0,
        error: `Analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });

      toast({
        title: "Analysis failed",
        description: `Using fallback analysis for ${file.name}`,
        variant: "destructive",
      });

      return fallbackResult;
    } finally {
      setAnalysisState(prev => ({
        ...prev,
        isAnalyzing: false,
      }));
    }
  }, [toast]);

  const clearCache = useCallback(() => {
    try {
      const keys = Object.keys(localStorage);
      keys.forEach(key => {
        if (key.startsWith('audio_analysis_')) {
          localStorage.removeItem(key);
        }
      });
      toast({
        title: "Cache cleared",
        description: "All cached analysis results have been removed",
      });
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }, [toast]);

  return {
    analyzeFile,
    clearCache,
    ...analysisState,
  };
}