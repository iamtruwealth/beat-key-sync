import React, { useEffect, useRef, useState } from 'react';
import { useWebRTCStreaming } from '@/hooks/useWebRTCStreaming';
import * as Tone from 'tone';
import { HostMasterAudio } from '@/lib/HostMasterAudio';
import { AudioBuffer } from '@/lib/AudioBuffer';

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
  const hostAudioRef = useRef<HostMasterAudio | null>(null);
  const viewerAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

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

      // Hide overlay immediately for host; viewers will hide after playback starts
      if (canEdit) {
        setOverlayVisible(false);
      }

      console.log('🔊 Audio context resumed');
    } catch (err) {
      console.warn('Failed to enable audio:', err);
    }
  };

  useEffect(() => {
    if (!audioEnabled) return;

    // Initialize audio context and buffer for viewers
    if (!canEdit && !audioContextRef.current) {
      audioContextRef.current = new AudioContext({ sampleRate: 24000 });
      audioBufferRef.current = new AudioBuffer(audioContextRef.current);
      console.log('📻 Radio Viewer: AudioContext and buffer initialized');
    }

    if (!canEdit) {
      // Radio Viewer Mode: One-way receive with buffered playback
      const streamWithAudio = participants.find(
        (p) => p.stream && (p.stream as MediaStream).getAudioTracks().length > 0
      )?.stream as MediaStream | undefined;

      if (streamWithAudio && audioContextRef.current) {
        console.log('📻 Radio Viewer: Receiving broadcast stream', {
          audioTracks: streamWithAudio.getAudioTracks().map((t) => t.id),
        });

        // Use a simple audio element for reliable playback
        try {
          if (!viewerAudioRef.current) {
            const audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            audioEl.setAttribute('playsinline', 'true');
            audioEl.muted = false;
            audioEl.style.display = 'none';
            document.body.appendChild(audioEl);
            viewerAudioRef.current = audioEl;
          }

          viewerAudioRef.current.srcObject = streamWithAudio;
          viewerAudioRef.current.play()
            .then(() => {
              console.log('📻 Radio Viewer: Playback started');
              setOverlayVisible(false);
            })
            .catch((err) => {
              console.warn('Viewer auto-play blocked:', err);
            });
        } catch (error) {
          console.warn('Failed to start viewer playback:', error);
        }
      }
      
      return; // Viewers don't need participant management
    }

    // Host Mode: Standard WebRTC (for potential future multi-host support)
    console.log('📻 Radio Host: Broadcasting to', participants.length, 'viewers');
  }, [participants, audioEnabled, canEdit]);

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
        📻 Tap to Join Radio Stream
      </div>
    );
  }

  return null;
};


