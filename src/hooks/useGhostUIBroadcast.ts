import { useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { RealtimeChannel } from '@supabase/supabase-js';

export interface GhostUIState {
  playheadPosition: number; // In beats or seconds
  isPlaying: boolean;
  bpm: number;
  timestamp: number;
  activeView?: 'timeline' | 'mixer';
  mousePosition?: {
    x: number;
    y: number;
    isMoving: boolean;
  };
  pianoRoll?: {
    isOpen: boolean;
    trackId?: string;
    trackName?: string;
    mode?: 'midi' | 'sample';
    sampleUrl?: string;
  };
  clipTriggers?: {
    trackId: string;
    clipId: string;
    time: number;
  }[];
  padPresses?: {
    padId: string;
    velocity: number;
    time: number;
  }[];
  loopRegion?: {
    start: number;
    end: number;
    enabled: boolean;
  };
  activeClips?: string[];
  timeline?: {
    zoom: number;
    scroll: number;
  };
}

interface UseGhostUIBroadcastProps {
  sessionId: string;
  isHost: boolean;
  enabled?: boolean;
}

export const useGhostUIBroadcast = ({ sessionId, isHost, enabled = true }: UseGhostUIBroadcastProps) => {
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastBroadcastRef = useRef<number>(0);
  const THROTTLE_MS = 50; // Broadcast max every 50ms

  useEffect(() => {
    if (!isHost || !enabled || !sessionId) return;

    console.log('[GhostUI] Initializing broadcast for session:', sessionId);

    // Create channel for broadcasting
    const channel = supabase.channel(`ghost-ui-${sessionId}`, {
      config: {
        broadcast: { self: false },
      },
    });

    channel.subscribe((status) => {
      if (status === 'SUBSCRIBED') {
        console.log('[GhostUI] Broadcast channel subscribed');
      }
    });

    channelRef.current = channel;

    return () => {
      console.log('[GhostUI] Cleaning up broadcast channel');
      channel.unsubscribe();
      channelRef.current = null;
    };
  }, [sessionId, isHost, enabled]);

  const broadcastState = (state: GhostUIState) => {
    if (!channelRef.current || !isHost) return;

    // Throttle broadcasts
    const now = Date.now();
    if (now - lastBroadcastRef.current < THROTTLE_MS) return;
    lastBroadcastRef.current = now;

    // Add timestamp to state
    const stateWithTimestamp = {
      ...state,
      timestamp: now,
    };

    channelRef.current.send({
      type: 'broadcast',
      event: 'ghost-ui-state',
      payload: stateWithTimestamp,
    });
  };

  const broadcastClipTrigger = (trackId: string, clipId: string) => {
    if (!channelRef.current || !isHost) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'clip-trigger',
      payload: {
        trackId,
        clipId,
        time: Date.now(),
      },
    });
  };

  const broadcastPadPress = (padId: string, velocity: number) => {
    if (!channelRef.current || !isHost) return;

    channelRef.current.send({
      type: 'broadcast',
      event: 'pad-press',
      payload: {
        padId,
        velocity,
        time: Date.now(),
      },
    });
  };

  return {
    broadcastState,
    broadcastClipTrigger,
    broadcastPadPress,
  };
};
