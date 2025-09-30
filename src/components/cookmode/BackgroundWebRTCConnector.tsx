import React, { useEffect, useRef, useState } from 'react';
import { useWebRTCStreaming } from '@/hooks/useWebRTCStreaming';
import { HostMasterAudio } from '@/host/HostMasterAudio';

interface BackgroundWebRTCConnectorProps {
  sessionId: string;
  canEdit: boolean;
  currentUserId?: string;
  masterPlayer: any; // your Tone.Player instance for host audio
}

export const BackgroundWebRTCConnector: React.FC<BackgroundWebRTCConnectorProps> = ({
  sessionId,
  canEdit,
  currentUserId,
  masterPlayer,
}) => {
  const { participants } = useWebRTCStreaming({ sessionId, canEdit, currentUserId });

  const [audioEnabled, setAudioEnabled] = useState(false);
  const [overlayVisible, setOverlayVisible] = useState(true);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  const hostAudioRef = useRef<HostMasterAudio | null>(null);

  const enableAudio = async () => {
    try {
      // Initialize HostMasterAudio if not already
      if (!hostAudioRef.current) {
        hostAudioRef.current = new HostMasterAudio();
        hostAudioRef.current.connectNode(masterPlayer);

        // Start looping the master player
        hostAudioRef.current.startLoop(masterPlayer, 0, masterPlayer.buffer?.duration || 8);
      }

      // Resume Tone.js audio context
      await masterPlayer.context.resume();

      // Enable audio and hide overlay
      setAudioEnabled(true);
      setOverlayVisible(false);

      console.log('🔊 Audio context resumed for viewers');
    } catch (err) {
      console.warn('Failed to enable audio:', err);
    }
  };

  useEffect(() => {
    if (!audioEnabled || !hostAudioRef.current) return;

    const masterStream = hostAudioRef.current.masterStream;

    // Ensure every participant gets an audio element
    participants.forEach((p) => {
      const userId = p.user_id;

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
      if (el.srcObject !== masterStream) {
        el.srcObject = masterStream;
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
        }}
        onClick={enableAudio}
      >
        Tap to Join Audio
      </div>
    );
  }

  return null;
};
