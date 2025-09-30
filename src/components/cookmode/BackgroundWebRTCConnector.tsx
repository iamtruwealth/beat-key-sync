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
  // Safety: legacy variable to avoid runtime errors from stale bundles
  const overlayVisible = false;
  const hostAudioRef = useRef<HostMasterAudio | null>(null);
  const viewerAudioRef = useRef<HTMLAudioElement | null>(null);
  const audioBufferRef = useRef<AudioBuffer | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);

  const enableAudio = async () => {
    try {
      console.log('🔊 Enabling audio - canEdit:', canEdit);
      
      // Resume Tone.js AudioContext
      await Tone.start();
      console.log('🔊 Tone.js context started');

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
        console.log('🎵 Host: Join button hidden immediately');
      } else {
        // Viewer: Check for host stream immediately
        const hostStream = participants.find(
          (p) => p.stream && (p.stream as MediaStream).getAudioTracks().length > 0
        )?.stream as MediaStream | undefined;

        if (hostStream) {
          console.log('📻 Viewer: Found host stream, connecting audio');
          
          // Create and connect audio element
          if (!viewerAudioRef.current) {
            const audioEl = document.createElement('audio');
            audioEl.autoplay = true;
            audioEl.setAttribute('playsinline', 'true');
            audioEl.muted = false;
            audioEl.volume = 1.0;
            audioEl.style.display = 'none';
            document.body.appendChild(audioEl);
            viewerAudioRef.current = audioEl;
          }

          viewerAudioRef.current.srcObject = hostStream;
          
          try {
            await viewerAudioRef.current.play();
            console.log('📻 Viewer: Audio playback started');
            setShowJoinButton(false);
          } catch (playError) {
            console.warn('📻 Viewer: Auto-play failed, using WebAudio fallback:', playError);
            try {
              // Fallback: route MediaStream into WebAudio graph (allowed after Tone.start())
              if (!audioContextRef.current) {
                audioContextRef.current = new AudioContext({ sampleRate: 24000 });
              }
              const source = audioContextRef.current.createMediaStreamSource(hostStream);
              source.connect(audioContextRef.current.destination);
              console.log('📻 Viewer: WebAudio fallback connected');
              setShowJoinButton(false);
            } catch (webaudioErr) {
              console.error('📻 Viewer: WebAudio fallback failed:', webaudioErr);
              // Keep button visible for manual retry
            }
          }
        } else {
          console.log('📻 Viewer: No host stream found yet, waiting...');
          // Keep button visible until stream is available
        }
      }
      
      setAudioEnabled(true);
    } catch (err) {
      console.error('Failed to enable audio:', err);
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

  // Show join button if needed
  if (showJoinButton) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <Button 
          onClick={enableAudio}
          className="bg-primary hover:bg-primary/90 text-primary-foreground"
          size="lg"
        >
          📻 Join Audio Stream
        </Button>
      </div>
    );
  }

  return null;
};
