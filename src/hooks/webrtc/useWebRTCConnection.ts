import { useState, useRef, useCallback } from 'react';

export interface Participant {
  user_id: string;
  username: string;
  stream?: MediaStream;
  peerConnection?: RTCPeerConnection;
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' }
];

export const useWebRTCConnection = () => {
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const masterTrackIdRef = useRef<string | null>(null);

  const createPeerConnection = useCallback((
    userId: string,
    username: string,
    onTrack: (stream: MediaStream) => void,
    onIceCandidate: (candidate: RTCIceCandidate) => void,
    onNegotiationNeeded?: () => void
  ): RTCPeerConnection => {
    const peerConnection = new RTCPeerConnection({ iceServers: ICE_SERVERS });

    // Handle incoming tracks
    peerConnection.ontrack = (event) => {
      console.log(`📹 Received track from ${username}:`, event.track.kind);
      const [incomingStream] = event.streams;
      onTrack(incomingStream);
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
      if (event.candidate) {
        console.log(`🧊 ICE candidate for ${username}`);
        onIceCandidate(event.candidate);
      }
    };

    // Connection state logging
    peerConnection.onconnectionstatechange = () => {
      console.log(`📹 Connection with ${username}:`, peerConnection.connectionState);
    };

    // Handle negotiation
    if (onNegotiationNeeded) {
      peerConnection.onnegotiationneeded = onNegotiationNeeded;
    }

    setParticipants(prev => {
      const updated = new Map(prev);
      updated.set(userId, { user_id: userId, username, peerConnection });
      return updated;
    });

    return peerConnection;
  }, []);

  const addTrackToPeer = useCallback((
    userId: string,
    track: MediaStreamTrack,
    stream: MediaStream
  ): RTCRtpSender | null => {
    const participant = participants.get(userId);
    if (!participant?.peerConnection) {
      console.warn(`No peer connection for ${userId}`);
      return null;
    }

    try {
      const sender = participant.peerConnection.addTrack(track, stream);
      console.log(`➕ Added ${track.kind} track to ${userId}`);
      return sender;
    } catch (error) {
      console.error(`Error adding track to ${userId}:`, error);
      return null;
    }
  }, [participants]);

  const updateParticipantStream = useCallback((userId: string, stream: MediaStream) => {
    setParticipants(prev => {
      const updated = new Map(prev);
      const existing = updated.get(userId);
      if (existing) {
        updated.set(userId, { ...existing, stream });
      }
      return updated;
    });
  }, []);

  const removePeerConnection = useCallback((userId: string) => {
    setParticipants(prev => {
      const updated = new Map(prev);
      const participant = updated.get(userId);
      if (participant?.peerConnection) {
        participant.peerConnection.close();
        console.log(`🔌 Closed connection to ${userId}`);
      }
      updated.delete(userId);
      return updated;
    });
  }, []);

  const closeAllConnections = useCallback(() => {
    participants.forEach(participant => {
      if (participant.peerConnection) {
        participant.peerConnection.close();
      }
    });
    setParticipants(new Map());
    console.log('🔌 Closed all peer connections');
  }, [participants]);

  return {
    participants: Array.from(participants.values()),
    participantsMap: participants,
    createPeerConnection,
    addTrackToPeer,
    updateParticipantStream,
    removePeerConnection,
    closeAllConnections,
    masterTrackIdRef
  };
};
