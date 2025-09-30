import React, { useEffect, useRef, useState } from 'react';
import { useWebRTCStreaming } from '@/hooks/useWebRTCStreaming';
import * as Tone from 'tone';
import { HostMasterAudio } from '@/lib/HostMasterAudio';

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
  const hostAudioRef = useRef<HostMasterAudio | null>(null);

  const enableAudio = async () => {
    try {
      // Initialize HostMasterAudio if it doesn't exist
      if (!hostAudioRef.current) {
        hostAudioRef.current = HostMasterAudio.getInstance();
        await hostAudioRef.current.initialize();
        console.log('🎵 HostMasterAudio initialized');
      }

      // If this is the host (canEdit), connect CookModeEngine to master audio
      if (canEdit && hostAudioRef.current.isInitialized) {
        hostAudioRef.current.connectToCookModeEngine();
        console.log('🎵 Host: CookModeEngine connected to master audio');
      }

      // Resume Tone.js AudioContext
      await Tone.start();
      setAudioEnabled(true);

      // Start fade out
      setOverlayVisible(false);

      console.log('🔊 Audio context resumed');
    } catch (err) {
      console.warn('Failed to enable audio:', err);
    }
  };

  useEffect(() => {
    if (!audioEnabled || !hostAudioRef.current) return;

    const masterStream = hostAudioRef.current.getMasterStream();
    if (!masterStream) return;

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
      // Assign master stream to all participants for synchronized audio
      if (el.srcObject !== masterStream) {
        el.srcObject = masterStream;
        
        // For late joiners, seek to current playback position
        const currentTime = hostAudioRef.current?.getCurrentTime() || 0;
        if (currentTime > 0) {
          el.currentTime = currentTime;
        }
        
        el.play().catch((err) => console.warn('Auto-play blocked:', err));
        console.log(`🎵 Master stream assigned to participant ${userId}`);
      }
    });

    // Cleanup participants that left
    const currentIds = new Set(participants.map((p) => p.user_id));
    Object.keys(audioRefs.current).forEach((id) => {
      if (!currentIds.has(id)) {
        audioRefs.current[id]?.pause();
        audioRefs.current[id]?.remove();
        delete audioRefs.current[id];
        console.log(`🧹 Cleaned up audio element for participant ${id}`);
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


