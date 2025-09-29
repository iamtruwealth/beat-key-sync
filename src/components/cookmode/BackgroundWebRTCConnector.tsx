import React, { useEffect, useRef, useState } from 'react';
import { useWebRTCStreaming } from '@/hooks/useWebRTCStreaming';
import * as Tone from 'tone';

interface BackgroundWebRTCConnectorProps {
  sessionId: string;
  canEdit: boolean;
  currentUserId?: string;
}

export const BackgroundWebRTCConnector: React.FC<BackgroundWebRTCConnectorProps> = ({
  sessionId,
  canEdit,
  currentUserId,
}) => {
  const { participants } = useWebRTCStreaming({ sessionId, canEdit, currentUserId });

  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const gainNodesRef = useRef<Record<string, GainNode>>({});

  // Triggered by first tap anywhere (overlay)
  const enableAudio = async () => {
    try {
      await Tone.start(); // Resume AudioContext
      setAudioEnabled(true);
      console.log('🔊 Audio context resumed for viewers');
    } catch (err) {
      console.warn('Failed to enable audio:', err);
    }
  };

  // Connect remote streams through Tone.js + hidden <audio>
  useEffect(() => {
    if (!audioEnabled) return; // Only connect after user gesture
    const audioCtx = Tone.getContext().rawContext as AudioContext;

    participants.forEach((p) => {
      if (!p.stream) return;
      const userId = p.user_id;

      // Create GainNode if not exists
      if (!gainNodesRef.current[userId]) {
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 1.0;
        gainNodesRef.current[userId] = gainNode;
      }

      // Connect MediaStream to Tone.js
      const src = audioCtx.createMediaStreamSource(p.stream as MediaStream);
      src.connect(gainNodesRef.current[userId]).connect(audioCtx.destination);

      // Hidden <audio> element for browser autoplay
      if (!audioRefs.current[userId]) {
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.muted = false;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        audioRefs.current[userId] = audioEl;
      }

      const el = audioRefs.current[userId]!;
      if (el.srcObject !== p.stream) {
        el.srcObject = p.stream as MediaStream;
        el.play().catch((err) => {
          console.warn('Auto-play blocked even after enable:', err);
        });
      }
    });

    // Cleanup audio and GainNodes for participants who left
    const currentIds = new Set(participants.map((p) => p.user_id));
    Object.keys(audioRefs.current).forEach((id) => {
      if (!currentIds.has(id)) {
        audioRefs.current[id]?.pause();
        audioRefs.current[id]?.remove();
        delete audioRefs.current[id];
        delete gainNodesRef.current[id];
      }
    });
  }, [participants, audioEnabled]);

  // Show full-screen overlay for first user gesture
  if (!audioEnabled && participants.length > 0) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100vw',
          height: '100vh',
          backgroundColor: 'rgba(0,0,0,0.85)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#fff',
          fontSize: '1.5rem',
          textAlign: 'center',
          flexDirection: 'column',
          cursor: 'pointer',
        }}
        onClick={enableAudio}
      >
        Tap to Join Audio
      </div>
    );
  }

  return null;
};


