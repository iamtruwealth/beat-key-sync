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
  const [overlayVisible, setOverlayVisible] = useState(true);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});
  const gainNodesRef = useRef<Record<string, GainNode>>({});

  const enableAudio = async () => {
    try {
      await Tone.start(); // resume AudioContext
      setAudioEnabled(true);

      // start fade out
      setOverlayVisible(false);

      console.log('🔊 Audio context resumed for viewers');
    } catch (err) {
      console.warn('Failed to enable audio:', err);
    }
  };

  useEffect(() => {
    if (!audioEnabled) return;
    const audioCtx = Tone.getContext().rawContext as AudioContext;

    participants.forEach((p) => {
      if (!p.stream) return;
      const userId = p.user_id;

      if (!gainNodesRef.current[userId]) {
        const gainNode = audioCtx.createGain();
        gainNode.gain.value = 1.0;
        gainNodesRef.current[userId] = gainNode;
      }

      const src = audioCtx.createMediaStreamSource(p.stream as MediaStream);
      src.connect(gainNodesRef.current[userId]).connect(audioCtx.destination);

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
        el.play().catch((err) => console.warn('Auto-play blocked:', err));
      }
    });

    // Cleanup participants that left
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

  // Overlay JSX — only rendered if overlayVisible
  if (overlayVisible) {
    return (
      <div
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0,0,0,0.85)',
          zIndex: 9999,
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: '#fff',
          fontSize: '2rem',
          textAlign: 'center',
          cursor: 'pointer',
          padding: '20px',
          opacity: overlayVisible ? 1 : 0,
          transition: 'opacity 0.5s ease',
        }}
        onClick={enableAudio}
        onTransitionEnd={() => {
          if (!overlayVisible) setOverlayVisible(false); // remove from DOM after fade
        }}
      >
        Tap to Join Audio
      </div>
    );
  }

  return null;
};


