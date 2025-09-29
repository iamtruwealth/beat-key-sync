import React, { useEffect, useRef } from 'react';
import { useWebRTCStreaming } from '@/hooks/useWebRTCStreaming';
import * as Tone from 'tone';

interface BackgroundWebRTCConnectorProps {
  sessionId: string;
  canEdit: boolean;
  currentUserId?: string;
}

// Background connector to ensure guests auto-join and hear audio even when the Video panel is hidden
export const BackgroundWebRTCConnector: React.FC<BackgroundWebRTCConnectorProps> = ({
  sessionId,
  canEdit,
  currentUserId,
}) => {
  const {
    participants,
    // We don't expose controls here; hosts will use VideoStreamingPanel for camera streaming
  } = useWebRTCStreaming({ sessionId, canEdit, currentUserId });

  // Keep refs of created WebAudio nodes per remote participant
  const sourceNodesRef = useRef<Record<string, MediaStreamAudioSourceNode | null>>({});

  useEffect(() => {
    const audioCtx = Tone.getContext().rawContext as AudioContext;

    participants.forEach((p) => {
      if (!p.stream) return;

      const existing = sourceNodesRef.current[p.user_id];
      const needsRecreate = !existing || (existing.mediaStream !== p.stream);

      if (needsRecreate) {
        try {
          // Cleanup old node if any
          if (existing) {
            try { existing.disconnect(); } catch {}
            sourceNodesRef.current[p.user_id] = null;
          }

          const src = audioCtx.createMediaStreamSource(p.stream as MediaStream);
          src.connect(audioCtx.destination);
          sourceNodesRef.current[p.user_id] = src;
          console.log('[WebRTC] Connected remote stream to AudioContext for', p.username || p.user_id);
        } catch (err) {
          console.warn('Failed to connect remote stream to AudioContext:', err);
        }
      }
    });

    // Cleanup nodes for participants that left
    const currentIds = new Set(participants.map((p) => p.user_id));
    Object.keys(sourceNodesRef.current).forEach((id) => {
      if (!currentIds.has(id)) {
        const node = sourceNodesRef.current[id];
        if (node) {
          try { node.disconnect(); } catch {}
        }
        delete sourceNodesRef.current[id];
      }
    });

    return () => {
      // Do not disconnect on rerender; handled above when participants change
    };
  }, [participants]);

  return null;
};

