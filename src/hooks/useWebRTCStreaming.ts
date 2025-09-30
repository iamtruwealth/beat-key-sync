import { useEffect, useState, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sessionLoopEngine } from '@/lib/sessionLoopEngine';
import { HostMasterAudio } from '@/lib/HostMasterAudio';

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
      .on('broadcast', { event: 'sync-request' }, async ({ payload }) => {
        // Host responds to sync requests from late joiners
        if (canEdit && payload.from !== currentUserId) {
          const hostMaster = HostMasterAudio.getInstance();
          if (hostMaster.isInitialized) {
            const syncData = {
              currentTime: hostMaster.getCurrentPlaybackTime(),
              loopDuration: hostMaster.getLoopDuration(),
              isPlaying: hostMaster.hasPlayer
            };
            
            channel.send({
              type: 'broadcast',
              event: 'sync-response',
              payload: {
                from: currentUserId,
                to: payload.from,
                syncData
              }
            });
          }
        }
      })
      .on('broadcast', { event: 'sync-response' }, ({ payload }) => {
        // Late joiner receives sync data
        if (payload.to === currentUserId && !canEdit) {
          console.log('📻 Received sync data for late join:', payload.syncData);
          // This would be used by the audio element to sync if needed
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
          if (presence.user_id !== currentUserId) {
            createPeerConnection(presence.user_id, presence.username, true);
            
            // If we're the host and someone joined, they might be a late joiner
            if (canEdit) {
              console.log('📻 Host: New viewer joined, they will auto-sync to master stream');
            }
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
  }, [sessionId, currentUserId, canEdit]);

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

      // Handle incoming track(s) - merge into a single combined stream per participant
      peerConnection.ontrack = (event) => {
        const [incomingStream] = event.streams;
        setParticipants(prev => {
          const updated = new Map(prev);
          const existing = updated.get(userId) || { user_id: userId, username } as any;

          // Create or reuse a combined MediaStream
          if (!(existing as any).combinedStream) {
            (existing as any).combinedStream = new MediaStream();
          }
          const combined: MediaStream = (existing as any).combinedStream;

          // Add new tracks if not already present
          incomingStream.getTracks().forEach(track => {
            const already = combined.getTracks().some(t => t.id === track.id);
            if (!already) combined.addTrack(track);
          });

          existing.stream = combined;
          existing.peerConnection = peerConnection;
          updated.set(userId, existing);
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

      // Ensure master audio sender is attached exactly once (no dupes)
      const ensureMasterAudioSender = () => {
        if (!externalAudioTrackRef.current || !externalAudioStreamRef.current) return;
        const masterTrack = externalAudioTrackRef.current;
        const audioSenders = peerConnection.getSenders().filter(s => s.track && s.track.kind === 'audio');

        // Remove any non-master audio senders to prevent double audio
        audioSenders.forEach((s) => {
          if (s.track && s.track.id !== masterTrack.id) {
            console.log('🧹 Removing extra audio sender', s.track.id);
            try { peerConnection.removeTrack(s); } catch {}
          }
        });

        const existingSender = peerConnection.getSenders().find(s => s.track && s.track.kind === 'audio');
        if (existingSender) {
          if (existingSender.track?.id !== masterTrack.id) {
            console.log('🔁 Replacing audio sender track with master track');
            existingSender.replaceTrack(masterTrack).catch((e) => console.warn('replaceTrack failed', e));
          }
        } else {
          console.log('➕ Adding master audio track to peer connection');
          peerConnection.addTrack(masterTrack, externalAudioStreamRef.current);
        }
      };
      ensureMasterAudioSender();

      // Renegotiate when new tracks are added (especially after adding master audio)
      peerConnection.onnegotiationneeded = async () => {
        try {
          if (!signalingChannel.current) return;
          console.log('🌀 onnegotiationneeded - creating offer');
          const offer = await peerConnection.createOffer();
          await peerConnection.setLocalDescription(offer);
          signalingChannel.current.send({
            type: 'broadcast',
            event: 'webrtc-offer',
            payload: { from: currentUserId, to: userId, offer }
          });
        } catch (e) {
          console.warn('Negotiation failed:', e);
        }
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

  // Start master audio broadcasting (host only)
  const startStreaming = async () => {
    try {
      console.log('📻 Starting master audio broadcast');
      
      // Initialize HostMasterAudio first
      const hostMaster = HostMasterAudio.getInstance();
      if (!hostMaster.isInitialized) {
        await hostMaster.initialize();
        hostMaster.connectToCookModeEngine();
      }

      // Get the master audio stream for broadcasting
      const masterAudioStream = hostMaster.getMasterStream();
      if (!masterAudioStream) {
        throw new Error('No master audio stream available');
      }

      // Create main broadcast stream (audio + optional video)
      const stream = streamEnabled.video 
        ? await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        : new MediaStream();

      // Add master audio track to the broadcast stream
      const audioTrack = masterAudioStream.getAudioTracks()[0];
      if (audioTrack) {
        console.log('📻 Adding master audio track to broadcast stream');
        stream.addTrack(audioTrack);
        externalAudioTrackRef.current = audioTrack;
        externalAudioStreamRef.current = masterAudioStream;
      }

      setLocalStream(stream);
      setIsStreaming(true);

      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }

      // Join WebRTC presence as host
      if (signalingChannel.current) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('profiles')
          .select('producer_name, first_name, last_name')
          .eq('id', user?.id)
          .single();

        const username = profile?.producer_name || 
                        `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
                        'Host';

        await signalingChannel.current.track({
          user_id: user?.id,
          username,
          streaming: true,
          role: 'host'
        });

        // Connect to all existing participants
        const presenceState = signalingChannel.current.presenceState?.() || {};
        const others = (Object.values(presenceState).flat() as any[]);
        for (const presence of others) {
          if (presence.user_id && presence.user_id !== user?.id) {
            await createPeerConnection(presence.user_id, presence.username || 'Viewer', true);
          }
        }
      }
  
      toast.success('📻 Master audio broadcast started - streaming to all viewers');
    } catch (error) {
      console.error('Error starting master audio broadcast:', error);
      toast.error('Failed to start audio broadcast');
    }
  };

  // Start as viewer (receive master audio stream)
  const startAsViewer = useCallback(async () => {
    try {
      console.log('👀 Starting as viewer - ready to receive master audio stream');
      
      // Join WebRTC presence as viewer
      if (signalingChannel.current) {
        const { data: { user } } = await supabase.auth.getUser();
        const { data: profile } = await supabase
          .from('profiles')
          .select('producer_name, first_name, last_name')
          .eq('id', user?.id)
          .single();

        const username = profile?.producer_name || 
                        `${profile?.first_name || ''} ${profile?.last_name || ''}`.trim() || 
                        'Viewer';

        await signalingChannel.current.track({
          user_id: user?.id,
          username,
          streaming: false,
          role: 'viewer'
        });

        // Request sync from host for late joining
        signalingChannel.current.send({
          type: 'broadcast',
          event: 'sync-request',
          payload: {
            from: user?.id,
            message: 'Late joiner requesting sync'
          }
        });
      }

      setIsStreaming(false); // Viewers don't stream
      console.log('✅ Viewer connected - will receive master audio stream');
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

  // Master audio attachment for hosts (HostMasterAudio)
  const masterTrackIdRef = useRef<string | null>(null);
  const attachHostMasterAudio = useCallback(() => {
    try {
      const hostMaster = HostMasterAudio.getInstance();
      const masterStream = hostMaster.getMasterStream();
      if (!masterStream) return;
      const track = masterStream.getAudioTracks()[0];
      if (!track) return;

      externalAudioTrackRef.current = track;
      externalAudioStreamRef.current = masterStream;

      // Avoid re-adding the same track repeatedly
      if (masterTrackIdRef.current === track.id) return;
      masterTrackIdRef.current = track.id;

      participants.forEach(p => {
        const pc = p.peerConnection;
        if (!pc) return;
        const already = pc.getSenders().some(s => s.track && s.track.id === track.id);
        if (!already) {
          pc.addTrack(track, masterStream);
        }
      });
      console.log('🔊 Master audio attached to all peer connections');
    } catch (e) {
      console.warn('Failed to attach master audio:', e);
    }
  }, [participants]);

  useEffect(() => {
    if (canEdit) {
      attachHostMasterAudio();
    }
  }, [canEdit, participants, attachHostMasterAudio]);

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