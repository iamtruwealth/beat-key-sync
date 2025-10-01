import React, { useEffect, useRef, useState } from 'react';
import { useWebRTCStreaming } from '@/hooks/useWebRTCStreaming';
import { Button } from '@/components/ui/button';
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
  const [showJoinButton, setShowJoinButton] = useState(true);
  const hostAudioRef = useRef<HostMasterAudio | null>(null);
  const viewerAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const pollTimerRef = useRef<number | null>(null);
  const participantsRef = useRef(participants);

  useEffect(() => {
    participantsRef.current = participants;
  }, [participants]);

  const tryAttachHostStream = async (): Promise<boolean> => {
    const hostParticipant = participantsRef.current.find(
      (p) => p.stream && (p.stream as MediaStream).getAudioTracks().length > 0
    );

    if (!hostParticipant || !hostParticipant.stream) {
      console.log('📻 Viewer: No host stream found in participants:', participantsRef.current.length);
      return false;
    }

    const hostStream = hostParticipant.stream as MediaStream;
    const audioTracks = hostStream.getAudioTracks();
    console.log('📻 Viewer: Found host stream with', audioTracks.length, 'audio tracks');

    if (!viewerAudioRef.current) {
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.setAttribute('playsinline', 'true');
      audioEl.muted = false;
      audioEl.volume = 1.0;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      viewerAudioRef.current = audioEl;
      console.log('📻 Viewer: Created audio element');
    }

    if (viewerAudioRef.current.srcObject !== hostStream) {
      viewerAudioRef.current.srcObject = hostStream;
      console.log('📻 Viewer: Set audio srcObject to host stream');
    }

    try {
      await viewerAudioRef.current.play();
      console.log('✅ Viewer: Audio playback started successfully');
      setShowJoinButton(false);
      return true;
    } catch (playError) {
      console.warn('⚠️ Viewer: Auto-play failed, using WebAudio fallback:', playError);
      try {
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        }
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        const source = audioContextRef.current.createMediaStreamSource(hostStream);
        source.connect(audioContextRef.current.destination);
        console.log('✅ Viewer: WebAudio fallback connected');
        setShowJoinButton(false);
        return true;
      } catch (webaudioErr) {
        console.error('❌ Viewer: WebAudio fallback failed:', webaudioErr);
        return false;
      }
    }
  };

  const enableAudio = async () => {
    try {
      console.log('🔊 Enabling audio - canEdit:', canEdit);
      
      // Resume Tone.js AudioContext first
      await Tone.start();
      const toneContext = Tone.getContext();
      if (toneContext.state === 'suspended') {
        await toneContext.resume();
      }
      console.log('🔊 Tone.js context started, state:', toneContext.state);

      if (canEdit) {
        // Host: Initialize HostMasterAudio
        if (!hostAudioRef.current) {
          hostAudioRef.current = HostMasterAudio.getInstance();
          await hostAudioRef.current.initialize();
          console.log('🎵 Host: HostMasterAudio initialized');
        }

        if (hostAudioRef.current.isInitialized) {
          hostAudioRef.current.connectToCookModeEngine();
          console.log('🎵 Host: CookModeEngine connected to master audio');
        }
        
        setShowJoinButton(false);
        setAudioEnabled(true);
        console.log('🎵 Host: Audio enabled, join button hidden');
      } else {
        // Viewer: Initialize audio context first to ensure it's ready
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext({ sampleRate: 24000 });
        }
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        console.log('📻 Viewer: AudioContext ready, state:', audioContextRef.current.state);
        
        // Try to attach host stream, then poll until available
        const success = await tryAttachHostStream();
        if (!success) {
          console.log('📻 Viewer: No host stream yet, polling every second...');
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = window.setInterval(async () => {
            console.log('📻 Viewer: Polling for host stream...');
            const ok = await tryAttachHostStream();
            if (ok && pollTimerRef.current) {
              window.clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
              console.log('📻 Viewer: Stream attached, polling stopped');
            }
          }, 1000);
        }
        setAudioEnabled(true);
      }
    } catch (err) {
      console.error('❌ Failed to enable audio:', err);
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
      // Viewer Mode: Receive master audio stream from host
      const hostStream = participants.find(
        (p) => p.stream && (p.stream as MediaStream).getAudioTracks().length > 0
      )?.stream as MediaStream | undefined;

      if (hostStream) {
        console.log('📻 Viewer: Receiving master audio stream from host', {
          audioTracks: hostStream.getAudioTracks().map((t) => t.id),
        });

        // Create hidden audio element for seamless playback
        if (!viewerAudioRef.current) {
          const audioEl = document.createElement('audio');
          audioEl.autoplay = true;
          audioEl.setAttribute('playsinline', 'true');
          audioEl.muted = false;
          audioEl.style.display = 'none';
          audioEl.style.position = 'fixed';
          audioEl.style.left = '-9999px';
          document.body.appendChild(audioEl);
          viewerAudioRef.current = audioEl;
          
          console.log('📻 Viewer: Created hidden audio element');
        }

        // Attach the master stream
        viewerAudioRef.current.srcObject = hostStream;
        
        // Start playback and hide button when audio starts
        viewerAudioRef.current.play()
          .then(() => {
            console.log('📻 Viewer: Master audio playback started successfully');
            setShowJoinButton(false);
          })
          .catch((err) => {
            console.warn('📻 Viewer: Auto-play blocked, trying WebAudio fallback:', err);
            try {
              if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext({ sampleRate: 24000 });
              }
              const source = audioContextRef.current.createMediaStreamSource(hostStream);
              source.connect(audioContextRef.current.destination);
              console.log('📻 Viewer: WebAudio fallback connected (effect)');
              setShowJoinButton(false);
            } catch (webaudioErr) {
              console.error('📻 Viewer: WebAudio fallback failed (effect):', webaudioErr);
              // Button stays visible; user can tap again
            }
          });

        // Handle audio events for debugging
        viewerAudioRef.current.addEventListener('loadstart', () => {
          console.log('📻 Viewer: Audio loading started');
        });
        
        viewerAudioRef.current.addEventListener('canplay', () => {
          console.log('📻 Viewer: Audio can start playing');
        });
        
        viewerAudioRef.current.addEventListener('playing', () => {
          console.log('📻 Viewer: Audio is playing');
          setShowJoinButton(false);
        });
      }
      
      return; // Viewers don't need additional processing
    }

    // Host Mode: Broadcasting master audio to all viewers
    console.log('📻 Host: Broadcasting master audio to', participants.length, 'viewers');
    
    // Ensure HostMasterAudio is connected for broadcasting
    if (canEdit && hostAudioRef.current && hostAudioRef.current.isInitialized) {
      console.log('📻 Host: Master audio system ready for broadcast');
    }
  }, [participants, audioEnabled, canEdit]);

  useEffect(() => {
    return () => {
      if (pollTimerRef.current) {
        window.clearInterval(pollTimerRef.current);
        pollTimerRef.current = null;
      }
    };
  }, []);

  // Show join button if needed
  if (showJoinButton) {
    return (
      <div className="fixed bottom-24 right-8 z-[9999] pointer-events-auto">
        <Button 
          onClick={enableAudio}
          className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90 shadow-lg shadow-green-500/50 animate-pulse"
          size="lg"
        >
          🔊 Join Audio
        </Button>
      </div>
    );
  }

  return null;
};
