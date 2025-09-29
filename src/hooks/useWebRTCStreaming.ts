import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sessionLoopEngine } from '@/lib/sessionLoopEngine';

interface Participant {
  user_id: string;
  username: string;
  stream?: MediaStream;
  peerConnection?: RTCPeerConnection;
}

interface UseWebRTCStreamingProps {
  sessionId: string;
  canEdit: boolean;
  currentUserId?: string;
}

export const useWebRTCStreaming = ({ sessionId, canEdit, currentUserId }: UseWebRTCStreamingProps) => {
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamEnabled, setStreamEnabled] = useState({ video: true, audio: true });
  
  const signalingChannel = useRef<any>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const externalAudioTrackRef = useRef<MediaStreamTrack | null>(null);
  const externalAudioStreamRef = useRef<MediaStream | null>(null);

  // ICE servers configuration
  const iceServers = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' }
  ];

  // Setup signaling channel for WebRTC
  const setupSignaling = useCallback(() => {
    const channel = supabase.channel(`webrtc-${sessionId}`, {
      config: { presence: { key: sessionId } }
    });

    channel
      .on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
        if (payload.to === currentUserId && payload.from !== currentUserId) {
          await handleOffer(payload.from, payload.offer);
        }
      })
      .on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
        if (payload.to === currentUserId && payload.from !== currentUserId) {
          await handleAnswer(payload.from, payload.answer);
        }
      })
      .on('broadcast', { event: 'webrtc-ice-candidate' }, async ({ payload }) => {
        if (payload.to === currentUserId && payload.from !== currentUserId) {
          await handleIceCandidate(payload.from, payload.candidate);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        console.log('📹 WebRTC presence sync:', presenceState);
        updateParticipantsList(presenceState);
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('📹 User joined video session:', newPresences);
        newPresences.forEach((presence: any) => {
          if (presence.user_id !== currentUserId && localStream) {
            createPeerConnection(presence.user_id, presence.username, true);
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('📹 User left video session:', leftPresences);
        leftPresences.forEach((presence: any) => {
          removePeerConnection(presence.user_id);
        });
      })
      .subscribe();

    signalingChannel.current = channel;
  }, [sessionId, currentUserId]);

  // Create peer connection for a participant
  const createPeerConnection = async (userId: string, username: string, isInitiator: boolean) => {
    try {
      const peerConnection = new RTCPeerConnection({ iceServers });
      
      // Add local stream tracks
      if (localStream) {
        localStream.getTracks().forEach(track => {
          peerConnection.addTrack(track, localStream);
        });
      }
      // Also add external mixed audio track if provided
      if (externalAudioTrackRef.current && externalAudioStreamRef.current) {
        peerConnection.addTrack(externalAudioTrackRef.current, externalAudioStreamRef.current);
      }

      // Handle incoming stream
      peerConnection.ontrack = (event) => {
        console.log('📹 Received remote stream from:', username);
        const [remoteStream] = event.streams;
        setParticipants(prev => {
          const updated = new Map(prev);
          const participant = updated.get(userId) || { user_id: userId, username };
          participant.stream = remoteStream;
          participant.peerConnection = peerConnection;
          updated.set(userId, participant);
          return updated;
        });
      };

      // Handle ICE candidates
      peerConnection.onicecandidate = (event) => {
        if (event.candidate && signalingChannel.current) {
          signalingChannel.current.send({
            type: 'broadcast',
            event: 'webrtc-ice-candidate',
            payload: {
              from: currentUserId,
              to: userId,
              candidate: event.candidate
            }
          });
        }
      };

      // Connection state logging
      peerConnection.onconnectionstatechange = () => {
        console.log(`📹 Connection with ${username}:`, peerConnection.connectionState);
      };

      setParticipants(prev => {
        const updated = new Map(prev);
        updated.set(userId, { 
          user_id: userId, 
          username, 
          peerConnection 
        });
        return updated;
      });

      // If initiator, create offer
      if (isInitiator) {
        const offer = await peerConnection.createOffer();
        await peerConnection.setLocalDescription(offer);
        
        signalingChannel.current?.send({
          type: 'broadcast',
          event: 'webrtc-offer',
          payload: {
            from: currentUserId,
            to: userId,
            offer: offer
          }
        });
      }

      return peerConnection;
    } catch (error) {
      console.error('Error creating peer connection:', error);
      toast.error('Failed to connect to participant');
    }
  };

  // Handle incoming offer
  const handleOffer = async (fromUserId: string, offer: RTCSessionDescriptionInit) => {
    try {
      const participant = participants.get(fromUserId);
      let peerConnection = participant?.peerConnection;

      if (!peerConnection) {
        // Create new peer connection if it doesn't exist
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
          event: 'webrtc-answer',
          payload: {
            from: currentUserId,
            to: fromUserId,
            answer: answer
          }
        });
      }
    } catch (error) {
      console.error('Error handling offer:', error);
    }
  };

  // Handle incoming answer
  const handleAnswer = async (fromUserId: string, answer: RTCSessionDescriptionInit) => {
    try {
      const participant = participants.get(fromUserId);
      if (participant?.peerConnection) {
        await participant.peerConnection.setRemoteDescription(answer);
      }
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  };

  // Handle ICE candidate
  const handleIceCandidate = async (fromUserId: string, candidate: RTCIceCandidateInit) => {
    try {
      const participant = participants.get(fromUserId);
      if (participant?.peerConnection) {
        await participant.peerConnection.addIceCandidate(candidate);
      }
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  };

  // Remove peer connection
  const removePeerConnection = (userId: string) => {
    setParticipants(prev => {
      const updated = new Map(prev);
      const participant = updated.get(userId);
      if (participant?.peerConnection) {
        participant.peerConnection.close();
      }
      updated.delete(userId);
      return updated;
    });
  };

  // Update participants list from presence
  const updateParticipantsList = (presenceState: any) => {
    setParticipants(prev => {
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

      // Remove participants who left
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

  // Start streaming (for hosts with camera)
  const startStreaming = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: streamEnabled.video,
        audio: streamEnabled.audio
      });

      setLocalStream(stream);
      setIsStreaming(true);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Get session's mixed audio for viewers
      const sessionMixedAudio = sessionLoopEngine.getMixedAudioStream();
      if (sessionMixedAudio) {
        const audioTrack = sessionMixedAudio.getAudioTracks()[0];
        if (audioTrack) {
          console.log('🔊 Adding session mixed audio track to WebRTC streams');
          externalAudioTrackRef.current = audioTrack;
          externalAudioStreamRef.current = sessionMixedAudio;
          
          // Add session audio to existing peer connections
          participants.forEach(participant => {
            if (participant.peerConnection) {
              participant.peerConnection.addTrack(audioTrack, sessionMixedAudio);
            }
          });
        }
      }

      // Join the WebRTC presence
      if (signalingChannel.current) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('profiles')
          .select('producer_name, first_name, last_name')
          .eq('id', user?.id)
          .single();

        const username = profile?.producer_name || 
                        `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
                        'Anonymous';

        await signalingChannel.current.track({
          user_id: user?.id,
          username,
          streaming: true
        });
      }

      toast.success('Started video streaming with session audio');
    } catch (error) {
      console.error('Error starting stream:', error);
      toast.error('Failed to start video stream');
    }
  };

  // Start as viewer (for guests - receive only, no camera)
  const startAsViewer = useCallback(async () => {
    try {
      console.log('👀 Starting as viewer - ready to receive streams');
      
      // Join the WebRTC presence as a viewer
      if (signalingChannel.current) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('profiles')
          .select('producer_name, first_name, last_name')
          .eq('id', user?.id)
          .single();

        const username = profile?.producer_name || 
                        `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
                        'Anonymous';

        await signalingChannel.current.track({
          user_id: user?.id,
          username,
          streaming: false // Viewer, not streaming
        });
      }

      setIsStreaming(false); // Not streaming, just viewing
      console.log('✅ Viewer connected - will receive audio/video from hosts');
    } catch (error) {
      console.error('Error starting as viewer:', error);
    }
  }, [currentUserId]);

  // Stop streaming
  const stopStreaming = () => {
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      setLocalStream(null);
    }

    // Close all peer connections
    participants.forEach(participant => {
      if (participant.peerConnection) {
        participant.peerConnection.close();
      }
    });

    setParticipants(new Map());
    setIsStreaming(false);

    if (signalingChannel.current) {
      signalingChannel.current.untrack();
    }

    toast.success('Stopped video streaming');
  };

  // Toggle video/audio
  const toggleVideo = () => {
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setStreamEnabled(prev => ({ ...prev, video: videoTrack.enabled }));
      }
    }
  };

  const toggleAudio = () => {
    if (localStream) {
      const audioTrack = localStream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setStreamEnabled(prev => ({ ...prev, audio: audioTrack.enabled }));
      }
    }
  };

  // Setup signaling on mount and auto-connect guests
  useEffect(() => {
    if (!sessionId || !currentUserId) return;

    console.log('🎬 Setting up WebRTC for session:', sessionId, 'canEdit:', canEdit);
    setupSignaling();
    
    // Auto-start as viewer for guests
    if (!canEdit) {
      const timer = setTimeout(() => {
        console.log('🎬 Auto-starting viewer mode for guest');
        startAsViewer();
      }, 1500); // Small delay to ensure signaling is ready
      
      return () => {
        clearTimeout(timer);
        if (signalingChannel.current) {
          signalingChannel.current.unsubscribe();
        }
      };
    }

    return () => {
      if (signalingChannel.current) {
        signalingChannel.current.unsubscribe();
      }
      stopStreaming();
    };
  }, [sessionId, currentUserId, canEdit, setupSignaling, startAsViewer]);

  return {
    localStream,
    participants: Array.from(participants.values()),
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