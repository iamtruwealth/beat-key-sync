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
  const [isConnecting, setIsConnecting] = useState(false);
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
      console.log('📻 Viewer: No host stream found. Participants:', participantsRef.current.length);
      return false;
    }

    const hostStream = hostParticipant.stream as MediaStream;
    const audioTracks = hostStream.getAudioTracks();
    console.log('📻 Viewer: Found host stream with', audioTracks.length, 'audio track(s)');

    if (!viewerAudioRef.current) {
      const audioEl = document.createElement('audio');
      audioEl.autoplay = true;
      audioEl.setAttribute('playsinline', 'true');
      audioEl.setAttribute('webkit-playsinline', 'true');
      audioEl.muted = false;
      audioEl.volume = 1.0;
      audioEl.style.display = 'none';
      document.body.appendChild(audioEl);
      viewerAudioRef.current = audioEl;
      console.log('📻 Viewer: Created audio element with iOS attributes');
    }

    if (viewerAudioRef.current.srcObject !== hostStream) {
      viewerAudioRef.current.srcObject = hostStream;
      console.log('📻 Viewer: Set audio srcObject to host stream');
    }

    try {
      // Critical: Use the already-initialized audioContext from user gesture
      if (!audioContextRef.current) {
        console.error('❌ Viewer: AudioContext not initialized!');
        return false;
      }

      if (audioContextRef.current.state === 'suspended') {
        await audioContextRef.current.resume();
        console.log('📻 Viewer: Resumed suspended AudioContext in tryAttach');
      }

      // Try HTML5 audio first
      await viewerAudioRef.current.play();
      console.log('✅ Viewer: HTML5 audio playback started successfully');
      setShowJoinButton(false);
      setIsConnecting(false);
      return true;
    } catch (playError) {
      console.warn('⚠️ Viewer: HTML5 auto-play failed, using WebAudio:', playError);
      
      // Fallback to WebAudio API (works better on iOS)
      try {
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
        }
        const source = audioContextRef.current.createMediaStreamSource(hostStream);
        source.connect(audioContextRef.current.destination);
        console.log('✅ Viewer: WebAudio fallback connected and playing');
        setShowJoinButton(false);
        setIsConnecting(false);
        return true;
      } catch (webaudioErr) {
        console.error('❌ Viewer: WebAudio fallback failed:', webaudioErr);
        setIsConnecting(false);
        return false;
      }
    }
  };

  const enableAudio = async () => {
    if (isConnecting) {
      console.log('⏳ Already connecting, ignoring click');
      return;
    }
    
    setIsConnecting(true);
    console.log('🔊 enableAudio clicked - canEdit:', canEdit);
    
    try {
      // Critical for iOS: Start Tone.js AudioContext with user gesture
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
        // Viewer: Initialize audio context with user gesture (critical for iOS)
        if (!audioContextRef.current) {
          audioContextRef.current = new AudioContext({ sampleRate: 24000 });
          console.log('📻 Viewer: Created new AudioContext');
        }
        if (audioContextRef.current.state === 'suspended') {
          await audioContextRef.current.resume();
          console.log('📻 Viewer: Resumed suspended AudioContext');
        }
        console.log('📻 Viewer: AudioContext state:', audioContextRef.current.state);
        
        // Create a dummy oscillator to keep iOS audio active
        const oscillator = audioContextRef.current.createOscillator();
        const gainNode = audioContextRef.current.createGain();
        gainNode.gain.value = 0; // Silent
        oscillator.connect(gainNode);
        gainNode.connect(audioContextRef.current.destination);
        oscillator.start();
        oscillator.stop(audioContextRef.current.currentTime + 0.1);
        console.log('📻 Viewer: Dummy oscillator played for iOS');
        
        setAudioEnabled(true);
        
        // Try to attach host stream immediately
        const success = await tryAttachHostStream();
        if (success) {
          console.log('✅ Viewer: Audio stream attached successfully');
        } else {
          console.log('📻 Viewer: No host stream yet, will poll...');
          // Start polling for host stream
          if (pollTimerRef.current) window.clearInterval(pollTimerRef.current);
          pollTimerRef.current = window.setInterval(async () => {
            console.log('📻 Viewer: Polling for host stream... participants:', participantsRef.current.length);
            const ok = await tryAttachHostStream();
            if (ok && pollTimerRef.current) {
              window.clearInterval(pollTimerRef.current);
              pollTimerRef.current = null;
              console.log('✅ Viewer: Stream attached via polling, stopped polling');
            }
          }, 1000);
        }
      }
    } catch (err) {
      console.error('❌ Failed to enable audio:', err);
      setIsConnecting(false);
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
      <div 
        className="fixed bottom-24 right-8 z-[9999]"
        style={{ 
          pointerEvents: 'auto',
          touchAction: 'manipulation',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        <Button 
          onClick={enableAudio}
          onTouchStart={(e) => {
            e.preventDefault();
            console.log('👆 Touch started on Join Audio button');
          }}
          onTouchEnd={(e) => {
            e.preventDefault();
            console.log('👆 Touch ended, calling enableAudio');
            enableAudio();
          }}
          disabled={isConnecting}
          className="bg-gradient-to-r from-green-500 to-emerald-500 text-white hover:opacity-90 shadow-lg shadow-green-500/50 animate-pulse disabled:opacity-50"
          size="lg"
        >
          {isConnecting ? '⏳ Connecting...' : '🔊 Join Audio'}
        </Button>
      </div>
    );
  }

  return null;
};
