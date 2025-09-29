import React, { useEffect, useRef } from 'react';
import { useWebRTCStreaming } from '@/hooks/useWebRTCStreaming';

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

  // Keep refs of audio elements to avoid re-creating
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  useEffect(() => {
    participants.forEach((p) => {
      if (!p.stream) return;

      // Create or reuse audio element
      if (!audioRefs.current[p.user_id]) {
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.controls = false;
        audioEl.muted = false;
        audioEl.style.position = 'absolute';
        audioEl.style.width = '0px';
        audioEl.style.height = '0px';
        audioEl.style.opacity = '0';
        audioEl.setAttribute('aria-hidden', 'true');
        document.body.appendChild(audioEl);
        audioRefs.current[p.user_id] = audioEl;
      }

      const el = audioRefs.current[p.user_id]!;
      if (el.srcObject !== p.stream) {
        el.srcObject = p.stream as MediaStream;
        // Attempt playback
        el.play().catch((err) => {
          console.warn('Auto-play may be blocked; will resume on user gesture:', err);
        });
      }
    });

    // Cleanup audio elements for participants that left
    const currentIds = new Set(participants.map((p) => p.user_id));
    Object.keys(audioRefs.current).forEach((id) => {
      if (!currentIds.has(id)) {
        const el = audioRefs.current[id];
        if (el) {
          try { el.pause(); } catch { }
          el.srcObject = null;
          el.remove();
        }
        delete audioRefs.current[id];
      }
    });

    return () => {
      // Do not remove here; cleanup happens when participants change/unmount
    };
  }, [participants]);

  return null;
};

