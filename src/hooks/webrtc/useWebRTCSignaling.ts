import { useRef, useCallback, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface SignalingCallbacks {
  onOffer: (fromUserId: string, offer: RTCSessionDescriptionInit) => Promise<void>;
  onAnswer: (fromUserId: string, answer: RTCSessionDescriptionInit) => Promise<void>;
  onIceCandidate: (fromUserId: string, candidate: RTCIceCandidateInit) => Promise<void>;
  onUserJoined?: (userId: string, username: string) => void;
  onUserLeft?: (userId: string) => void;
  onSyncRequest?: (fromUserId: string) => void;
  onSyncResponse?: (syncData: any) => void;
  onPresenceSync?: (presenceState: any) => void;
}

export const useWebRTCSignaling = (
  sessionId: string,
  currentUserId: string | undefined,
  canEdit: boolean,
  callbacks: SignalingCallbacks
) => {
  const signalingChannel = useRef<any>(null);

  const sendOffer = useCallback((toUserId: string, offer: RTCSessionDescriptionInit) => {
    if (!signalingChannel.current) return;
    signalingChannel.current.send({
      type: 'broadcast',
      event: 'webrtc-offer',
      payload: { from: currentUserId, to: toUserId, offer }
    });
    console.log(`📤 Sent offer to ${toUserId}`);
  }, [currentUserId]);

  const sendAnswer = useCallback((toUserId: string, answer: RTCSessionDescriptionInit) => {
    if (!signalingChannel.current) return;
    signalingChannel.current.send({
      type: 'broadcast',
      event: 'webrtc-answer',
      payload: { from: currentUserId, to: toUserId, answer }
    });
    console.log(`📤 Sent answer to ${toUserId}`);
  }, [currentUserId]);

  const sendIceCandidate = useCallback((toUserId: string, candidate: RTCIceCandidate) => {
    if (!signalingChannel.current) return;
    signalingChannel.current.send({
      type: 'broadcast',
      event: 'webrtc-ice-candidate',
      payload: { from: currentUserId, to: toUserId, candidate }
    });
  }, [currentUserId]);

  const sendSyncRequest = useCallback(() => {
    if (!signalingChannel.current || canEdit) return;
    signalingChannel.current.send({
      type: 'broadcast',
      event: 'sync-request',
      payload: { from: currentUserId, message: 'Late joiner requesting sync' }
    });
    console.log('📻 Sent sync request');
  }, [currentUserId, canEdit]);

  const sendSyncResponse = useCallback((toUserId: string, syncData: any) => {
    if (!signalingChannel.current) return;
    signalingChannel.current.send({
      type: 'broadcast',
      event: 'sync-response',
      payload: { from: currentUserId, to: toUserId, syncData }
    });
    console.log('📻 Sent sync response');
  }, [currentUserId]);

  const trackPresence = useCallback(async (username: string, streaming: boolean, role: 'host' | 'viewer') => {
    if (!signalingChannel.current || !currentUserId) return;
    
    await signalingChannel.current.track({
      user_id: currentUserId,
      username,
      streaming,
      role
    });
    console.log(`📍 Tracking presence as ${role}`);
  }, [currentUserId]);

  const untrackPresence = useCallback(() => {
    if (!signalingChannel.current) return;
    signalingChannel.current.untrack();
    console.log('📍 Untracked presence');
  }, []);

  const setupSignaling = useCallback(() => {
    const channel = supabase.channel(`webrtc-${sessionId}`, {
      config: { presence: { key: sessionId } }
    });

    channel
      .on('broadcast', { event: 'webrtc-offer' }, async ({ payload }) => {
        if (payload.to === currentUserId && payload.from !== currentUserId) {
          console.log(`📥 Received offer from ${payload.from}`);
          await callbacks.onOffer(payload.from, payload.offer);
        }
      })
      .on('broadcast', { event: 'webrtc-answer' }, async ({ payload }) => {
        if (payload.to === currentUserId && payload.from !== currentUserId) {
          console.log(`📥 Received answer from ${payload.from}`);
          await callbacks.onAnswer(payload.from, payload.answer);
        }
      })
      .on('broadcast', { event: 'webrtc-ice-candidate' }, async ({ payload }) => {
        if (payload.to === currentUserId && payload.from !== currentUserId) {
          await callbacks.onIceCandidate(payload.from, payload.candidate);
        }
      })
      .on('broadcast', { event: 'sync-request' }, async ({ payload }) => {
        if (canEdit && payload.from !== currentUserId && callbacks.onSyncRequest) {
          callbacks.onSyncRequest(payload.from);
        }
      })
      .on('broadcast', { event: 'sync-response' }, ({ payload }) => {
        if (payload.to === currentUserId && !canEdit && callbacks.onSyncResponse) {
          console.log('📻 Received sync data for late join:', payload.syncData);
          callbacks.onSyncResponse(payload.syncData);
        }
      })
      .on('presence', { event: 'sync' }, () => {
        const presenceState = channel.presenceState();
        console.log('📹 WebRTC presence sync:', presenceState);
        if (callbacks.onPresenceSync) {
          callbacks.onPresenceSync(presenceState);
        }
      })
      .on('presence', { event: 'join' }, ({ newPresences }) => {
        console.log('📹 User joined video session:', newPresences);
        newPresences.forEach((presence: any) => {
          if (presence.user_id !== currentUserId && callbacks.onUserJoined) {
            callbacks.onUserJoined(presence.user_id, presence.username);
          }
        });
      })
      .on('presence', { event: 'leave' }, ({ leftPresences }) => {
        console.log('📹 User left video session:', leftPresences);
        leftPresences.forEach((presence: any) => {
          if (callbacks.onUserLeft) {
            callbacks.onUserLeft(presence.user_id);
          }
        });
      })
      .subscribe();

    signalingChannel.current = channel;
    console.log('🎬 WebRTC signaling channel setup complete');
  }, [sessionId, currentUserId, canEdit, callbacks]);

  const cleanup = useCallback(() => {
    if (signalingChannel.current) {
      signalingChannel.current.unsubscribe();
      signalingChannel.current = null;
      console.log('🧹 Signaling channel cleaned up');
    }
  }, []);

  return {
    setupSignaling,
    cleanup,
    sendOffer,
    sendAnswer,
    sendIceCandidate,
    sendSyncRequest,
    sendSyncResponse,
    trackPresence,
    untrackPresence,
    getPresenceState: () => signalingChannel.current?.presenceState?.() || {}
  };
};
