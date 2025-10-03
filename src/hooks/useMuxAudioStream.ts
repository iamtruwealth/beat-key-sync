import { useEffect, useRef } from 'react';

interface UseMuxAudioStreamOptions {
  mediaStream: MediaStream | null;
  wsUrl: string;
  onError?: (error: any) => void;
}

export function useMuxAudioStream({ mediaStream, wsUrl, onError }: UseMuxAudioStreamOptions) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!mediaStream || !wsUrl) return;

    wsRef.current = new WebSocket(wsUrl);
    wsRef.current.binaryType = "arraybuffer";

    wsRef.current.onopen = () => {
      console.log('[useMuxAudioStream] WebSocket connected:', wsUrl);
      recorderRef.current = new MediaRecorder(mediaStream, { mimeType: 'audio/webm;codecs=opus' });
      recorderRef.current.ondataavailable = (e) => {
        if (e.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          wsRef.current.send(e.data);
        }
      };
      recorderRef.current.onstart = () => console.log('[useMuxAudioStream] MediaRecorder started');
      recorderRef.current.onstop = () => console.log('[useMuxAudioStream] MediaRecorder stopped');
      recorderRef.current.start(250); // 250ms chunks
    };
    wsRef.current.onerror = onError || (() => {});
    wsRef.current.onclose = (e) => {
      console.log('[useMuxAudioStream] WebSocket closed', e.code, e.reason);
    };
    if (recorderRef.current) {
      recorderRef.current.onerror = onError || (() => {});
    }

    return () => {
      recorderRef.current?.stop();
      wsRef.current?.close();
    };
  }, [mediaStream, wsUrl, onError]);
}
