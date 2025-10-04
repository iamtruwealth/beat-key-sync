import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';
import { GhostUIState } from './useGhostUIBroadcast';
import { createChannelName } from '@/lib/realtimeChannels';

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
  const lastSyncedRef = useRef<{ playhead: number; time: number }>({ playhead: 0, time: Date.now() });
  const STALE_MS = 2000;

  // Smooth playhead animation based on last sync
  useEffect(() => {
    if (!ghostState.isPlaying || !isConnected) return;

    let rafId: number;
    const animate = () => {
      const now = Date.now();
      const elapsed = (now - lastSyncedRef.current.time) / 1000; // seconds since last sync

      const beatsPerSecond = ghostState.bpm / 60;
      let newPos = lastSyncedRef.current.playhead + elapsed * beatsPerSecond;

      // Wrap inside loop region if enabled
      if (ghostState.loopRegion?.enabled && ghostState.loopRegion.end > ghostState.loopRegion.start) {
        const len = ghostState.loopRegion.end - ghostState.loopRegion.start;
        const rel = newPos - ghostState.loopRegion.start;
        newPos = ghostState.loopRegion.start + (((rel % len) + len) % len);
      }

      setGhostState(prev => ({ ...prev, playheadPosition: newPos }));
      rafId = requestAnimationFrame(animate);
    };

    rafId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafId);
  }, [ghostState.isPlaying, ghostState.bpm, ghostState.loopRegion, isConnected]);

  useEffect(() => {
    if (!isViewer || !enabled || !sessionId) return;

    const channelName = createChannelName(`ghost-ui-${sessionId}`);
    console.log('[GhostUI] Initializing receiver for session:', sessionId, 'channel:', channelName);

    const channel = supabase.channel(channelName, {
      config: {
        broadcast: { self: false },
      },
    });

    channel
      .on('broadcast', { event: 'ghost-ui-state' }, ({ payload }) => {
        console.log('[GhostUI] Received state update:', payload);
        const incoming = payload as GhostUIState;

        lastSyncedRef.current = {
          playhead: incoming.playheadPosition,
          time: Date.now(),
        };

        setGhostState(prev => ({ ...prev, ...incoming }));
        setLastUpdateTime(Date.now());
      })
      .on('broadcast', { event: 'clip-trigger' }, ({ payload }) => {
        console.log('[GhostUI] Clip triggered:', payload);
        setClipTriggers(prev => [...prev, payload].slice(-10));
      })
      .on('broadcast', { event: 'pad-press' }, ({ payload }) => {
        console.log('[GhostUI] Pad pressed:', payload);
        setPadPresses(prev => [...prev, payload].slice(-10));
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

  // Auto-pause if stale
  useEffect(() => {
    const now = Date.now();
    if (isConnected && now - lastUpdateTime > STALE_MS && ghostState.isPlaying) {
      console.log('[GhostUI] Stale updates detected, auto-pausing playhead animation');
      setGhostState(prev => ({ ...prev, isPlaying: false }));
    }
  }, [isConnected, lastUpdateTime, ghostState.isPlaying]);

  // Clean up old triggers/presses
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      const MAX_AGE = 5000;

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
