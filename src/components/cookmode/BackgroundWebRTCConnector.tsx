import React, { useEffect, useRef, useState } from 'react';
import { useWebRTCStreaming } from '@/hooks/useWebRTCStreaming';
import { Button } from '@/components/ui/button';
import { Volume2 } from 'lucide-react';

interface BackgroundWebRTCConnectorProps {
  sessionId: string;
  canEdit: boolean;
  currentUserId?: string;
}

// Viewer-only background audio connector
export const BackgroundWebRTCConnector: React.FC<BackgroundWebRTCConnectorProps> = ({
  sessionId,
  canEdit,
  currentUserId,
}) => {
  const { participants } = useWebRTCStreaming({ sessionId, canEdit, currentUserId });

  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  // Tap-to-enable AudioContext
  const enableAudio = async () => {
    try {
      await new AudioContext().resume(); // simple AudioContext resume
      setAudioEnabled(true);
      console.log('🔊 Audio enabled for viewer');
    } catch (err) {
      console.warn('Failed to enable audio:', err);
    }
  };

  // Connect all participant streams (host + collaborators)
  useEffect(() => {
    if (!audioEnabled) return;

    participants.forEach((p) => {
      if (!p.stream) return;

      const userId = p.user_id;

      // Create hidden <audio> element if missing
      if (!audioRefs.current[userId]) {
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.muted = false; // viewers hear host
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

    // Cleanup departed participants
    const currentIds = new Set(participants.map((p) => p.user_id));
    Object.keys(audioRefs.current).forEach((id) => {
      if (!currentIds.has(id)) {
        audioRefs.current[id]?.pause();
        audioRefs.current[id]?.remove();
        delete audioRefs.current[id];
      }
    });
  }, [participants, audioEnabled]);

  // Show tap-to-enable overlay if audio not yet enabled
  if (!audioEnabled && participants.length > 0) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 text-white text-center p-4 cursor-pointer">
        <Button
          onClick={enableAudio}
          className="bg-neon-cyan text-black hover:bg-neon-cyan/90 shadow-lg px-6 py-4 text-lg flex items-center"
        >
          <Volume2 className="w-5 h-5 mr-2" />
          Tap to Join Audio
        </Button>
      </div>
    );
  }

  return null;
};
