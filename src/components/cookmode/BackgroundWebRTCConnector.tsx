import React, { useEffect, useRef, useState } from 'react';
import { useWebRTCStreaming } from '@/hooks/useWebRTCStreaming';
import * as Tone from 'tone';
import { Button } from '@/components/ui/button';
import { Volume2 } from 'lucide-react';

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
  } = useWebRTCStreaming({ sessionId, canEdit, currentUserId });

  const [audioEnabled, setAudioEnabled] = useState(false);
  const audioRefs = useRef<Record<string, HTMLAudioElement | null>>({});

  const enableAudio = async () => {
    try {
      await Tone.start();
      setAudioEnabled(true);
      console.log('🔊 Audio context resumed for remote streams');
    } catch (err) {
      console.warn('Failed to enable audio:', err);
    }
  };

  useEffect(() => {
    participants.forEach((p) => {
      if (!p.stream) return;

      // Create or reuse audio element
      if (!audioRefs.current[p.user_id]) {
        const audioEl = document.createElement('audio');
        audioEl.autoplay = true;
        audioEl.setAttribute('playsinline', 'true');
        audioEl.muted = false;
        audioEl.style.display = 'none';
        document.body.appendChild(audioEl);
        audioRefs.current[p.user_id] = audioEl;
        console.log('🔊 Created audio element for', p.username || p.user_id);
      }

      const el = audioRefs.current[p.user_id]!;
      if (el.srcObject !== p.stream) {
        el.srcObject = p.stream as MediaStream;
        el.play().catch((err) => {
          console.warn('Auto-play blocked for', p.username, '- click Enable Audio button:', err);
        });
      }
    });

    // Cleanup audio elements for participants that left
    const currentIds = new Set(participants.map((p) => p.user_id));
    Object.keys(audioRefs.current).forEach((id) => {
      if (!currentIds.has(id)) {
        const el = audioRefs.current[id];
        if (el) {
          el.pause();
          el.srcObject = null;
          el.remove();
        }
        delete audioRefs.current[id];
      }
    });
  }, [participants]);

  // Show enable audio button if needed and there are participants
  if (!audioEnabled && participants.length > 0) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button
          onClick={enableAudio}
          className="bg-neon-cyan text-black hover:bg-neon-cyan/90 shadow-lg"
          size="lg"
        >
          <Volume2 className="w-4 h-4 mr-2" />
          Enable Audio
        </Button>
      </div>
    );
  }

  return null;
};


