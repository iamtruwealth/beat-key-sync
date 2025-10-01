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
  console.log('🎵 useAudioOnlyStreaming initialized:', { 
    sessionId: sessionId || '(empty)', 
    isHost, 
    currentUserId: currentUserId || '(undefined)' 
  });
  
  const [isStreamingAudio, setIsStreamingAudio] = useState(false);
  const [remoteParticipants, setRemoteParticipants] = useState<Map<string, RemoteParticipant>>(new Map());
  const [sessionAudioStream, setSessionAudioStream] = useState<MediaStream | null>(null);
  
  const signalingChannel = useRef<any>(null);
  const sessionAudioStreamRef = useRef<MediaStream | null>(null);
  const channelSubscribedRef = useRef<boolean>(false);
  const { playRemoteStream, stopAudioPlayback } = useViewerAudioStream();
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  // Create peer connection for a viewer
  const createPeerConnection = useCallback(async (userId: string, username: string, isInitiator: boolean) => {
    try {
      const peerConnection = new RTCPeerConnection({ iceServers });
      
      // Add session audio tracks if we're the host
      if (sessionAudioStreamRef.current && isHost) {
        const tracks = sessionAudioStreamRef.current.getTracks();
        console.log('🎵 Host: Adding', tracks.length, 'audio tracks for', username);
        tracks.forEach(track => {
          peerConnection.addTrack(track, sessionAudioStreamRef.current!);
          console.log('🎵 Added track:', track.kind, track.id);
        });
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
          console.log('🎵 ICE candidate generated for', username);
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

      // Monitor connection state
      peerConnection.onconnectionstatechange = () => {
        console.log('🎵 Connection state for', username, ':', peerConnection.connectionState);
      };

      peerConnection.oniceconnectionstatechange = () => {
        console.log('🎵 ICE connection state for', username, ':', peerConnection.iceConnectionState);
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
        console.log('🎵 Host: Created offer for', username, 'with', peerConnection.getSenders().length, 'senders');
        
        signalingChannel.current?.send({
          type: 'broadcast',
          event: 'audio-offer',
          payload: {
            from: currentUserId,
            to: userId,
            offer: offer
          }
        });
        console.log('🎵 Host: Sent offer to', username);
      }

      return peerConnection;
    } catch (error) {
      console.error('Error creating audio peer connection:', error);
      toast.error('Failed to connect audio to participant');
    }
  }, [isHost, currentUserId, playRemoteStream]);

  const handleOffer = useCallback(async (fromUserId: string, offer: RTCSessionDescriptionInit) => {
    try {
      // The peer connection should already exist from the 'sync' or 'join' event.
      const participant = remoteParticipants.get(fromUserId);
      const peerConnection = participant?.peerConnection;

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
      } else {
        console.error('❌ Viewer: Received an offer but have no peer connection for user', fromUserId);
      }
    } catch (error) {
      console.error('Error handling audio offer:', error);
    }
  }, [remoteParticipants, currentUserId]);

  const handleAnswer = useCallback(async (fromUserId: string, answer: RTCSessionDescriptionInit) => {
    try {
      const participant = remoteParticipants.get(fromUserId);
      if (participant?.peerConnection) {
        await participant.peerConnection.setRemoteDescription(answer);
      }
    } catch (error) {
      console.error('Error handling audio answer:', error);
    }
  }, [remoteParticipants]);

  const handleIceCandidate = useCallback(async (fromUserId: string, candidate: RTCIceCandidateInit) => {
    try {
      const participant = remoteParticipants.get(fromUserId);
      if (participant?.peerConnection) {
        await participant.peerConnection.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('Error handling audio ICE candidate:', error);
    }
  }, [remoteParticipants]);

  const removePeerConnection = useCallback((userId: string) => {
    setRemoteParticipants(prev => {
      const updated = new Map(prev);
      const participant = updated.get(userId);
      if (participant?.peerConnection) {
        participant.peerConnection.close();
      }
      updated.delete(userId);
      return updated;
    });
  }, []);

  const updateParticipantsList = useCallback((presenceState: any) => {
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
  }, [currentUserId]);

  // Setup signaling for audio-only WebRTC (defined after all handlers)
  const setupSignaling = useCallback(() => {
    // Reuse existing channel if already created
    if (signalingChannel.current) {
      return signalingChannel.current;
    }

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

        const allParticipants = (Object.values(presenceState).flat() as any[]);

        // VIEWER LOGIC: If I'm a viewer, find the host and create a peer connection in preparation for an offer.
        if (!isHost) {
          const hostPresence = allParticipants.find((p: any) => p.streaming === true);
          if (hostPresence && !remoteParticipants.has(hostPresence.user_id)) {
            console.log('🎵 Viewer (on sync): Detected host, creating peer connection.');
            createPeerConnection(hostPresence.user_id, hostPresence.username, false);
          }
        }

        // HOST LOGIC: If I am the host with an audio stream, create connections for everyone already here
        if (isHost && sessionAudioStreamRef.current) {
          allParticipants.forEach((presence: any) => {
            if (presence.user_id !== currentUserId) {
              console.log('🎵 Host (on sync): Creating peer connection for existing viewer:', presence.username);
              createPeerConnection(presence.user_id, presence.username, true);
            }
          });
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('🎵 User joined audio session:', newPresences);
        newPresences.forEach((presence: any) => {
          // VIEWER LOGIC: If the host is the one who just joined, create a peer connection.
          if (!isHost && presence.streaming === true && !remoteParticipants.has(presence.user_id)) {
            console.log('🎵 Viewer (on join): Host has arrived, creating peer connection.');
            createPeerConnection(presence.user_id, presence.username, false);
          }
          
          // HOST LOGIC: Create connection for new viewers, but only if streaming
          if (isHost && sessionAudioStreamRef.current && presence.user_id !== currentUserId) {
            console.log('🎵 Host: Creating peer connection for new viewer:', presence.username);
            createPeerConnection(presence.user_id, presence.username, true);
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('🎵 Viewer left audio session:', leftPresences);
        leftPresences.forEach((presence: any) => {
          removePeerConnection(presence.user_id);
        });
      });

    signalingChannel.current = channel;
    return channel;
  }, [sessionId, currentUserId, isHost, handleOffer, handleAnswer, handleIceCandidate, updateParticipantsList, createPeerConnection, removePeerConnection]);

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

      const tracks = sessionAudio.getTracks();
      console.log('🎵 Host: Got master stream with', tracks.length, 'tracks');
      tracks.forEach((track, idx) => {
        console.log(`🎵 Track ${idx}:`, {
          kind: track.kind,
          id: track.id,
          enabled: track.enabled,
          muted: track.muted,
          readyState: track.readyState
        });
      });

      if (tracks.length === 0) {
        toast.error('Audio stream has no tracks. Try starting playback first.');
        return;
      }

      setSessionAudioStream(sessionAudio);
      sessionAudioStreamRef.current = sessionAudio;
      const channel = setupSignaling();

      const trackHostAndOffer = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('profiles')
          .select('producer_name')
          .eq('id', user?.id)
          .single();

        await channel.track({
          user_id: user?.id,
          username: profile?.producer_name || 'Host',
          streaming: true
        });

        console.log('🎵 Host: Announced streaming presence. Offers will be sent via sync/join events.');
        // DO NOT create offers here - let the 'sync' and 'join' events handle it
        // This prevents race conditions where viewers aren't ready to receive offers
      };

      if (channelSubscribedRef.current) {
        console.log('🎵 Host: Channel already subscribed, tracking presence immediately');
        await trackHostAndOffer();
      } else {
        channel.subscribe(async (status) => {
          console.log('🎵 Host: Channel subscription status:', status);
          if (status === 'SUBSCRIBED') {
            channelSubscribedRef.current = true;
            await trackHostAndOffer();
          }
        });
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
      sessionAudioStreamRef.current = null;
      
      // Clean up viewer audio
      stopAudioPlayback();
      console.log('🎵 Viewer: Cleaned up audio');
      
      if (signalingChannel.current) {
        signalingChannel.current.untrack();
        signalingChannel.current.unsubscribe();
        signalingChannel.current = null;
        channelSubscribedRef.current = false;
      }

      setIsStreamingAudio(false);
      toast.success('Audio streaming stopped');
      
    } catch (error) {
      console.error('Error stopping audio stream:', error);
    }
  }, [remoteParticipants]);

  // Auto-join as viewer
  useEffect(() => {
    if (isHost || !sessionId || !currentUserId) {
      return;
    }

    console.log('🎵 Viewer: Starting auto-join for session:', sessionId);
    
    // Use the single, stable setupSignaling function and subscribe once
    const channel = setupSignaling();

    const ensureViewerTracked = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('profiles')
        .select('producer_name')
        .eq('id', user?.id)
        .single();

      await channel.track({
        user_id: user?.id,
        username: profile?.producer_name || 'Viewer',
        streaming: false
      });
      console.log('🎵 Viewer: Joined audio session and tracking presence');
    };

    if (channelSubscribedRef.current) {
      console.log('🎵 Viewer: Channel already subscribed, tracking immediately');
      ensureViewerTracked();
    } else {
      channel.subscribe(async (status) => {
        console.log('🎵 Viewer: Channel subscription status:', status);
        if (status === 'SUBSCRIBED') {
          channelSubscribedRef.current = true;
          await ensureViewerTracked();
        }
      });
    }

    return () => {
      // Cleanup viewer audio on unmount
      stopAudioPlayback();
      console.log('🎵 Viewer: Cleaned up audio on unmount');
      
      if (signalingChannel.current) {
        signalingChannel.current.untrack();
        signalingChannel.current.unsubscribe();
      }
    };
  }, [isHost, sessionId, currentUserId, setupSignaling, stopAudioPlayback]);

  return {
    isStreamingAudio,
    viewerCount: remoteParticipants.size,
    startAudioStreaming,
    stopAudioStreaming
  };
};

