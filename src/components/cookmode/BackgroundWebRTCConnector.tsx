import React, { useEffect, useRef, useState } from 'react';
import { useWebRTCStreaming } from '@/hooks/useWebRTCStreaming';
import { HostMasterAudio } from '@/host/HostMasterAudio';
import * as Tone from 'tone';

interface BackgroundWebRTCConnectorProps {
  sessionId: string;
  canEdit: boolean;
  currentUserId?: string;
  masterPlayer: Tone.Player; // Tone.js player instance for host audio
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

  const audioRefs = useRef<Record<string, HTMLAudioElement>>({});
  const hostAudioRef = useRef<HostMasterAudio | null>(null);

  // Enable audio on tap
  const enableAudio = async () => {
    try {
      if (!hostAudioRef.current) {
        hostAudioRef.current = new HostMasterAudio();
        hostAudioRef.current.connectNode(masterPlayer);
        hostAudioRef.current.startLoop(masterPlayer, 0, masterPlayer.buffer?.duration || 8);
      }

      // Resume AudioContext
      await Tone.start();
      await masterPlayer.context.resume();

      setAudioEnabled(true);
      setOverlayVisible(false);

      console.log('🔊 Audio context resumed and master loop started');
    } catch (err) {
      console.warn('Failed to enable audio:', err);
    }
  };

  // Attach master stream to all participant audio elements
  useEffect(() => {
    if (!audioEnabled || !hostAudioRef.current) return;

    const masterStream = hostAudioRef.current.masterStream;

    participants.forEach((p) => {
      const userId = p.user_id;

      if (!audioRefs.current[userId]) {
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.muted = false;
        audioEl.style.display = 'none';
        audioEl.srcObject = masterStream;
        document.body.appendChild(audioEl);
        audioRefs.current[userId] = audioEl;
      } else if (audioRefs.current[userId].srcObject !== masterStream) {
        audioRefs.current[userId].srcObject = masterStream;
        audioRefs.current[userId].play().catch((err) => console.warn('Auto-play blocked:', err));
      }
    });

    // Remove audio elements for participants who left
    const currentIds = new Set(participants.map((p) => p.user_id));
    Object.keys(audioRefs.current).forEach((id) => {
      if (!currentIds.has(id)) {
        audioRefs.current[id]?.pause();
        audioRefs.current[id]?.remove();
        delete audioRefs.current[id];
      }
    });
  }, [participants, audioEnabled]);

  // Overlay JSX
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
          opacity: 1,
          transition: 'opacity 0.5s ease',
        }}
        onClick={enableAudio}
      >
        Tap to Join Audio
      </div>
    );
  }

  return null;
};
