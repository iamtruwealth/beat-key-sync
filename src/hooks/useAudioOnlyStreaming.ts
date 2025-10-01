import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useViewerAudioStream } from './webrtc/useViewerAudioStream';

interface UseAudioOnlyStreamingProps {
  sessionId: string;
  isHost: boolean;
  currentUserId?: string;
}

interface RemoteParticipant {
  user_id: string;
  username: string;
  peerConnection?: RTCPeerConnection;
}

export const useAudioOnlyStreaming = ({ sessionId, isHost, currentUserId }: UseAudioOnlyStreamingProps) => {
  const [isStreamingAudio, setIsStreamingAudio] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  const [sessionAudioStream, setSessionAudioStream] = useState<MediaStream | null>(null);
  
  const signalingChannel = useRef<any>(null);
  const { playRemoteStream, stopAudioPlayback } = useViewerAudioStream();
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  // Setup signaling for audio-only WebRTC
  const setupSignaling = useCallback(() => {
    const channel = supabase.channel(`audio-only-${sessionId}`);

    channel
      .on('broadcast', { event: 'audio-offer' }, async ({ payload }) => {
        if (payload.to === currentUserId && payload.from !== currentUserId) {
          await handleOffer(payload.from, payload.offer);
        }
      })
      .on('broadcast', { event: 'audio-answer' }, async ({ payload }) => {
        if (payload.to === currentUserId && payload.from !== currentUserId) {
          await handleAnswer(payload.from, payload.answer);
        }
      })
      .on('broadcast', { event: 'audio-ice-candidate' }, async ({ payload }) => {
        if (payload.to === currentUserId && payload.from !== currentUserId) {
          await handleIceCandidate(payload.from, payload.candidate);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        console.log('🎵 Audio presence sync:', presenceState);
        updateParticipantsList(presenceState);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('🎵 Viewer joined audio session:', newPresences);
        newPresences.forEach((presence: any) => {
          if (presence.user_id !== currentUserId && sessionAudioStream && isHost) {
            createPeerConnection(presence.user_id, presence.username, true);
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('🎵 Viewer left audio session:', leftPresences);
        leftPresences.forEach((presence: any) => {
          removePeerConnection(presence.user_id);
        });
      })
      .subscribe();

    signalingChannel.current = channel;
  }, [sessionId, currentUserId, isHost, sessionAudioStream]);

  // Create peer connection for a viewer
  const createPeerConnection = async (userId: string, username: string, isInitiator: boolean) => {
    try {
      const peerConnection = new RTCPeerConnection({ iceServers });
      
      // Add session audio tracks if we're the host
      if (sessionAudioStream && isHost) {
        sessionAudioStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, sessionAudioStream);
        });
        console.log('🎵 Added session audio tracks for', username);
      }

      // Handle incoming audio (for viewers)
      peerConnection.ontrack = async (event) => {
        console.log('🎵 Viewer: Received remote audio stream from host');
        const [remoteStream] = event.streams;
        
        try {
          await playRemoteStream(remoteStream);
          console.log('✅ Viewer: Successfully playing remote audio stream');
        } catch (error) {
          console.error('❌ Viewer: Failed to play remote audio:', error);
          toast.error('Failed to play audio. Please click "Join Audio" button.');
        }
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && signalingChannel.current) {
          signalingChannel.current.send({
            type: 'broadcast',
            event: 'audio-ice-candidate',
            payload: {
              from: currentUserId,
              to: userId,
              candidate: event.candidate
            }
          });
        }
      };

      setRemoteParticipants(prev => {
        const updated = new Map(prev);
        updated.set(userId, { 
          user_id: userId, 
          username, 
          peerConnection 
        });
        return updated;
      });

      // If initiator (host), create offer
      if (isInitiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        signalingChannel.current?.send({
          type: 'broadcast',
          event: 'audio-offer',
          payload: {
            from: currentUserId,
            to: userId,
            offer: offer
          }
        });
      }

      return peerConnection;
    } catch (error) {
      console.error('Error creating audio peer connection:', error);
      toast.error('Failed to connect audio to participant');
    }
  };

  const handleOffer = async (fromUserId: string, offer: RTCSessionDescriptionInit) => {
    try {
      let participant = remoteParticipants.get(fromUserId);
      let peerConnection = participant?.peerConnection;

      if (!peerConnection) {
        const presenceState = signalingChannel.current?.presenceState() || {};
        const fromPresence = Object.values(presenceState).flat().find((p: any) => p.user_id === fromUserId) as any;
        if (fromPresence) {
          peerConnection = await createPeerConnection(fromUserId, fromPresence.username, false);
        }
      }

      if (peerConnection) {
        await peerConnection.setRemoteDescription(offer);
        const answer = await peerConnection.createAnswer();
        await peerConnection.setLocalDescription(answer);

        signalingChannel.current?.send({
          type: 'broadcast',
          event: 'audio-answer',
          payload: {
            from: currentUserId,
            to: fromUserId,
            answer: answer
          }
        });
      }
    } catch (error) {
      console.error('Error handling audio offer:', error);
    }
  };

  const handleAnswer = async (fromUserId: string, answer: RTCSessionDescriptionInit) => {
    try {
      const participant = remoteParticipants.get(fromUserId);
      if (participant?.peerConnection) {
        await participant.peerConnection.setRemoteDescription(answer);
      }
    } catch (error) {
      console.error('Error handling audio answer:', error);
    }
  };

  const handleIceCandidate = async (fromUserId: string, candidate: RTCIceCandidateInit) => {
    try {
      const participant = remoteParticipants.get(fromUserId);
      if (participant?.peerConnection) {
        await participant.peerConnection.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('Error handling audio ICE candidate:', error);
    }
  };

  const removePeerConnection = (userId: string) => {
    setRemoteParticipants(prev => {
      const updated = new Map(prev);
      const participant = updated.get(userId);
      if (participant?.peerConnection) {
        participant.peerConnection.close();
      }
      updated.delete(userId);
      return updated;
    });
  };

  const updateParticipantsList = (presenceState: any) => {
    setRemoteParticipants(prev => {
      const updated = new Map(prev);
      const currentParticipants = new Set();

      Object.keys(presenceState).forEach(key => {
        const presences = presenceState[key] as any[];
        presences.forEach(presence => {
          if (presence.user_id !== currentUserId) {
            currentParticipants.add(presence.user_id);
            if (!updated.has(presence.user_id)) {
              updated.set(presence.user_id, {
                user_id: presence.user_id,
                username: presence.username
              });
            }
          }
        });
      });

      Array.from(updated.keys()).forEach(userId => {
        if (!currentParticipants.has(userId)) {
          const participant = updated.get(userId);
          if (participant?.peerConnection) {
            participant.peerConnection.close();
          }
          updated.delete(userId);
        }
      });

      return updated;
    });
  };

  // Start audio streaming (host only)
  const startAudioStreaming = useCallback(async () => {
    if (!isHost) return;
    
    try {
      console.log('🎵 Starting audio-only stream for session');
      
      // Get the master audio stream from HostMasterAudio (radio broadcast)
      const { HostMasterAudio } = await import('@/lib/HostMasterAudio');
      const hostMaster = HostMasterAudio.getInstance();
      
      if (!hostMaster.isInitialized) {
        await hostMaster.initialize();
        hostMaster.connectToCookModeEngine();
      }
      
      const sessionAudio = hostMaster.getMasterStream();
      
      if (!sessionAudio) {
        toast.error('No audio available. Make sure audio is playing.');
        return;
      }

      setSessionAudioStream(sessionAudio);
      setupSignaling();

      // Join presence
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('producer_name')
        .eq('id', user?.id)
        .single();

      if (signalingChannel.current) {
        await signalingChannel.current.track({
          user_id: user?.id,
          username: profile?.producer_name || 'Host',
          streaming: true
        });

        // Create peer connections for existing viewers
        const presenceState = signalingChannel.current.presenceState?.() || {};
        const others = (Object.values(presenceState).flat() as any[]);
        for (const presence of others) {
          if (presence.user_id && presence.user_id !== user?.id) {
            await createPeerConnection(presence.user_id, presence.username || 'Viewer', true);
          }
        }
      }

      setIsStreamingAudio(true);
      toast.success('Audio streaming started - viewers can now hear the session');
      
    } catch (error) {
      console.error('Error starting audio stream:', error);
      toast.error('Failed to start audio streaming');
    }
  }, [isHost, setupSignaling, currentUserId]);

  // Stop audio streaming
  const stopAudioStreaming = useCallback(async () => {
    try {
      remoteParticipants.forEach(participant => {
        if (participant.peerConnection) {
          participant.peerConnection.close();
        }
      });

      setRemoteParticipants(new Map());
      setSessionAudioStream(null);
      
      // Clean up viewer audio
      stopAudioPlayback();
      console.log('🎵 Viewer: Cleaned up audio');
      
      if (signalingChannel.current) {
        signalingChannel.current.untrack();
        signalingChannel.current.unsubscribe();
      }

      setIsStreamingAudio(false);
      toast.success('Audio streaming stopped');
      
    } catch (error) {
      console.error('Error stopping audio stream:', error);
    }
  }, [remoteParticipants]);

  // Auto-join as viewer
  useEffect(() => {
    if (isHost || !sessionId || !currentUserId) return;

    console.log('🎵 Joining as audio viewer');
    setupSignaling();

    const joinAsViewer = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('producer_name')
        .eq('id', user?.id)
        .single();

      if (signalingChannel.current) {
        await signalingChannel.current.track({
          user_id: user?.id,
          username: profile?.producer_name || 'Viewer',
          streaming: false
        });
      }
    };

    joinAsViewer();

    return () => {
      // Cleanup viewer audio on unmount
      stopAudioPlayback();
      console.log('🎵 Viewer: Cleaned up audio on unmount');
      
      if (signalingChannel.current) {
        signalingChannel.current.unsubscribe();
      }
    };
  }, [sessionId, currentUserId, isHost, setupSignaling]);

  return {
    isStreamingAudio,
    viewerCount: remoteParticipants.size,
    startAudioStreaming,
    stopAudioStreaming
  };
};

