import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { GhostUIState } from './useGhostUIBroadcast';

interface UseGhostUIReceiverProps {
  sessionId: string;
  isViewer: boolean;
  enabled?: boolean;
}

export const useGhostUIReceiver = ({ sessionId, isViewer, enabled = true }: UseGhostUIReceiverProps) => {
  const [ghostState, setGhostState] = useState<GhostUIState>({
    playheadPosition: 0,
    isPlaying: false,
    bpm: 120,
    timestamp: Date.now(),
  });
  
  const [clipTriggers, setClipTriggers] = useState<Array<{ trackId: string; clipId: string; time: number }>>([]);
  const [padPresses, setPadPresses] = useState<Array<{ padId: string; velocity: number; time: number }>>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [lastUpdateTime, setLastUpdateTime] = useState<number>(0);
  
  const channelRef = useRef<RealtimeChannel | null>(null);
  const animationFrameRef = useRef<number>();

  // Animate playhead when playing
  useEffect(() => {
    if (!ghostState.isPlaying) {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
      return;
    }

    let lastTime = Date.now();
    const animate = () => {
      const now = Date.now();
      const deltaSeconds = (now - lastTime) / 1000;
      lastTime = now;

      // Calculate beats per second
      const beatsPerSecond = ghostState.bpm / 60;
      const deltaBeats = deltaSeconds * beatsPerSecond;

      setGhostState(prev => ({
        ...prev,
        playheadPosition: prev.playheadPosition + deltaBeats,
      }));

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [ghostState.isPlaying, ghostState.bpm]);

  useEffect(() => {
    if (!isViewer || !enabled || !sessionId) return;

    console.log('[GhostUI] Initializing receiver for session:', sessionId);

    const channel = supabase.channel(`ghost-ui-${sessionId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    channel
      .on('broadcast', { event: 'ghost-ui-state' }, ({ payload }) => {
        console.log('[GhostUI] Received state update:', payload);
        setGhostState(payload as GhostUIState);
        setLastUpdateTime(Date.now());
      })
      .on('broadcast', { event: 'clip-trigger' }, ({ payload }) => {
        console.log('[GhostUI] Clip triggered:', payload);
        setClipTriggers(prev => [...prev, payload].slice(-10)); // Keep last 10
      })
      .on('broadcast', { event: 'pad-press' }, ({ payload }) => {
        console.log('[GhostUI] Pad pressed:', payload);
        setPadPresses(prev => [...prev, payload].slice(-10)); // Keep last 10
      })
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[GhostUI] Receiver channel subscribed');
          setIsConnected(true);
        } else if (status === 'CLOSED') {
          console.log('[GhostUI] Receiver channel closed');
          setIsConnected(false);
        }
      });

    channelRef.current = channel;

    return () => {
      console.log('[GhostUI] Cleaning up receiver channel');
      channel.unsubscribe();
      channelRef.current = null;
      setIsConnected(false);
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [sessionId, isViewer, enabled]);

  // Clean up old triggers/presses
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const MAX_AGE = 5000; // 5 seconds

      setClipTriggers(prev => prev.filter(t => now - t.time < MAX_AGE));
      setPadPresses(prev => prev.filter(p => now - p.time < MAX_AGE));
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  return {
    ghostState,
    clipTriggers,
    padPresses,
    isConnected,
    lastUpdateTime,
  };
};
