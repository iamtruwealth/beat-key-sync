import React, { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import * as Tone from 'tone';

interface BackgroundWebRTCConnectorProps {
  sessionId: string;
  canEdit: boolean;
  currentUserId?: string;
  isStreamingAudio: boolean;
}

/**
 * BackgroundWebRTCConnector
 * 
 * Simple audio enabler for viewers. The audio-only streaming hook (useAudioOnlyStreaming) 
 * handles all WebRTC connections and audio delivery. This component just ensures 
 * the audio context is enabled with a user gesture for viewers.
 */
export const BackgroundWebRTCConnector: React.FC<BackgroundWebRTCConnectorProps> = ({
  canEdit,
  isStreamingAudio,
}) => {
  const [showJoinButton, setShowJoinButton] = useState(!canEdit);
  const [audioEnabled, setAudioEnabled] = useState(false);

  const enableAudio = async () => {
    console.log('🔊 Enabling audio context with user gesture');
    
    try {
      // Start Tone.js audio context (required for all browsers)
      await Tone.start();
      const toneContext = Tone.getContext();
      if (toneContext.state === 'suspended') {
        await toneContext.resume();
      }
      
      console.log('✅ Audio context enabled, state:', toneContext.state);
      setAudioEnabled(true);
      setShowJoinButton(false);
    } catch (err) {
      console.error('❌ Failed to enable audio:', err);
    }
  };

  // Hide button once audio is streaming (for viewers)
  useEffect(() => {
    if (!canEdit && isStreamingAudio && audioEnabled) {
      console.log('📻 Audio streaming active, hiding join button');
      setShowJoinButton(false);
    }
  }, [canEdit, isStreamingAudio, audioEnabled]);

  // Host doesn't need join button
  if (canEdit) {
    return null;
  }

  // Show join button for viewers
  if (showJoinButton) {
    return (
      <div className="fixed bottom-24 right-8 z-[9999] pointer-events-auto">
        <Button 
          onClick={enableAudio}
          className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90 shadow-lg shadow-green-500/50"
          size="lg"
        >
          🔊 Join Audio
        </Button>
      </div>
    );
  }

  return null;
};
