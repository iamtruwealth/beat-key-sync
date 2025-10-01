import { useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { HostMasterAudio } from '@/lib/HostMasterAudio';
import { useWebRTCConnection, Participant } from './webrtc/useWebRTCConnection';
import { useWebRTCSignaling } from './webrtc/useWebRTCSignaling';
import { useHostAudioStream } from './webrtc/useHostAudioStream';
import { useViewerAudioStream } from './webrtc/useViewerAudioStream';

interface UseWebRTCStreamingProps {
  sessionId: string;
  canEdit: boolean;
  currentUserId?: string;
}

export const useWebRTCStreaming = ({ sessionId, canEdit, currentUserId }: UseWebRTCStreamingProps) => {
  const {
    participants,
    participantsMap,
    createPeerConnection,
    addTrackToPeer,
    updateParticipantStream,
    removePeerConnection,
    closeAllConnections,
    masterTrackIdRef
  } = useWebRTCConnection();

  const {
    isStreaming,
    streamEnabled,
    localStream,
    localVideoRef,
    startStreaming: startHostStreaming,
    stopStreaming: stopHostStreaming,
    toggleVideo,
    toggleAudio,
    getMasterAudioTrack,
    getMasterAudioStream
  } = useHostAudioStream();

  const {
    playRemoteStream
  } = useViewerAudioStream();

  // Handle incoming track from peer
  const handleIncomingTrack = useCallback((userId: string, stream: MediaStream) => {
    updateParticipantStream(userId, stream);
    
    // If we're a viewer, play the audio
    if (!canEdit && stream.getAudioTracks().length > 0) {
      console.log('👀 Viewer received audio stream, starting playback');
      playRemoteStream(stream).catch(error => {
        console.error('Failed to play remote stream:', error);
        toast.error('Failed to play audio stream');
      });
    }
  }, [canEdit, updateParticipantStream, playRemoteStream]);

  // Signaling callbacks
  const handleOffer = useCallback(async (fromUserId: string, offer: RTCSessionDescriptionInit, getPresenceState: () => any) => {
    let peerConnection = participantsMap.get(fromUserId)?.peerConnection;

    if (!peerConnection) {
      const presenceState = getPresenceState();
      const fromPresence = Object.values(presenceState).flat().find((p: any) => p.user_id === fromUserId) as any;
      
      if (fromPresence) {
        peerConnection = createPeerConnection(
          fromUserId,
          fromPresence.username,
          (stream) => handleIncomingTrack(fromUserId, stream),
          (candidate) => signalingRef.current?.sendIceCandidate(fromUserId, candidate)
        );
      }
    }

    if (peerConnection) {
      await peerConnection.setRemoteDescription(offer);
      const answer = await peerConnection.createAnswer();
      await peerConnection.setLocalDescription(answer);
      signalingRef.current?.sendAnswer(fromUserId, answer);
    }
  }, [participantsMap, createPeerConnection, handleIncomingTrack]);

  const handleAnswer = useCallback(async (fromUserId: string, answer: RTCSessionDescriptionInit) => {
    const participant = participantsMap.get(fromUserId);
    if (participant?.peerConnection) {
      await participant.peerConnection.setRemoteDescription(answer);
    }
  }, [participantsMap]);

  const handleIceCandidate = useCallback(async (fromUserId: string, candidate: RTCIceCandidateInit) => {
    const participant = participantsMap.get(fromUserId);
    if (participant?.peerConnection) {
      await participant.peerConnection.addIceCandidate(candidate);
    }
  }, [participantsMap]);

  const handleUserJoined = useCallback(async (userId: string, username: string) => {
    console.log(`👤 User joined: ${username}`);
    
    const pc = createPeerConnection(
      userId,
      username,
      (stream) => handleIncomingTrack(userId, stream),
      (candidate) => signalingRef.current?.sendIceCandidate(userId, candidate),
      async () => {
        if (!pc) return;
        console.log('🌀 Creating offer for', username);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        signalingRef.current?.sendOffer(userId, offer);
      }
    );

    // If we're the host and have a master audio track, add it to this new peer
    if (canEdit && getMasterAudioTrack() && getMasterAudioStream()) {
      const track = getMasterAudioTrack()!;
      const stream = getMasterAudioStream()!;
      addTrackToPeer(userId, track, stream);
    }

    // Add local video track if available
    if (localStream) {
      localStream.getTracks().forEach(track => {
        if (track.kind === 'video') {
          addTrackToPeer(userId, track, localStream);
        }
      });
    }
  }, [canEdit, localStream, createPeerConnection, addTrackToPeer, handleIncomingTrack, getMasterAudioTrack, getMasterAudioStream]);

  const handleUserLeft = useCallback((userId: string) => {
    console.log(`👤 User left: ${userId}`);
    removePeerConnection(userId);
  }, [removePeerConnection]);

  const handleSyncRequest = useCallback((fromUserId: string) => {
    if (!canEdit) return;
    
    const hostMaster = HostMasterAudio.getInstance();
    if (hostMaster.isInitialized) {
      const syncData = {
        currentTime: hostMaster.getCurrentPlaybackTime(),
        loopDuration: hostMaster.getLoopDuration(),
        isPlaying: hostMaster.hasPlayer
      };
      signalingRef.current?.sendSyncResponse(fromUserId, syncData);
    }
  }, [canEdit]);

  // Use ref to avoid circular dependency
  const signalingRef = { current: null as ReturnType<typeof useWebRTCSignaling> | null };
  
  const signaling = useWebRTCSignaling(sessionId, currentUserId, canEdit, {
    onOffer: (from, offer) => handleOffer(from, offer, () => signalingRef.current?.getPresenceState() || {}),
    onAnswer: handleAnswer,
    onIceCandidate: handleIceCandidate,
    onUserJoined: handleUserJoined,
    onUserLeft: handleUserLeft,
    onSyncRequest: handleSyncRequest
  });
  
  signalingRef.current = signaling;

  // Start streaming as host
  const startStreaming = useCallback(async () => {
    if (!canEdit) return;

    await startHostStreaming((track, stream) => {
      // Add master audio track to all existing peers
      participantsMap.forEach((participant, userId) => {
        if (masterTrackIdRef.current !== track.id) {
          addTrackToPeer(userId, track, stream);
        }
      });
      masterTrackIdRef.current = track.id;
    });

    // Get user info and track presence
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('producer_name, first_name, last_name')
      .eq('id', user?.id)
      .single();

    const username = profile?.producer_name || 
                    `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
                    'Host';

    await signaling.trackPresence(username, true, 'host');

    // Connect to existing participants
    const presenceState = signaling.getPresenceState();
    const others = Object.values(presenceState).flat() as any[];
    for (const presence of others) {
      if (presence.user_id && presence.user_id !== user?.id) {
        await handleUserJoined(presence.user_id, presence.username || 'Viewer');
      }
    }
  }, [canEdit, startHostStreaming, signaling, participantsMap, addTrackToPeer, handleUserJoined, masterTrackIdRef]);

  // Start as viewer
  const startAsViewer = useCallback(async () => {
    if (canEdit) return;

    console.log('👀 Starting as viewer');
    
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = await supabase
      .from('profiles')
      .select('producer_name, first_name, last_name')
      .eq('id', user?.id)
      .single();

    const username = profile?.producer_name || 
                    `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
                    'Viewer';

    await signaling.trackPresence(username, false, 'viewer');
    signaling.sendSyncRequest();
    
    console.log('✅ Viewer connected');
  }, [canEdit, signaling]);

  // Stop streaming
  const stopStreaming = useCallback(() => {
    stopHostStreaming();
    closeAllConnections();
    signaling.untrackPresence();
  }, [stopHostStreaming, closeAllConnections, signaling]);

  // Setup and cleanup
  useEffect(() => {
    if (!sessionId || !currentUserId) return;

    console.log('🎬 Setting up WebRTC for session:', sessionId, 'canEdit:', canEdit);
    signaling.setupSignaling();
    
    // Auto-start as viewer for guests
    if (!canEdit) {
      const timer = setTimeout(() => {
        console.log('🎬 Auto-starting viewer mode for guest');
        startAsViewer();
      }, 1500);
      
      return () => {
        clearTimeout(timer);
        signaling.cleanup();
      };
    }

    return () => {
      signaling.cleanup();
      stopStreaming();
    };
  }, [sessionId, currentUserId, canEdit, signaling, startAsViewer, stopStreaming]);

  return {
    localStream,
    participants,
    isStreaming,
    streamEnabled,
    localVideoRef,
    startStreaming,
    startAsViewer,
    stopStreaming,
    toggleVideo,
    toggleAudio
  };
};

// Re-export Participant type for backward compatibility
export type { Participant };
